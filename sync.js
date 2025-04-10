require('dotenv').config();
const { readSheetData } = require('./readthasheet');
const { uploadContactToHubspot } = require('./hubspot-upload');

async function syncContacts(accessToken) {
  try {
    const records = await readSheetData();
    if (!records.length) {
      console.log('❌ No records found in the sheet.');
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const result = await uploadContactToHubspot(record, accessToken);
      if (result) {
        successCount++;
        console.log(`✅ Successfully processed record ${i + 1}`);
      } else {
        failureCount++;
        console.log(`❌ Failed to process record ${i + 1}`);
      }
    }

    console.log(`✅ Sync complete! ${successCount} succeeded, ${failureCount} failed.`);
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
  }
}

module.exports = { syncContacts };
