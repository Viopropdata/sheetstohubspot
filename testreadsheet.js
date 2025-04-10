const { readSheetData } = require('./readthasheet');

(async () => {
  try {
    const records = await readSheetData();
    console.log('📋 Parsed records:\n', records);
  } catch (err) {
    console.error('❌ Failed to read sheet:', err.message);
  }
})();
