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

// Helper function to delay execution for specified milliseconds
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
    return false; // Fail open to allow upload if search fails
  }
}

// Checks if a company with the given name exists
async function companyExists(companyName, accessToken) {
  const url = 'https://api.hubapi.com/crm/v3/objects/companies/search';
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const body = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'name',
            operator: 'EQ',
            value: companyName,
          },
        ],
      },
    ],
  };

  try {
    const response = await axios.post(url, body, { headers });
    return response.data.total > 0 ? response.data.results[0].id : null; // Return company ID if exists
  } catch (error) {
    logHubspotError(error);
    return null; // Fail open to allow creating a new company if search fails
  }
}

// Create a company if it doesn't exist
async function createCompany(companyName, accessToken) {
  const url = 'https://api.hubapi.com/crm/v3/objects/companies';
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const body = {
    properties: {
      name: companyName,
    },
  };

  try {
    const response = await axios.post(url, body, { headers });
    console.log(`✅ Created company: ${companyName}`);
    return response.data.id; // Return newly created company ID
  } catch (error) {
    logHubspotError(error);
    return null;
  }
}

// Associate the contact with the company using the correct association type
async function associateContactWithCompany(contactId, companyId, accessToken) {
  const associationTypeId = 1; // Association type ID for contact to company
  const url = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}/associations/company/${companyId}/contact_to_company`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  try {
    await axios.put(url, {}, { headers });
    console.log(`✅ Associated contact with company: ${companyId}`);
  } catch (error) {
    logHubspotError(error);
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

  const companyName = contactData['Company'];
  let companyId = await companyExists(companyName, accessToken);
  if (!companyId) {
    console.log(`🔄 Company not found, creating company: ${companyName}`);
    companyId = await createCompany(companyName, accessToken);
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
      company: companyName, // Adding company name to contact properties
      phone: contactData['Phone Number'], // Adding phone number
      lifecyclestage: contactData['Lifecycle Stage'], // Adding lifecycle stage
    },
  };

  try {
    // Adding rate limiting logic: Add delay before each request
    await delay(500); // 500 ms = 0.5 seconds delay between each request
    
    const response = await axios.post(url, body, { headers });
    console.log(`✅ Created contact: ${body.properties.firstname} ${body.properties.lastname}`);

    // Now associate the contact with the company
    const contactId = response.data.id;
    await associateContactWithCompany(contactId, companyId, accessToken);

    return response.data;
  } catch (error) {
    logHubspotError(error);
    return null;
  }
}

module.exports = {
  uploadContactToHubspot,
};
