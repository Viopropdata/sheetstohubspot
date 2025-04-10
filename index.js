require('dotenv').config();
const express = require('express');
const request = require('request-promise-native');
const NodeCache = require('node-cache');
const opn = require('open');
const fs = require('fs');
const path = require('path');
const { syncContacts } = require('./sync'); // Import sync logic

const app = express();
const PORT = 3000;

// Store tokens in a cache
const accessTokenCache = new NodeCache({ deleteOnExpire: true });

// File path for persistent token storage
const TOKEN_PATH = path.join(__dirname, 'token.json');

// Configuration for HubSpot OAuth
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:${PORT}/oauth-callback`;


if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing CLIENT_ID or CLIENT_SECRET environment variable.');
}

// Save tokens to token.json with expiration time
function saveTokens(tokens) {
    // Add an expires_at field based on expires_in
    if (tokens.expires_in) {
        // Convert expires_in seconds to milliseconds and add to current time
        tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
    }

    // Save to file
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

    // Also cache the access token
    accessTokenCache.set('default', tokens.access_token, Math.round(tokens.expires_in * 0.75));

    console.log('Tokens saved successfully');
    return tokens;
}

// Load tokens from token.json
function loadTokens() {
    if (!fs.existsSync(TOKEN_PATH)) {
        return null;
    }
    try {
        const raw = fs.readFileSync(TOKEN_PATH);
        return JSON.parse(raw);
    } catch (error) {
        console.error('Error loading tokens:', error);
        return null;
    }
}

// Check if the token is expired based on expiration time
function isTokenExpired(tokens) {
    if (!tokens || !tokens.expires_at) return true;
    
    const now = Date.now();
    return now >= tokens.expires_at;
}

// Refresh the access token using the refresh token
async function refreshAccessToken(refreshToken) {
    try {
        console.log('Refreshing expired access token');
        const responseBody = await request.post('https://api.hubapi.com/oauth/v1/token', {
            form: {
                grant_type: 'refresh_token',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                refresh_token: refreshToken
            }
        });

        const tokens = JSON.parse(responseBody);
        
        // Save the refreshed tokens
        saveTokens(tokens);
        console.log('Access token refreshed successfully');
        
        return tokens.access_token;
    } catch (error) {
        console.error('Failed to refresh access token:', error);
        throw new Error('Token refresh failed. Please re-authenticate.');
    }
}

// Get a valid access token, refreshing if necessary
async function getValidAccessToken() {
    const tokens = loadTokens();
    if (!tokens) {
        throw new Error('No valid token found. Please authenticate first.');
    }

    if (isTokenExpired(tokens)) {
        return await refreshAccessToken(tokens.refresh_token);
    }
    
    return tokens.access_token;
}

// OAuth flow to get a new token if expired
app.get('/install', (req, res) => {
    const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(CLIENT_ID)}&scope=crm.objects.contacts.read&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    res.redirect(authUrl);
});

// OAuth callback handling
app.get('/oauth-callback', async (req, res) => {
    if (req.query.code) {
        try {
            const token = await exchangeForTokens(req.query.code);
            res.send('<h2>OAuth successful!</h2><p>Your tokens are saved, now you can run the sync.</p><a href="/">Run Sync</a>');
        } catch (error) {
            res.send('<h2>Error!</h2><p>Failed to exchange code for token.</p>');
        }
    } else {
        res.send('<h2>Error!</h2><p>No authorization code received.</p>');
    }
});

const exchangeForTokens = async (authCode) => {
    try {
        const responseBody = await request.post('https://api.hubapi.com/oauth/v1/token', {
            form: {
                grant_type: 'authorization_code',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                code: authCode
            }
        });
        
        const tokens = JSON.parse(responseBody);
        return saveTokens(tokens);
    } catch (e) {
        console.error('Error exchanging authorization code for access token', e);
        throw new Error('Token exchange failed');
    }
};

// Main route to trigger sync process
app.get('/', async (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.write('<h2>📤 HubSpot Contact Sync Tool</h2>');

    try {
        const accessToken = await getValidAccessToken();
        res.write('<p>🔄 Syncing contacts from sheet to HubSpot...</p>');
        
        // Run sync if the token is valid
        await syncContacts(accessToken);
        
        res.write('<p>✅ Sync completed successfully!</p>');
    } catch (err) {
        console.error('Error during sync:', err);
        res.write(`<p>❌ Sync failed: ${err.message}</p>`);
        
        // Reconnect option if the error is token related
        if (err.message.includes('token') || err.message.includes('auth')) {
            res.write(`<a href="/install">Reconnect to HubSpot</a>`);
        }
    }

    res.end();
});

// Error route to display errors
app.get('/error', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.write(`<h2>Error</h2><p>${req.query.msg || 'Unknown error'}</p>`);
    res.write('<p><a href="/">Return to home</a></p>');
    res.end();
});

app.listen(PORT, () => {
    console.log(`App running on http://localhost:${PORT}`);
    opn(`http://localhost:${PORT}`);
});
