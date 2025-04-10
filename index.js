require('dotenv').config();
const express = require('express');
const request = require('request-promise-native');
const NodeCache = require('node-cache');
const opn = require('open');
const app = express();
const fs = require('fs');
const { saveTokens } = require('./token-manager');

const PORT = 3000;

// Store tokens in a cache, keyed by a unique user identifier (we'll use a random state parameter)
const refreshTokenStore = {};
const accessTokenCache = new NodeCache({ deleteOnExpire: true });

if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
    throw new Error('Missing CLIENT_ID or CLIENT_SECRET environment variable.');
}

//===========================================================================//
//  HUBSPOT APP CONFIGURATION
//
//  All the following values must match configuration settings in your app.
//  They will be used to build the OAuth URL, which users visit to begin
//  installing. If they don't match your app's configuration, users will
//  see an error page.

// Replace the following with the values from your app auth config, 
// or set them as environment variables before running.
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// Scopes for this app will default to `crm.objects.contacts.read`
// To request others, set the SCOPE environment variable instead
let SCOPES = ['crm.objects.contacts.read'];
if (process.env.SCOPE) {
    SCOPES = (process.env.SCOPE.split(/ |, ?|%20/)).join(' ');
}

// On successful install, users will be redirected to /oauth-callback
const REDIRECT_URI = `http://localhost:${PORT}/oauth-callback`;

//===========================================================================//

// Generate a random state parameter for OAuth security
function generateRandomState() {
    return Math.random().toString(36).substring(2, 15);
}

//================================//
//   Running the OAuth 2.0 Flow   //
//================================//

// Step 1
// Build the authorization URL to redirect a user
// to when they choose to install the app
app.get('/install', (req, res) => {
    console.log('');
    console.log('=== Initiating OAuth 2.0 flow with HubSpot ===');
    console.log('');
    console.log("===> Step 1: Redirecting user to your app's OAuth URL");
    
    // Generate a random state parameter for this installation attempt
    const state = generateRandomState();
    
    const authUrl =
        'https://app.hubspot.com/oauth/authorize' +
        `?client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&state=${encodeURIComponent(state)}`;
    
    res.redirect(authUrl);
    console.log('===> Step 2: User is being prompted for consent by HubSpot');
});

// Step 2
// The user is prompted to give the app access to the requested
// resources. This is all done by HubSpot, so no work is necessary
// on the app's end

// Step 3
// Receive the authorization code from the OAuth 2.0 Server,
// and process it based on the query parameters that are passed
app.get('/oauth-callback', async (req, res) => {
    console.log('===> Step 3: Handling the request sent by the server');

    // Verify the state parameter if it was included in the request
    const state = req.query.state || 'default';

    // Received a user authorization code, so now combine that with the other
    // required values and exchange both for an access token and a refresh token
    if (req.query.code) {
        console.log('       > Received an authorization token');

        const authCodeProof = {
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            code: req.query.code
        };

        // Step 4
        // Exchange the authorization code for an access token and refresh token
        console.log('===> Step 4: Exchanging authorization code for an access token and refresh token');
        const token = await exchangeForTokens(state, authCodeProof);
        if (token.message) {
            return res.redirect(`/error?msg=${token.message}`);
        }

        // Once the tokens have been retrieved, use them to make a query
        // to the HubSpot API
        res.send(`<h2>✅ OAuth successful</h2><p>Your tokens have been saved. You may now close this tab.</p>`);
    }
});

//==========================================//
//   Exchanging Proof for an Access Token   //
//==========================================//

const exchangeForTokens = async (userId, exchangeProof) => {
    try {
        const responseBody = await request.post('https://api.hubapi.com/oauth/v1/token', {
            form: exchangeProof
        });
        
        const tokens = JSON.parse(responseBody);
        refreshTokenStore[userId] = tokens.refresh_token;
        accessTokenCache.set(userId, tokens.access_token, Math.round(tokens.expires_in * 0.75));

        console.log('       > Received an access token and refresh token');
        
        // Save the complete tokens object to token.json
        saveTokens(tokens);
        
        return tokens.access_token;
    } catch (e) {
        console.error(`       > Error exchanging ${exchangeProof.grant_type} for access token`, e);
        
        // More robust error handling
        if (e.response && e.response.body) {
            return JSON.parse(e.response.body);
        } else {
            return { message: e.message || 'Unknown error occurred during token exchange' };
        }
    }
};

const refreshAccessToken = async (userId) => {
    const refreshTokenProof = {
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        refresh_token: refreshTokenStore[userId]
    };
    return await exchangeForTokens(userId, refreshTokenProof);
};

const getAccessToken = async (userId) => {
    // If the access token has expired, retrieve
    // a new one using the refresh token
    if (!accessTokenCache.get(userId)) {
        console.log('Refreshing expired access token');
        await refreshAccessToken(userId);
    }
    return accessTokenCache.get(userId);
};

const isAuthorized = (userId) => {
    return refreshTokenStore[userId] ? true : false;
};

//====================================================//
//   Using an Access Token to Query the HubSpot API   //
//====================================================//

const getContact = async (accessToken) => {
    console.log('');
    console.log('=== Retrieving a contact from HubSpot using the access token ===');
    try {
        const headers = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };
        console.log('===> Replace the following request.get() to test other API calls');
        console.log('===> request.get(\'https://api.hubapi.com/contacts/v1/lists/all/contacts/all?count=1\')');
        const result = await request.get('https://api.hubapi.com/contacts/v1/lists/all/contacts/all?count=1', {
            headers: headers
        });

        return JSON.parse(result).contacts[0];
    } catch (e) {
        console.error('  > Unable to retrieve contact');
        return JSON.parse(e.response.body);
    }
};

//========================================//
//   Displaying information to the user   //
//========================================//

const { readSheetData } = require('./readthasheet');
const { uploadContactToHubspot } = require('./hubspot-upload');

app.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.write(`<h2>📤 Syncing contacts from sheet to HubSpot</h2>`);

  if (isAuthorized(DEFAULT_USER_ID)) {
    try {
      const accessToken = await getAccessToken(DEFAULT_USER_ID); // Get the access token
      const records = await readSheetData(); // Get data from the sheet

      if (!records.length) {
        res.write(`<p>❌ No records found in the sheet.</p>`);
        return res.end();
      }

      let successCount = 0;
      let failureCount = 0;

      // Add log collection
      let logDetails = '';

      // Loop over the records and upload to HubSpot
      for (const record of records) {
        const result = await uploadContactToHubspot(record, accessToken);

        // Capture detailed logs
        if (result) {
          successCount++;
          logDetails += `<p>✅ Contact added: ${record['First Name']} ${record['Last Name']}</p>`;
        } else {
          failureCount++;
          logDetails += `<p>❌ Skipped contact: ${record['First Name']} ${record['Last Name']}</p>`;
        }
      }

      // Display the results and detailed logs in the browser
      res.write(`<p>✅ Sync complete! ${successCount} succeeded, ${failureCount} failed.</p>`);
      res.write(`<h3>Details:</h3>`);
      res.write(logDetails); // Display detailed log

    } catch (err) {
      res.write(`<p>❌ Sync failed: ${err.message}</p>`);
    }
  } else {
    res.write(`<p>🔑 Not authorized. <a href="/install">Install the app</a></p>`);
  }

  res.end();
});
