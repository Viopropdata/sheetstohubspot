// hubspot-upload.js

const axios = require('axios');

// Logs detailed error info from HubSpot API responses
function logHubspotError(error) {
  if (error.response) {
    console.error('❌ HubSpot API error:', {
      status: error.response.status,
      data: error.response.data,
    });
  } else {
    console.error('❌ General error:', error.message);
  }
}

// Checks if a contact with this email already exists
async function contactExists(email, accessToken) {
  const url = 'https://api.hubapi.com/crm/v3/objects/contacts/search';
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const body = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'email',
            operator: 'EQ',
            value: email,
          },
        ],
      },
    ],
  };

  try {
    const response = await axios.post(url, body, { headers });
    return response.data.total > 0;
  } catch (error) {
    logHubspotError(error);
    return false; // fail open to allow upload if search fails
  }
}

// Uploads a contact with dedupe check based on email
async function uploadContactToHubspot(contactData, accessToken) {
  const email = contactData['Email'];
  if (!email) {
    console.log('⚠️  No email provided, skipping row.');
    return null;
  }

  const exists = await contactExists(email, accessToken);
  if (exists) {
    console.log(`🔁 Contact already exists, skipping: ${email}`);
    return null;
  }

  const url = 'https://api.hubapi.com/crm/v3/objects/contacts';
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const body = {
    properties: {
      firstname: contactData['First Name'],
      lastname: contactData['Last Name'],
      email: contactData['Email'],
      // future: add other fields here
    },
  };

  try {
    const response = await axios.post(url, body, { headers });
    console.log(`✅ Created contact: ${body.properties.firstname} ${body.properties.lastname}`);
    return response.data;
  } catch (error) {
    logHubspotError(error);
    return null;
  }
}

module.exports = {
  uploadContactToHubspot,
};
