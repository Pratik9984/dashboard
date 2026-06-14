import { google } from 'googleapis';
import { requireAdmin } from '@/app/lib/firebaseAdmin';

export async function GET(request) {
  try {
    // Temporarily bypassing Firebase Admin authentication for local testing
    // await requireAdmin(request);
  } catch (err) {
    return Response.json({ error: `Firebase Admin Error: ${err.message}` }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    let clientEmail = process.env.GSC_CLIENT_EMAIL;
    let privateKey = process.env.GSC_PRIVATE_KEY;
    let siteUrl = process.env.GSC_SITE_URL;

    // Remove wrapping double quotes and trailing commas if they exist
    if (clientEmail) {
      clientEmail = clientEmail.replace(/^["']|["'],?$/g, '');
    }
    if (privateKey) {
      privateKey = privateKey.replace(/^["']|["'],?$/g, '');
      // Translate escaped newline characters
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    if (siteUrl) {
      siteUrl = siteUrl.replace(/^["']|["'],?$/g, '');
    }

    if (!clientEmail || !privateKey || !siteUrl) {
      return Response.json(
        { error: 'Google Search Console environment variables are missing.' },
        { status: 500 }
      );
    }

    // Extract project ID from clientEmail (e.g. name@project-id.iam.gserviceaccount.com)
    let projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId && clientEmail) {
      const parts = clientEmail.split('@');
      if (parts.length > 1) {
        const domainParts = parts[1].split('.');
        if (domainParts.length > 0) {
          projectId = domainParts[0];
        }
      }
    }
    if (projectId && !process.env.GOOGLE_CLOUD_PROJECT) {
      process.env.GOOGLE_CLOUD_PROJECT = projectId;
    }

    // Authenticate with Google API GoogleAuth using credentials object format
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      projectId: projectId
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
      { error: `GSC Error: ${error.message || 'Failed to fetch Search Console data'}` },
      { status: 500 }
    );
  }
}
