const { google } = require('googleapis');
const { getAuthorizedClient } = require('./google-auth');

async function testAuth() {
  try {
    const authClient = await getAuthorizedClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Replace this with the actual ID of your Google Sheet
    const spreadsheetId = '1ce_r9ZZ09bwGQbB3ER3KRa7GiUTAhXJJOdeHVa8Y3Iw';

    // Just read the first row (A1)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A1',
    });

    console.log('✅ Auth succeeded and read cell A1:', response.data.values);
  } catch (err) {
    console.error('❌ Auth test failed:', err.message);
  }
}

testAuth();
