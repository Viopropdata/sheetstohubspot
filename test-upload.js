// test-upload.js

const { readSheetData } = require('./readthasheet');
const { uploadContactToHubspot } = require('./hubspot-upload');

// Paste your HubSpot access token here for testing
const ACCESS_TOKEN = 'CO3yyYTiMhIcAAEAQEAAwQIAAAAIAAAAAACAAAAAAAAAAGAAAhiAr9BzIN_zpCMo6sCNBTIUaBkDIWsGlPinEfzqnWxrRXdMsgc6VAAAAEEAAAAAAAAAAAAAAAAAgAAAAAYAAAAAACAAiAA-AOABAAAAAAAAHAAAAABwAgAAAAAAAAAAAAEAAAAAAAwAAAAAAAAAAAAAAAAAAAAAPwAAAUIUA6Z9LZcyLr-x4rJ4fmvAvEe2la1KA25hMlIAWgBgAGjf86QjcAA';

(async () => {
  try {
    const records = await readSheetData();

    if (!records.length) {
      console.log('❌ No records found in the sheet.');
      return;
    }

    const firstRecord = records[0];
    console.log(`📤 Uploading first contact: ${firstRecord['First Name']} ${firstRecord['Last Name']}`);

    const result = await uploadContactToHubspot(firstRecord, ACCESS_TOKEN);

    if (result) {
      console.log(`✅ Contact created with ID: ${result.id}`);
    } else {
      console.log('❌ Contact creation failed.');
    }
  } catch (err) {
    console.error('❌ Test upload failed:', err.message);
  }
})();
