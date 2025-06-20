const express = require('express');
const axios = require('axios');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const ForgeAPI = require('forge-apis');

// Use environment variables for Autodesk credentials
const CLIENT_ID = process.env.APS_CLIENT_ID;
const CLIENT_SECRET = process.env.APS_CLIENT_SECRET;

// Ensure credentials are provided
if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing APS_CLIENT_ID or APS_CLIENT_SECRET in environment variables.');
    // Optionally, throw an error or handle appropriately to prevent app from running without credentials
    // For now, we'll let it proceed, but calls requiring auth will fail.
}

const oAuth2TwoLegged = new ForgeAPI.AuthClientTwoLegged(CLIENT_ID, CLIENT_SECRET, ['data:read', 'bucket:read', 'viewables:read'], true);

// Autodesk Forge credentials - these should be stored securely in env variables
// For this example, we're using the values from the PowerShell script
const BUCKET_KEY = 'ifcviewer1744251930321';

// Cache for tokens to avoid requesting new ones too frequently
let tokenCache = {
  access_token: null,
  expires_at: null
};

// Get a Forge access token
async function getToken() {
  // Check if we have a valid token cached
  if (tokenCache.access_token && tokenCache.expires_at && tokenCache.expires_at > Date.now()) {
    console.log('Using cached Forge token');
    return tokenCache.access_token;
  }
  
  try {
    console.log('Requesting new Forge token');
    const response = await axios.post(
      'https://developer.api.autodesk.com/authentication/v2/token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'data:read data:write data:create bucket:read bucket:create viewables:read'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    // Cache the token
    const expiresIn = response.data.expires_in || 3600;
    tokenCache = {
      access_token: response.data.access_token,
      expires_at: Date.now() + (expiresIn * 1000 * 0.9) // 90% of actual expiry time for safety
    };
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Forge token:', error.message);
    throw error;
  }
}

// Endpoint to get token for client
router.get('/token', async (req, res) => {
  try {
    const token = await getToken();
    res.json({
      access_token: token,
      expires_in: Math.floor((tokenCache.expires_at - Date.now()) / 1000)
    });
  } catch (error) {
    console.error('Token endpoint error:', error);
    res.status(500).json({ error: 'Failed to get access token' });
  }
});

// Check model translation status
router.get('/modelDerivative/:urn/manifest', async (req, res) => {
  try {
    const { urn } = req.params;
    const token = await getToken();
    
    // Ensure URN is properly encoded
    const encodedUrn = urn.includes(':') ? urn.split(':').pop() : urn;
    
    const response = await axios.get(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodedUrn}/manifest`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    // Map the response to a simplified format
    const manifest = response.data;
    let status = 'unknown';
    let progress = 0;
    
    if (manifest.status === 'success') {
      status = 'success';
    } else if (manifest.status === 'failed') {
      status = 'failed';
    } else if (manifest.status === 'inprogress') {
      status = 'inprogress';
      // Calculate overall progress
      if (manifest.progress && typeof manifest.progress === 'string') {
        // Extract progress percentage if it's in format "n% complete"
        const match = manifest.progress.match(/(\d+)%/);
        if (match) {
          progress = parseInt(match[1], 10);
        }
      } else if (manifest.progress) {
        progress = manifest.progress;
      }
    }
    
    res.json({
      status,
      progress,
      urn: encodedUrn,
      derivatives: manifest.derivatives || []
    });
  } catch (error) {
    console.error('Error checking manifest:', error.message);
    if (error.response) {
      // If we get a 404, it could mean translation hasn't started
      if (error.response.status === 404) {
        return res.json({ status: 'pending', progress: 0 });
      }
      res.status(error.response.status).json({ 
        error: 'Failed to check translation status',
        details: error.response.data
      });
    } else {
      res.status(500).json({ error: 'Failed to check translation status' });
    }
  }
});

// Initiate translation process
router.post('/modelDerivative/:urn/jobs', async (req, res) => {
  try {
    const { urn } = req.params;
    const token = await getToken();
    
    // Ensure URN is properly encoded
    const encodedUrn = urn.includes(':') ? urn.split(':').pop() : urn;
    
    const translateData = {
      input: {
        urn: encodedUrn
      },
      output: {
        formats: [
          {
            type: "svf",
            views: ["2d", "3d"]
          }
        ]
      }
    };
    
    const response = await axios.post(
      'https://developer.api.autodesk.com/modelderivative/v2/designdata/job',
      translateData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-ads-force': 'true'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error initiating translation:', error.message);
    if (error.response) {
      res.status(error.response.status).json({ 
        error: 'Failed to start translation',
        details: error.response.data
      });
    } else {
      res.status(500).json({ error: 'Failed to start translation' });
    }
  }
});

// Upload a file using signed URLs
router.post('/buckets/:bucketKey/objects/:objectName/upload', async (req, res) => {
  try {
    const { bucketKey, objectName } = req.params;
    const filePath = req.body.filePath;
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Invalid or missing file path' });
    }
    
    const token = await getToken();
    
    // Step 1: Get signed URL
    const signedUrlResponse = await axios.get(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectName}/signeds3upload`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const uploadUrl = signedUrlResponse.data.urls[0];
    const uploadKey = signedUrlResponse.data.uploadKey;
    
    // Step 2: Upload to S3
    const fileContent = fs.readFileSync(filePath);
    await axios.put(uploadUrl, fileContent, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileContent.length
      }
    });
    
    // Step 3: Complete the upload
    const completeBody = {
      uploadKey: uploadKey
    };
    
    const completeResponse = await axios.post(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectName}/signeds3upload`,
      completeBody,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const objectId = completeResponse.data.objectId;
    const encodedUrn = Buffer.from(objectId).toString('base64').replace(/=/g, '');
    
    res.json({
      fileName: objectName,
      objectId: objectId,
      urn: encodedUrn,
      bucketKey: bucketKey
    });
  } catch (error) {
    console.error('Error in file upload process:', error.message);
    if (error.response) {
      res.status(error.response.status).json({ 
        error: 'File upload failed',
        details: error.response.data
      });
    } else {
      res.status(500).json({ error: 'File upload failed' });
    }
  }
});

// Reset token cache and generate a fresh token on server startup
(async function initializeToken() {
  try {
    console.log('[ForgeAPI] Initializing with fresh token...');
    // Reset token cache
    tokenCache = {
      access_token: null,
      expires_at: null
    };
    // Get a fresh token
    const token = await getToken();
    console.log('[ForgeAPI] Token successfully generated');
  } catch (error) {
    console.error('[ForgeAPI] Error generating initial token:', error.message);
  }
})();

// NEW ENDPOINT: Get signed S3 URL for file upload
router.get('/get-signed-upload-url', async (req, res) => {
  const { bucketKey, fileName } = req.query;

  if (!bucketKey || !fileName) {
    return res.status(400).json({ error: 'Missing bucketKey or fileName query parameters.' });
  }

  try {
    // 1. Get a server-side Autodesk token (using the existing getToken function)
    const serverSideToken = await getToken();

    if (!serverSideToken) {
      throw new Error('Failed to obtain server-side Autodesk token.');
    }

    // 2. Call Autodesk API to get the signed upload URL
    const encodedFileName = encodeURIComponent(fileName); // Ensure fileName is properly encoded for the URL
    const autodeskSignedUrlEndpoint = 
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodedFileName}/signeds3upload`;

    console.log(`[ForgeAPI /get-signed-upload-url] Requesting signed URL from: ${autodeskSignedUrlEndpoint}`);

    const autodeskResponse = await axios.get(autodeskSignedUrlEndpoint, {
      headers: {
        'Authorization': `Bearer ${serverSideToken}`
      }
    });

    // 3. Send the relevant data back to the frontend
    // Autodesk responds with data like: { uploadKey: "...", urls: ["s3_url"], url: "s3_url" }
    // The frontend expects something like: { urls: [s3_upload_url], uploadKey: ... }
    if (autodeskResponse.data && autodeskResponse.data.urls && autodeskResponse.data.urls[0] && autodeskResponse.data.uploadKey) {
      res.json({
        urls: autodeskResponse.data.urls,
        uploadKey: autodeskResponse.data.uploadKey
        // You can also include the 'url' field if your frontend uses it:
        // url: autodeskResponse.data.url
      });
    } else {
      console.error('[ForgeAPI /get-signed-upload-url] Invalid response structure from Autodesk:', autodeskResponse.data);
      throw new Error('Invalid response structure received from Autodesk for signed URL.');
    }

  } catch (error) {
    console.error('[ForgeAPI /get-signed-upload-url] Error:', error.message);
    if (error.response) {
      console.error('[ForgeAPI /get-signed-upload-url] Autodesk Error Response:', error.response.data);
      res.status(error.response.status || 500).json({ 
        error: 'Failed to get signed upload URL from Autodesk.',
        details: error.response.data 
      });
    } else {
      res.status(500).json({ error: 'Server error while getting signed upload URL.' });
    }
  }
});

// NEW ENDPOINT: Complete S3 upload
router.post('/complete-upload', async (req, res) => {
  const { bucketKey, objectName, uploadKey } = req.body;

  if (!bucketKey || !objectName || !uploadKey) {
    return res.status(400).json({ 
      error: 'Missing required parameters. bucketKey, objectName, and uploadKey are required.' 
    });
  }

  try {
    // Get server-side token
    const serverSideToken = await getToken();
    
    if (!serverSideToken) {
      throw new Error('Failed to obtain server-side Autodesk token.');
    }

    // Call Autodesk API to complete the upload
    const completeResponse = await axios.post(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectName}/signeds3upload`,
      { uploadKey },
      {
        headers: {
          'Authorization': `Bearer ${serverSideToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Get the object ID and create the URN
    const objectId = completeResponse.data.objectId;
    const encodedUrn = Buffer.from(objectId).toString('base64').replace(/=/g, '');

    res.json({
      objectId,
      urn: encodedUrn,
      bucketKey,
      objectName
    });

  } catch (error) {
    console.error('[ForgeAPI /complete-upload] Error:', error.message);
    if (error.response) {
      console.error('[ForgeAPI /complete-upload] Autodesk Error Response:', error.response.data);
      res.status(error.response.status || 500).json({ 
        error: 'Failed to complete upload.',
        details: error.response.data 
      });
    } else {
      res.status(500).json({ error: 'Server error while completing upload.' });
    }
  }
});

// NEW ENDPOINT: Start translation process
router.post('/start-translation', async (req, res) => {
  const { urn } = req.body;

  if (!urn) {
    return res.status(400).json({ error: 'Missing required URN parameter.' });
  }

  try {
    // Get server-side token
    const serverSideToken = await getToken();
    
    if (!serverSideToken) {
      throw new Error('Failed to obtain server-side Autodesk token.');
    }

    // Call Autodesk API to start translation
    const translateData = {
      input: {
        urn
      },
      output: {
        formats: [
          {
            type: "svf",
            views: ["2d", "3d"]
          }
        ]
      }
    };

    const translateResponse = await axios.post(
      'https://developer.api.autodesk.com/modelderivative/v2/designdata/job',
      translateData,
      {
        headers: {
          'Authorization': `Bearer ${serverSideToken}`,
          'Content-Type': 'application/json',
          'x-ads-force': 'true'
        }
      }
    );

    res.json({
      result: translateResponse.data.result,
      urn
    });

  } catch (error) {
    console.error('[ForgeAPI /start-translation] Error:', error.message);
    if (error.response) {
      console.error('[ForgeAPI /start-translation] Autodesk Error Response:', error.response.data);
      res.status(error.response.status || 500).json({ 
        error: 'Failed to start translation.',
        details: error.response.data 
      });
    } else {
      res.status(500).json({ error: 'Server error while starting translation.' });
    }
  }
});

// NEW ENDPOINT: Check translation status
router.get('/translation-status', async (req, res) => {
  const { urn } = req.query;

  if (!urn) {
    return res.status(400).json({ error: 'Missing required URN parameter.' });
  }

  try {
    // Get server-side token
    const serverSideToken = await getToken();
    
    if (!serverSideToken) {
      throw new Error('Failed to obtain server-side Autodesk token.');
    }

    // Call Autodesk API to check manifest/status
    const manifestResponse = await axios.get(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`,
      {
        headers: {
          'Authorization': `Bearer ${serverSideToken}`
        }
      }
    );

    // Forward the relevant parts of the response to the frontend
    res.json(manifestResponse.data);

  } catch (error) {
    console.error('[ForgeAPI /translation-status] Error:', error.message);
    if (error.response) {
      // If we get a 404, it could mean translation hasn't started
      if (error.response.status === 404) {
        return res.json({ status: 'pending', progress: 0 });
      }
      console.error('[ForgeAPI /translation-status] Autodesk Error Response:', error.response.data);
      res.status(error.response.status || 500).json({ 
        error: 'Failed to check translation status.',
        details: error.response.data 
      });
    } else {
      res.status(500).json({ error: 'Server error while checking translation status.' });
    }
  }
});

module.exports = router; 