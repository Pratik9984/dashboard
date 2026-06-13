const { ImapFlow } = require('imapflow');
const fs = require('fs');
const path = require('path');

// Read .env.local manually to get GMAIL_USER and GMAIL_APP_PASSWORD
const envPath = path.join(__dirname, '.env.local');
console.log('Reading env file at:', envPath);
let gmailUser = '';
let gmailPass = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('GMAIL_USER=')) {
      gmailUser = line.split('=')[1].trim();
    }
    if (line.trim().startsWith('GMAIL_APP_PASSWORD=')) {
      gmailPass = line.split('=')[1].trim();
    }
  }
} catch (e) {
  console.error('Failed to read env file:', e.message);
}

console.log('User:', gmailUser);
console.log('Pass:', gmailPass ? '****' : 'not found');

if (!gmailUser || !gmailPass) {
  console.error('Missing credentials');
  process.exit(1);
}

const client = new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: {
    user: gmailUser,
    pass: gmailPass,
  },
  logger: false
});

async function main() {
  console.log('Connecting...');
  await client.connect();
  console.log('Connected successfully!');
  console.log('Listing mailboxes...');
  const mailboxes = await client.list();
  console.log('Mailboxes:', mailboxes.map(m => m.path));
  await client.logout();
}

main().catch(err => {
  console.error('Connection failed:', err);
  process.exit(1);
});
