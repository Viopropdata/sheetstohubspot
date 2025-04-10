// readthasheet.js

const { google } = require('googleapis');
const { getAuthorizedClient } = require('./google-auth');

// Set your spreadsheet ID here once and reuse it
const SPREADSHEET_ID = '1ce_r9ZZ09bwGQbB3ER3KRa7GiUTAhXJJOdeHVa8Y3Iw';
const SHEET_NAME = 'Hubspot Upload'; // Change if your tab name is different

async function readSheetData() {
  try {
    const authClient = await getAuthorizedClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}`,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      console.log('❌ No data found in sheet');
      return [];
    }

    // Convert headers + rows into structured objects
    const headers = rows[0];
    const records = rows.slice(1).map((row) => {
      const record = {};
      headers.forEach((header, idx) => {
        record[header] = row[idx] || ''; // handle empty cells
      });
      return record;
    });

    console.log(`✅ Read ${records.length} records from sheet.`);
    return records;
  } catch (error) {
    console.error('❌ Error reading sheet:', error.message);
    throw error;
  }
}

module.exports = { readSheetData };
