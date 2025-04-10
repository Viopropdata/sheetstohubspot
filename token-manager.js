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
};