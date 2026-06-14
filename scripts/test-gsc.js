const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

async function testGsc() {
  console.log("Reading .env.local file...");
  // Read .env.local from the workspace root (one level up from scripts/test-gsc.js)
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error("Error: .env.local file not found at " + envPath);
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Simple parser for .env.local file
  const env = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length > 1) {
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      
      // Strip wrapping quotes
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  });

  let clientEmail = env.GSC_CLIENT_EMAIL;
  let privateKey = env.GSC_PRIVATE_KEY;
  let siteUrl = env.GSC_SITE_URL;

  console.log("GSC_CLIENT_EMAIL:", clientEmail);
  console.log("GSC_SITE_URL:", siteUrl);
  console.log("Is GSC_PRIVATE_KEY set?", privateKey ? "Yes (length: " + privateKey.length + ")" : "No");

  if (!clientEmail || !privateKey || !siteUrl) {
    console.error("Error: Missing Google Search Console environment variables.");
    return;
  }

  // Translate escaped newline characters
  privateKey = privateKey.replace(/\\n/g, '\n');

  // Extract project ID
  let projectId;
  const parts = clientEmail.split('@');
  if (parts.length > 1) {
    const domainParts = parts[1].split('.');
    if (domainParts.length > 0) {
      projectId = domainParts[0];
    }
  }
  console.log("Resolved Project ID:", projectId);

  try {
    console.log("Initializing GoogleAuth client...");
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      projectId: projectId
    });

    console.log("Authenticating and fetching Search Console client...");
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 10);
    const endDate = new Date();
    endDate.setDate(today.getDate() - 3);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    console.log("Querying Search Console API for property:", siteUrl);
    console.log("Date range:", formattedStartDate, "to", formattedEndDate);

    const trafficResponse = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        dimensions: ['date'],
        rowLimit: 5,
      },
    });

    console.log("--- SUCCESS! ---");
    console.log("Traffic Response Rows count:", trafficResponse.data.rows ? trafficResponse.data.rows.length : 0);
    if (trafficResponse.data.rows && trafficResponse.data.rows.length > 0) {
      console.log("First row data preview:", JSON.stringify(trafficResponse.data.rows[0]));
    }
  } catch (err) {
    console.error("--- FAILURE ---");
    console.error("Error Code / Status:", err.code || err.status || "N/A");
    console.error("Error Message:", err.message);
    if (err.response && err.response.data) {
      console.error("Detailed Error Response:", JSON.stringify(err.response.data));
    }
  }
}

testGsc();
