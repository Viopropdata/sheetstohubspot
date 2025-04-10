// sync.js

require('dotenv').config();
const { readSheetData } = require('./readthasheet');
const { uploadContactToHubspot } = require('./hubspot-upload');
const { getValidAccessToken } = require('./token-manager');

async function syncContacts() {
  try {
    const records = await readSheetData();
    if (!records.length) {
      console.log('❌ No records found in the sheet.');
      return;
    }

    const accessToken = await getValidAccessToken();
    console.log(`🔐 Using access token: ${accessToken.substring(0, 10)}...`);

    console.log(`🔄 Starting sync of ${records.length} records...`);
    let successCount = 0;
    let failureCount = 0;

    for (const record of records) {
      const result = await uploadContactToHubspot(record, accessToken);
      if (result) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    console.log(`✅ Sync complete! ${successCount} succeeded, ${failureCount} failed.`);
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
  }
}

// Run the sync if this file is executed directly
if (require.main === module) {
  syncContacts();
}

module.exports = { syncContacts };
