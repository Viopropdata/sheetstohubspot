const { loadTokens, refreshAccessToken, getValidAccessToken } = require('./token-manager');

(async () => {
  try {
    console.log('📦 Current tokens:', loadTokens());

    const newAccessToken = await refreshAccessToken();
    console.log('✅ New access token:', newAccessToken);

    const validatedToken = await getValidAccessToken();
    console.log('🆗 Access token from manager:', validatedToken);
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
})();
