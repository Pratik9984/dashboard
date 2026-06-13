import { google } from 'googleapis';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    let clientEmail = process.env.GSC_CLIENT_EMAIL;
    let privateKey = process.env.GSC_PRIVATE_KEY;
    let siteUrl = process.env.GSC_SITE_URL;

    // Remove wrapping double quotes if they exist in the env values
    if (clientEmail && clientEmail.startsWith('"') && clientEmail.endsWith('"')) {
      clientEmail = clientEmail.slice(1, -1);
    }
    if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    if (siteUrl && siteUrl.startsWith('"') && siteUrl.endsWith('"')) {
      siteUrl = siteUrl.slice(1, -1);
    }

    // Translate escaped newline characters
    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (!clientEmail || !privateKey || !siteUrl) {
      return Response.json(
        { error: 'Google Search Console environment variables are missing.' },
        { status: 500 }
      );
    }

    // Authenticate with Google API JWT using options object format
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // Google Search Console usually has a delay of 2-3 days for search metrics.
    // Querying up to 3 days ago avoids missing data points at the tail end.
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days - 3);
    const endDate = new Date();
    endDate.setDate(today.getDate() - 3);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    // Fetch Traffic Trend (grouped by Date)
    const trafficResponse = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        dimensions: ['date'],
        rowLimit: days,
      },
    });

    // Fetch Top Search Queries (grouped by Query)
    const queriesResponse = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        dimensions: ['query'],
        rowLimit: 10,
      },
    });

    return Response.json({
      traffic: trafficResponse.data.rows || [],
      queries: queriesResponse.data.rows || [],
    });
  } catch (error) {
    console.error('GSC Fetch Error:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch Search Console data' },
      { status: 500 }
    );
  }
}
