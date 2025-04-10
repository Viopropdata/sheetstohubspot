// token-manager.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const TOKEN_PATH = path.join(__dirname, 'token.json');

function loadTokens() {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error('❌ token.json not found. Please authenticate first.');
  }
  const raw = fs.readFileSync(TOKEN_PATH);
  return JSON.parse(raw);
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

async function refreshAccessToken() {
  const tokens = loadTokens();
  const { refresh_token } = tokens;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    refresh_token,
  });

  try {
    const response = await axios.post('https://api.hubapi.com/oauth/v1/token', body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const newTokens = {
      ...tokens,
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
      token_type: response.data.token_type,
    };

    saveTokens(newTokens);
    console.log('🔄 Access token refreshed.');
    return newTokens.access_token;
  } catch (err) {
    console.error('❌ Failed to refresh access token:', err.response?.data || err.message);
    throw err;
  }
}

async function getValidAccessToken() {
  const tokens = loadTokens();
  return tokens.access_token;
  // Optional: Add logic here to check if token is expired based on timestamp
  // For now, we assume it's always valid or manually refreshed during testing
}

module.exports = {
  getValidAccessToken,
  refreshAccessToken,
  loadTokens,
  saveTokens,
};
