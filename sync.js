// sync.js

require('dotenv').config();

const { readSheetData } = require('./readthasheet');
const { uploadContactToHubspot } = require('./hubspot-upload');

const ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

async function syncContacts() {
  try {
    const records = await readSheetData();
    if (!records.length) {
      console.log('❌ No records found in the sheet.');
      return;
    }

    console.log(`🔄 Starting sync of ${records.length} records...`);
    let successCount = 0;
    let failureCount = 0;

    for (const record of records) {
      const result = await uploadContactToHubspot(record, ACCESS_TOKEN);
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
