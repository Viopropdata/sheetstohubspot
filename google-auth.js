// google-auth.js

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Load service account key
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'service-account.json'),
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
});

// Get an authorized client
async function getAuthorizedClient() {
  try {
    const client = await auth.getClient();
    return client;
  } catch (error) {
    console.error('Error authorizing Google service account:', error);
    throw error;
  }
}

module.exports = { getAuthorizedClient };