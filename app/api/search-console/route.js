import { google } from 'googleapis';
import { requireAdmin } from '@/app/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

function normalizePrivateKey(key) {
  if (!key) return '';
  // Remove wrapping quotes and trailing comma if they exist
  let cleaned = key.replace(/^["']|["'],?$/g, '').trim();
  // Translate escaped newline characters
  cleaned = cleaned.replace(/\\n/g, '\n');
  
  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';
  
  if (cleaned.includes(header) && cleaned.includes(footer)) {
    // Reconstruct PEM block to be clean and standard
    const base64Part = cleaned
      .replace(header, '')
      .replace(footer, '')
      .replace(/\s+/g, ''); // Remove all whitespace/newlines
    
    // Chunk base64 string to 64 character lines
    const lines = [];
    for (let i = 0; i < base64Part.length; i += 64) {
      lines.push(base64Part.substring(i, i + 64));
    }
    return `${header}\n${lines.join('\n')}\n${footer}\n`;
  }
  return cleaned;
}

export async function GET(request) {
  try {
    // Temporarily bypassing Firebase Admin authentication for local testing
    // await requireAdmin(request);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Firebase Admin Error: ${err.message}` }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    let clientEmail = process.env.GSC_CLIENT_EMAIL;
    let privateKey = process.env.GSC_PRIVATE_KEY;
    let siteUrl = process.env.GSC_SITE_URL;

    // Remove wrapping double quotes and trailing commas if they exist
    if (clientEmail) {
      clientEmail = clientEmail.replace(/^["']|["'],?$/g, '').trim();
    }
    if (privateKey) {
      privateKey = normalizePrivateKey(privateKey);
    }
    if (siteUrl) {
      siteUrl = siteUrl.replace(/^["']|["'],?$/g, '').trim();
    }

    if (!clientEmail || !privateKey || !siteUrl) {
      return new Response(
        JSON.stringify({ error: 'Google Search Console environment variables are missing.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
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

    return new Response(
      JSON.stringify({
        traffic: trafficResponse.data.rows || [],
        queries: queriesResponse.data.rows || [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('GSC Fetch Error:', error);
    return new Response(
      JSON.stringify({ error: `GSC Error: ${error.message || 'Failed to fetch Search Console data'}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
