const express = require('express');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ForgeAPI = require('forge-apis');
const FormData = require('form-data');
const sqlite3 = require('sqlite3').verbose();
const { spawn } = require('child_process');
require('dotenv').config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3001; // Use a different port than the frontend dev server

// Enable JSON parsing for POST requests
app.use(express.json());

// Set up multer for temporary file storage
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB file size limit
});

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  next();
});

// Import and use the Forge API router
// try {
//   const forgeRouter = require('./server/api/forge');
//   app.use('/api/forge', forgeRouter);
// } catch (error) {
//   console.error('[Server] Error setting up Forge API routes:', error.message);
// }

// Environment variables for APS credentials - fallback to hardcoded values if not set
const APS_CLIENT_ID = process.env.APS_CLIENT_ID ;
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET ;

// Initialize Forge SDK clients
const oauth2Client = new ForgeAPI.AuthClientTwoLegged(
  APS_CLIENT_ID, 
  APS_CLIENT_SECRET,
  ['data:read', 'data:write', 'data:create', 'bucket:read', 'bucket:create', 'viewables:read'],
  true
);

const bucketsApi = new ForgeAPI.BucketsApi();
const objectsApi = new ForgeAPI.ObjectsApi();
const derivativesApi = new ForgeAPI.DerivativesApi();

// Cache of authentication tokens
let tokenCache = {
  token: null,
  expiration: 0
};

// Function to get a 2-legged token from Autodesk Forge
async function getAccessToken() {
  const logPrefix = "[Server]"; 
  
  // Check if we have a valid cached token
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiration > now) {
    console.log(`${logPrefix} Using cached token, expires in ${Math.round((tokenCache.expiration - now)/1000)}s`);
    return tokenCache.token;
  }
  
  try {
    console.log(`${logPrefix} Requesting fresh APS token`);
    const credentials = await oauth2Client.authenticate();
    
    // Cache the token with expiration
    tokenCache = {
      token: credentials,
      expiration: Date.now() + credentials.expires_in * 1000 - 60000 // 1 minute buffer
    };
    
    console.log(`${logPrefix} Token received, expires in ${credentials.expires_in}s`);
    return credentials;
  } catch (error) {
    console.error(`${logPrefix} Error getting APS token:`, error.message);
    if (error.response?.data) {
      console.error(`${logPrefix} Error details:`, JSON.stringify(error.response.data));
    }
    throw new Error('Failed to obtain APS token from server.');
  }
}

// Ensure bucket exists for uploads
async function ensureBucketExists(bucketKey) {
  const logPrefix = "[Server]";
  const credentials = await getAccessToken();
  
  try {
    // Check if bucket exists
    await bucketsApi.getBucketDetails(bucketKey, oauth2Client, credentials);
    console.log(`${logPrefix} Bucket ${bucketKey} already exists`);
    return bucketKey;
  } catch (error) {
    // If bucket doesn't exist (404), create it
    if (error.statusCode === 404) {
      console.log(`${logPrefix} Bucket ${bucketKey} not found, creating...`);
      const bucketData = {
        bucketKey,
        policyKey: 'transient' // Use transient for testing, persistent for production
      };
      
      try {
        const result = await bucketsApi.createBucket(
          bucketData,
          {},
          oauth2Client,
          credentials
        );
        console.log(`${logPrefix} Bucket ${bucketKey} created successfully`);
        return bucketKey;
      } catch (createError) {
        console.error(`${logPrefix} Error creating bucket:`, createError.message);
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }
    } else {
      console.error(`${logPrefix} Error checking bucket:`, error.message);
      throw new Error(`Failed to check bucket: ${error.message}`);
    }
  }
}

// Route for the frontend to get a token
app.get('/api/auth/token', async (req, res) => {
  const logPrefix = "[Server]";
  console.log(`${logPrefix} Received request for /api/auth/token`);
  try {
    const credentials = await getAccessToken();
    res.json({
      access_token: credentials.access_token,
      expires_in: credentials.expires_in
    }); 
  } catch (error) {
    console.error(`${logPrefix} Error in /api/auth/token route:`, error.message);
    res.status(500).json({ error: 'Failed to retrieve APS token.' });
  }
});

// Upload file to Autodesk bucket using signed URLs
app.post('/api/models/upload', upload.single('file'), async (req, res) => {
  const logPrefix = "[Server]";
  console.log(`${logPrefix} Received upload request`);
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  if (!req.body.bucketKey) {
    return res.status(400).json({ error: 'BucketKey is required' });
  }
  
  const bucketKey = req.body.bucketKey;
  const filePath = req.file.path;
  const fileName = req.file.originalname || 'model.ifc';
  
  try {
    // Ensure bucket exists
    await ensureBucketExists(bucketKey);
    
    // Get credentials
    const credentials = await getAccessToken();
    
    // Get signed URL for upload
    console.log(`${logPrefix} Getting signed URL for ${fileName}`);
    const signedUrlResponse = await axios.get(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${fileName}/signeds3upload`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`
        }
      }
    );
    
    const uploadUrl = signedUrlResponse.data.urls[0];
    const uploadKey = signedUrlResponse.data.uploadKey;
    
    // Upload file to S3
    console.log(`${logPrefix} Uploading file to signed URL`);
    const fileContent = fs.readFileSync(filePath);
    await axios.put(uploadUrl, fileContent, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileContent.length
      }
    });
    
    // Complete the upload
    console.log(`${logPrefix} Completing the upload`);
    const completeBody = {
      uploadKey: uploadKey
    };
    
    const completeResponse = await axios.post(
      `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${fileName}/signeds3upload`,
      completeBody,
      {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Clean up the temp file
    fs.unlinkSync(filePath);
    
    const objectId = completeResponse.data.objectId;
    const urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');
    
    console.log(`${logPrefix} File uploaded successfully, objectId: ${objectId}`);
    
    res.json({
      bucketKey,
      objectId,
      urn,
      fileName
    });
    
  } catch (error) {
    console.error(`${logPrefix} Error uploading file:`, error.message);
    if (error.response) {
      console.error(`${logPrefix} Error status code:`, error.response.status);
      console.error(`${logPrefix} Error response:`, error.response.data);
    }
    
    // Clean up the temp file if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.status(500).json({ error: `File upload failed: ${error.message}` });
  }
});

// Translate model to viewable format
app.post('/api/models/translate', async (req, res) => {
  const logPrefix = "[Server]";
  console.log(`${logPrefix} Received translation request`);
  
  const { urn, filename } = req.body;
  
  if (!urn) {
    return res.status(400).json({ error: 'URN is required' });
  }
  
  try {
    // Get credentials
    const credentials = await getAccessToken();
    
    // Set up translation job
    const job = {
      input: {
        urn
      },
      output: {
        formats: [
          {
            type: 'svf',
            views: ['2d', '3d']
          }
        ]
      }
    };
    
    console.log(`${logPrefix} Starting translation job for URN: ${urn}`);
    
    // Start translation
    const translateResponse = await derivativesApi.translate(
      job,
      { xAdsForce: true },
      oauth2Client,
      credentials
    );
    
    console.log(`${logPrefix} Translation job started:`, JSON.stringify(translateResponse.body));
    
    res.json({
      urn,
      jobId: translateResponse.body.result,
      status: 'pending'
    });
    
  } catch (error) {
    console.error(`${logPrefix} Error starting translation:`, error);
    if (error.response) {
      console.error(`${logPrefix} Detailed error:`, error.response.body);
    }
    res.status(500).json({ error: `Translation failed: ${error.message}` });
  }
});

// Check translation status
app.get('/api/models/:urn/status', async (req, res) => {
  const logPrefix = "[Server]";
  const { urn } = req.params;
  
  console.log(`${logPrefix} Checking translation status for URN: ${urn}`);
  
  if (!urn) {
    return res.status(400).json({ error: 'URN is required' });
  }
  
  try {
    // Get credentials
    const credentials = await getAccessToken();
    
    // Check manifest
    const manifestResponse = await derivativesApi.getManifest(
      urn,
      {},
      oauth2Client,
      credentials
    );
    
    const manifest = manifestResponse.body;
    console.log(`${logPrefix} Translation status: ${manifest.status}`);
    
    res.json({
      urn,
      status: manifest.status,
      progress: manifest.progress,
      derivatives: manifest.derivatives
    });
    
  } catch (error) {
    console.error(`${logPrefix} Error checking translation:`, error.message);
    res.status(500).json({ error: `Failed to check translation: ${error.message}` });
  }
});

// Serve static files from the public directory
app.use(express.static('public'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('./uploads')){
  fs.mkdirSync('./uploads');
}

// Serve the chat interface
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Define the database path
// const dbPath = path.join(__dirname, 'database', 'primavera_p6.db'); // Old relative path
const dbPath = 'C:/Users/kvsha/Desktop/New folder (3)/mydata.db'; // Updated to use your new database with views

// Ensure the directory exists (optional, but good practice)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`[Server] Database directory created: ${dbDir}`);
  } catch (err) {
    console.error(`[Server] Error creating database directory ${dbDir}:`, err);
    // Decide if you want to exit or continue if directory creation fails
  }
}

// Connect to the SQLite database
let db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log(`[Server] Connected to SQLite database at ${dbPath}`);
  initializeUploadHistoryTable(); // Initialize history table on connection
});

// API endpoint to get all tables from the database
app.get('/api/database/tables', (req, res) => {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      return res.status(500).json({ error: 'Failed to connect to database' });
    }
    
    db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, tables) => {
      if (err) {
        console.error('Error fetching tables:', err.message);
        return res.status(500).json({ error: 'Failed to fetch tables' });
      }
      
      db.close();
      res.json(tables);
    });
  });
});

// API endpoint to get all projects (ID and Name)
app.get('/api/database/projects', (req, res) => {
  const logPrefix = '[Server /api/database/projects]';
  const query = `SELECT proj_id, proj_short_name AS proj_name FROM PROJECT ORDER BY proj_short_name;`;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error(`${logPrefix} Error fetching projects:`, err.message);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

    res.json(rows);
  });
});

// API endpoint to get data from a specific table
app.get('/api/database/table/:tableName', (req, res) => {
  const logPrefix = '[Server /api/database/table]';
  const tableName = req.params.tableName;
  const projectId = req.query.projectId || req.query.proj_id; // Accept both parameters for compatibility

  // Basic validation to prevent SQL injection via table name
  // Allow only alphanumeric characters and underscores
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    console.error(`${logPrefix} Invalid table name format received: ${tableName}`);
    return res.status(400).json({ error: 'Invalid table name format.' });
  }

  let query = `SELECT * FROM "${tableName}"`; // Quote table name
  const params = [];

  // Add project filter if projectId is provided and the table is likely project-specific
  // Add more tables here if they have a 'proj_id' column
  const projectSpecificTables = ['TASK', 'PROJWBS', 'TASKPRED', 'PROJECT']; 
  if (projectId && projectSpecificTables.includes(tableName.toUpperCase())) {
      // Convert projectId to integer if possible
      let projectIdParam;
      try {
        // Parse as integer if possible
        projectIdParam = parseInt(projectId, 10);
        if (isNaN(projectIdParam)) {
          // If not a valid integer, use the original string
          projectIdParam = projectId;
        }
      } catch (e) {
        projectIdParam = projectId;
      }
      
      console.log(`${logPrefix} Using projectId parameter: ${projectIdParam}`);
      
      // Special handling for TASK table to include ACTVCODE information
      if (tableName.toUpperCase() === 'TASK') {
        query = `
          WITH RECURSIVE ActivityHierarchy AS (
            SELECT
                a.actv_code_id,
                a.actv_code_type_id,
                a.actv_code_name,
                a.short_name,
                a.parent_actv_code_id,
                0 as level,
                CAST(a.short_name AS VARCHAR(1000)) as hierarchy_path
            FROM ACTVCODE a
            WHERE nullif(a.parent_actv_code_id,'') IS NULL

            UNION ALL

            SELECT
                c.actv_code_id,
                c.actv_code_type_id,
                c.actv_code_name,
                c.short_name,
                c.parent_actv_code_id,
                p.level + 1,
                CAST(p.hierarchy_path || ' > ' || c.short_name AS VARCHAR(1000))
            FROM ACTVCODE c
            INNER JOIN ActivityHierarchy p ON c.parent_actv_code_id = p.actv_code_id
          )
          select at.actv_code_type, ta.*, t.task_code, t.task_name, h.* 
          from TASKACTV ta
          left join ActivityHierarchy h on ta.actv_code_id = h.actv_code_id
          Left join TASK t on t.task_id = ta.task_id and t.proj_id = ta.proj_id
          left join ACTVTYPE at on at.actv_code_type_id = h.actv_code_type_id
          where 
          at.actv_code_type like '%AWP %' 
          and ta.proj_id = ?
          order by ta.task_id
        `;
      } else {
        // Assuming the column name is 'proj_id'
        query += ` WHERE proj_id = ?`;
      }
      params.push(projectIdParam);
  }

  console.log(`${logPrefix} Executing query: ${query} with params: ${params}`);

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error(`${logPrefix} Error fetching data from ${tableName}:`, err.message);
      return res.status(500).json({ error: `Failed to fetch data from ${tableName}` });
    }
    
    res.json(rows);
  });
});

// API endpoint to get activities for Gantt chart
app.get('/api/gantt/activities', (req, res) => {
  const logPrefix = '[Server /api/gantt/activities]';
  const { projectId, statusFilter, criticalOnly, lookAhead, sortBy, sortOrder = 'ASC' } = req.query;

  if (!projectId) {
    console.error(`${logPrefix} Project ID is required.`);
    return res.status(400).json({ error: 'Project ID is required' });
  }

  // Convert projectId to integer if possible
  let projectIdParam;
  try {
    // Parse as integer if possible
    projectIdParam = parseInt(projectId, 10);
    if (isNaN(projectIdParam)) {
      // If not a valid integer, use the original string
      projectIdParam = projectId;
    }
  } catch (e) {
    projectIdParam = projectId;
  }
  
  console.log(`${logPrefix} Using projectId parameter: ${projectIdParam}`);

  // Validate sortBy column to prevent SQL injection
  const validSortColumns = ['task_id', 'task_code', 'task_name', 'target_start_date', 'target_end_date', 'remain_drtn_hr_cnt', 'status_code', 'driving_path_flag'];
  const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'target_start_date'; // Default sort is target_start_date
  const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  let query = `
    SELECT
      task_id,
      task_code,
      task_name,
      target_start_date AS startDate,
      target_end_date AS endDate,
      remain_drtn_hr_cnt AS duration, -- Or total_float_hr_cnt? Check XER definition
      status_code AS status,
      driving_path_flag AS critical, -- Use driving_path_flag
      wbs_id -- Include wbs_id
    FROM TASK
    WHERE proj_id = ?
  `;
  const params = [projectIdParam]; // Use the parsed/cleaned projectId

  // Apply Status Filter
  if (statusFilter && statusFilter !== 'All') {
    query += ` AND status_code = ?`;
    params.push(statusFilter);
  }

  // Apply Critical Only Filter
  // In P6 XER, driving_path_flag is often 'Y' for critical, 'N' otherwise
  if (criticalOnly === 'true') {
    query += ` AND driving_path_flag = 'Y'`;
  }

  // Apply Look Ahead Filter
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format might vary based on DB

  if (lookAhead && lookAhead !== 'all') {
      // Use a simplified but robust approach for date filtering
      let lookAheadDate = new Date(today);
      if (lookAhead === 'day') {
          // No change needed, effectively filters for today or later
      } else if (lookAhead === 'week') {
          lookAheadDate.setDate(today.getDate() + 7);
      } else if (lookAhead === 'month') {
          lookAheadDate.setMonth(today.getMonth() + 1);
      } else if (lookAhead === 'year') {
          lookAheadDate.setFullYear(today.getFullYear() + 1);
      }
      
      // Simple date filter: show tasks that start BEFORE the look-ahead date
      // This is more robust than complex date string comparison
      query += ` AND target_start_date IS NOT NULL`; // Ensure the date field has a value
      
      // Add the date filter
      const lookAheadDateStr = lookAheadDate.toISOString();
      console.log(`${logPrefix} Using lookAhead date: ${lookAheadDateStr}`);
      query += ` AND target_start_date <= ?`;
      params.push(lookAheadDateStr);
  }

  query += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;

  // Enhanced logging before execution
  console.log(`${logPrefix} Final Query:
${query}
Params: ${JSON.stringify(params)}`);

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error(`${logPrefix} Error executing query:`, err.message);
      // Return the actual DB error in the response for debugging
      return res.status(500).json({ error: `Failed to fetch activities: ${err.message}` });
    }
    
    console.log(`[Server] Sending ${rows.length} filtered activities for Gantt.`);
    res.json(rows);
  });
});

// --- API Endpoints for Gantt Filters ---

// API endpoint to get distinct task statuses for a project
app.get('/api/gantt/statuses', (req, res) => {
    const projectId = req.query.projectId;
    console.log(`[Server] Request for distinct statuses for Project: ${projectId}`);

    if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
    }

    const query = `SELECT DISTINCT status_code FROM TASK WHERE proj_id = ? ORDER BY status_code`;
    
    // Convert projectId to integer if possible
    let projectIdParam;
    try {
        // Parse as integer if possible
        projectIdParam = parseInt(projectId, 10);
        if (isNaN(projectIdParam)) {
            // If not a valid integer, use the original string
            projectIdParam = projectId;
        }
    } catch (e) {
        projectIdParam = projectId;
    }
    
    console.log(`[Server] Using projectId parameter: ${projectIdParam}`);
    
    db.all(query, [projectIdParam], (err, rows) => {
        if (err) {
            console.error('[Server] Error fetching distinct statuses:', err.message);
            return res.status(500).json({ error: 'Failed to fetch statuses' });
        }
        res.json(rows.map(r => r.status_code)); // Return array of strings
    });
});

// --- Critical Path Method (CPM) Calculation API ---

// Helper function to perform CPM calculations
async function calculateCPM(projectId, dbPath) {
    const logPrefix = `[Server calculateCPM projectId=${projectId}]`;
    console.log(`${logPrefix} Starting CPM calculation.`);

    let cpmDb; // Define db variable outside try/finally blocks

    // Helper to run DB queries within calculateCPM
    const queryDb = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            if (!cpmDb) {
                return reject(new Error("CPM DB connection is not available."));
            }
            // Use .all for simplicity, even for single row queries (.get behavior)
            cpmDb.all(sql, params, (err, rows) => {
                if (err) {
                    console.error(`${logPrefix} DB Query Error: ${err.message}. SQL: ${sql.substring(0, 100)}`, params);
                    reject(new Error(`DB Query Error: ${err.message}`));
                } else {
                    resolve(rows); // Always resolve with rows array
                }
            });
        });
    };

    try {
        // Establish DB connection
        cpmDb = await new Promise((resolve, reject) => {
            const dbInstance = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    console.error(`${logPrefix} Failed to open database:`, err.message);
                    reject(new Error(`Failed to connect to database: ${err.message}`));
                } else {
                    console.log(`${logPrefix} Database connected successfully for CPM.`);
                    resolve(dbInstance);
                }
            });
        });

        let calculationStatus = "Success"; // Track status

        // Fetch data using the helper
        const projectInfoRows = await queryDb('SELECT plan_start_date FROM PROJECT WHERE proj_id = ?', [projectId]);
        const projectInfo = projectInfoRows[0] || {}; // Get first row or empty object
        
        // --- Use the hierarchical query to fetch tasks with WBS path ---
        const hierarchicalQuery = `
        WITH RECURSIVE WBStructure (wbs_id, parent_wbs_id, wbs_name, level, path) AS (
            -- Anchor member: Select top-level WBS elements for Project
            SELECT p.wbs_id, p.parent_wbs_id, p.wbs_name, 0 AS level, CAST(p.wbs_name AS TEXT) AS path
            FROM PROJWBS p
            WHERE p.proj_id = ? AND (
                p.parent_wbs_id IS NULL OR 
                NOT EXISTS (SELECT 1 FROM PROJWBS parent WHERE parent.wbs_id = p.parent_wbs_id)
            )
            UNION ALL
            -- Recursive member: Select children WBS elements within Project
            SELECT p_child.wbs_id, p_child.parent_wbs_id, p_child.wbs_name, cte.level + 1, cte.path || ' > ' || p_child.wbs_name
            FROM PROJWBS p_child
            INNER JOIN WBStructure cte ON p_child.parent_wbs_id = cte.wbs_id
            WHERE p_child.proj_id = ?
        )
        -- Final selection joining WBS hierarchy with TASK data
        SELECT 
            t.task_id, t.task_code, t.task_name, t.target_drtn_hr_cnt, 
            wbs.path AS wbs_path -- Select the constructed WBS path
            -- Add other fields from TASK or WBStructure if needed by CPM calculation, 
            -- but keep it minimal to what's required (task_id, name, duration are key)
        FROM TASK t
        INNER JOIN WBStructure wbs ON t.wbs_id = wbs.wbs_id
        WHERE t.proj_id = ?
        `;
        // Note: The query needs projectId 3 times
        const tasks = await queryDb(hierarchicalQuery, [projectId, projectId, projectId]);
        // --- End of new query ---

        // const tasks = await queryDb('SELECT task_id, task_code, task_name, target_drtn_hr_cnt FROM TASK WHERE proj_id = ?', [projectId]); // Old query
        const predecessors = await queryDb('SELECT task_id, pred_task_id, pred_type, lag_hr_cnt FROM TASKPRED WHERE proj_id = ?', [projectId]);

        console.log(`${logPrefix} Fetched ${tasks.length} tasks (with WBS paths) and ${predecessors.length} relationships.`);

        if (tasks.length === 0) {
            console.log(`${logPrefix} No tasks found for project. Returning empty results.`);
            // Ensure DB is closed before returning early
             if (cpmDb) { 
                 await new Promise(res => cpmDb.close(err => {
                      if (err) console.error(`${logPrefix} Error closing DB early:`, err.message);
                      res();
                 }));
             }
            return { cpmResults: [], projectEndDate: 0, calculationStatus: "Success" };
        }

        // --- CPM Calculation Logic --- 
        const tasksMap = new Map();
        const successorsMap = new Map(); 
        const predecessorsMap = new Map();

        tasks.forEach(task => {
             tasksMap.set(task.task_id, {
                task_id: task.task_id,
                code: task.task_code,
                name: task.task_name,
                wbs_path: task.wbs_path,
                duration: parseFloat(task.target_drtn_hr_cnt) || 0, // Explicitly parse and fallback
                es: 0, ef: 0, ls: Infinity, lf: Infinity, totalFloat: Infinity, // Initialize
                predecessors: [], // Store IDs of predecessors
                successors: [], // Store IDs of successors
                isCritical: false
            });
            successorsMap.set(task.task_id, []);
            predecessorsMap.set(task.task_id, []);
        });

        predecessors.forEach(predLink => {
             const task = tasksMap.get(predLink.task_id);
            const predecessorTask = tasksMap.get(predLink.pred_task_id);
            const lag = parseFloat(predLink.lag_hr_cnt) || 0; // Ensure lag is a number
            const type = predLink.pred_type || 'FS'; // Default to FS if null

            if (task && predecessorTask) {
                const predInfo = { task_id: predLink.pred_task_id, type, lag };
                const succInfo = { task_id: predLink.task_id, type, lag };
                
                task.predecessors.push(predInfo); // Track for calculation
                predecessorTask.successors.push(succInfo); // Track for calculation
                
                predecessorsMap.get(task.task_id).push({ predId: predecessorTask.task_id, type, lag });
                successorsMap.get(predecessorTask.task_id).push({ succId: task.task_id, type, lag });
            }
        });
        
        const startNodes = tasks.filter(t => predecessorsMap.get(t.task_id)?.length === 0).map(t => t.task_id);
        const endNodes = tasks.filter(t => successorsMap.get(t.task_id)?.length === 0).map(t => t.task_id);
        console.log(`${logPrefix} Found ${startNodes.length} start nodes and ${endNodes.length} end nodes.`);

        // -- Forward Pass --
        console.log(`${logPrefix} Starting Forward Pass...`);
        let forwardChanged = true;
        let forwardIterations = 0;
        const maxIterations = tasks.length * 2; 

        while (forwardChanged && forwardIterations < maxIterations) {
             forwardChanged = false;
            forwardIterations++;
            // let tasksUpdatedInForwardPass = [];

            for (const task of tasksMap.values()) {
                let currentES = task.es;
                let newES = 0;
                if (startNodes.includes(task.task_id)) {
                    newES = 0;
                } else {
                    const preds = predecessorsMap.get(task.task_id) || [];
                    if (preds.length === 0 && !startNodes.includes(task.task_id)) {
                        newES = 0;
                    }
                    for (const predLink of preds) {
                        const predTask = tasksMap.get(predLink.predId);
                        if (predTask) {
                            let potentialES = 0;
                            const predEF = task.duration === Infinity ? Infinity : (typeof predTask.ef === 'number' && !isNaN(predTask.ef) && isFinite(predTask.ef)) ? predTask.ef : 0;
                            const predES = task.duration === Infinity ? Infinity : (typeof predTask.es === 'number' && !isNaN(predTask.es) && isFinite(predTask.es)) ? predTask.es : 0;
                           // const taskDur = task.duration;
                            const linkLag = predLink.lag;

                            switch (predLink.type) {
                                case 'SS': potentialES = predES + linkLag; break;
                                case 'FS': 
                                case 'FF': // Simplified
                                case 'SF': // Simplified
                                default:   potentialES = predEF + linkLag; break;
                            }
                            newES = Math.max(newES, potentialES);
                        }
                    }
                }
                
                const newEF = task.duration === Infinity ? Infinity : newES + task.duration;
                
                if (isNaN(newES) || isNaN(newEF)) {
                    console.error(`${logPrefix} NaN detected for task ${task.code || task.task_id}. ES=${newES}, EF=${newEF}.`);
                    calculationStatus = "Error: NaN detected during forward pass calculation.";
                    forwardChanged = false;
                    break; 
                }
                if (!isFinite(newES) || !isFinite(newEF)) {
                     console.warn(`${logPrefix} Infinity detected for task ${task.code || task.task_id}. ES=${newES}, EF=${newEF}.`);
                     // Allow Infinity to propagate if duration is Infinity
                }

                if (task.es !== newES || task.ef !== newEF) {
                    // tasksUpdatedInForwardPass.push({id: task.code || task.task_id, oldES: task.es, newES, oldEF: task.ef, newEF });
                    task.es = newES;
                    task.ef = newEF;
                    forwardChanged = true;
                }
            }
            if (calculationStatus.startsWith("Error: NaN")) { break; }
            // if (forwardChanged) { console.log(`${logPrefix} Fwd Iter ${forwardIterations} updated ${tasksUpdatedInForwardPass.length} tasks.`); }
        }
         
         if (calculationStatus === "Success" && forwardIterations >= maxIterations) {
            console.error(`${logPrefix} Forward pass reached max iterations.`);
            calculationStatus = "Warning: Forward pass failed to converge (cycle likely)";
         }
         if (!calculationStatus.startsWith("Error: NaN")) {
             console.log(`${logPrefix} Forward Pass completed in ${forwardIterations} iterations.`);
         }

        const projectEndDate = Math.max(0, ...Array.from(tasksMap.values()).map(t => (!isNaN(t.ef) && isFinite(t.ef) ? t.ef : 0)));
        console.log(`${logPrefix} Calculated Project End Date (hours): ${projectEndDate}`);

        // -- Backward Pass --
        console.log(`${logPrefix} Starting Backward Pass...`);
        for (const task of tasksMap.values()) {
             task.lf = task.duration === Infinity ? Infinity : projectEndDate; // Initialize LF
             task.ls = task.lf === Infinity ? Infinity : task.lf - task.duration; // Initialize LS
        }

        let backwardChanged = true;
        let backwardIterations = 0;
        while (backwardChanged && backwardIterations < maxIterations) {
             backwardChanged = false;
            backwardIterations++;
            const taskIds = Array.from(tasksMap.keys()).sort((a, b) => b - a);
            for (const taskId of taskIds) {
                 const task = tasksMap.get(taskId);
                 // Skip if duration is infinity - its LF/LS should remain Infinity
                 if (task.duration === Infinity) continue;

                 let currentLF = task.lf;
                 let newLF = projectEndDate;

                if (endNodes.includes(task.task_id)) {
                    newLF = projectEndDate;
                } else {
                     const successors = successorsMap.get(task.task_id) || [];
                     if (successors.length === 0 && !endNodes.includes(task.task_id)) {
                         newLF = projectEndDate;
                     } else {
                         let minPotentialLF = projectEndDate; // Initialize with project end
                         if (successors.length === 0) { // Should have been caught by endNodes check, but safety
                             minPotentialLF = projectEndDate;
                         } else {
                             minPotentialLF = Infinity; // Start with infinity for minimization
                             for (const succLink of successors) {
                                 const succTask = tasksMap.get(succLink.succId);
                                 if (succTask) {
                                     let potentialLF = Infinity; // Default to infinity
                                     const succLS = (typeof succTask.ls === 'number' && !isNaN(succTask.ls) && isFinite(succTask.ls)) ? succTask.ls : Infinity;
                                     const succLF = (typeof succTask.lf === 'number' && !isNaN(succTask.lf) && isFinite(succTask.lf)) ? succTask.lf : Infinity;
                                     const succES = (typeof succTask.es === 'number' && !isNaN(succTask.es) && isFinite(succTask.es)) ? succTask.es : 0;
                                     const taskDur = task.duration;
                                     const linkLag = succLink.lag;
                                     
                                     // Calculate potential LF based on successor's LS/LF/ES
                                     switch (succLink.type) {
                                         case 'SS': 
                                             potentialLF = succLS === Infinity ? Infinity : succLS - linkLag + taskDur; 
                                             break; 
                                         case 'FF': 
                                             potentialLF = succLF === Infinity ? Infinity : succLF - linkLag; 
                                             break; 
                                         case 'SF': 
                                             potentialLF = succES === Infinity ? Infinity : succES - linkLag; 
                                             break; 
                                         case 'FS': 
                                         default:   
                                             potentialLF = succLS === Infinity ? Infinity : succLS - linkLag; 
                                             break;
                                     }
                                     // Use Math.min, ensuring we don't compare with initial Infinity if valid values exist
                                     if (isFinite(potentialLF)) { 
                                         minPotentialLF = Math.min(minPotentialLF, potentialLF);
                                     }
                                 }
                             }
                             // If minPotentialLF is still Infinity (e.g., all successors had infinite LS/LF), set to projectEndDate
                              if (!isFinite(minPotentialLF)) { 
                                   minPotentialLF = projectEndDate;
                               }
                         }
                         newLF = minPotentialLF;
                     }
                 }

                const newLS = task.duration === Infinity ? Infinity : newLF - task.duration;

                // Check for NaN/Infinity during backward pass
                 if (isNaN(newLS) || isNaN(newLF)) { // Should not happen with Infinity checks, but safety
                    console.warn(`${logPrefix} NaN LS/LF calculated for task ${task.code || task.task_id}. LS=${newLS}, LF=${newLF}.`);
                    newLF = projectEndDate;
                    newLS = newLF === Infinity ? Infinity : newLF - task.duration;
                 }
                 // Check if became Infinite unexpectedly
                 if (!isFinite(newLS) && isFinite(task.ls)) console.warn(`${logPrefix} Task ${task.code} LS became non-finite.`);
                 if (!isFinite(newLF) && isFinite(task.lf)) console.warn(`${logPrefix} Task ${task.code} LF became non-finite.`);


                if (task.lf !== newLF || task.ls !== newLS) {
                    task.lf = newLF;
                    task.ls = newLS;
                    backwardChanged = true;
                }
            }
        }
         if (backwardIterations >= maxIterations) {
             console.error(`${logPrefix} Backward pass reached max iterations.`);
             if (calculationStatus === "Success") {
                 calculationStatus = "Warning: Backward pass failed to converge (cycle likely)";
             }
         }
         console.log(`${logPrefix} Backward Pass completed in ${backwardIterations} iterations.`);

        // -- Calculate Total Float and Identify Critical Path --
        const floatThreshold = 0.1; // hours
        for (const task of tasksMap.values()) {
             const ls = task.ls;
             const es = task.es;
            if (!isFinite(ls) || !isFinite(es)) {
               task.totalFloat = Infinity;
               task.isCritical = false;
            } else {
                task.totalFloat = ls - es; 
                task.isCritical = task.totalFloat <= floatThreshold;
            }
        }

        const cpmResults = Array.from(tasksMap.values());
        
        return { cpmResults, projectEndDate, calculationStatus }; 

    } catch (error) {
        console.error(`${logPrefix} Error during CPM calculation process:`, error);
        throw error; // Re-throw the error for the calling endpoint handler
    } finally {
        // Ensure the database connection is closed regardless of success or failure
        if (cpmDb) {
            console.log(`${logPrefix} Closing CPM DB connection in finally block.`);
            try {
                await new Promise((resolve, reject) => {
                    cpmDb.close(err => {
                        if (err) {
                            console.error(`${logPrefix} Error closing CPM DB:`, err.message);
                            reject(err); // Optional: reject?
                        } else {
                            console.log(`${logPrefix} CPM DB connection closed successfully.`);
                            resolve();
                        }
                    });
                });
            } catch (closeError) {
                 console.error(`${logPrefix} Exception while trying to close CPM DB:`, closeError);
            }
        }
    }
}

// API endpoint for CPM calculation
app.get('/api/cpm/:projectId', async (req, res) => {
    const projectId = req.params.projectId;
    console.log(`[Server] Request for CPM Calculation for Project: ${projectId}`);

    if (!projectId) {
        return res.status(400).json({ success: false, error: 'Project ID is required' });
    }

    try {
        // Destructure the results and the status message
        const { cpmResults, calculationStatus } = await calculateCPM(projectId, dbPath);
        
        const message = calculationStatus === "Success" ? 
            `CPM Calculation completed for Project ${projectId}. Found ${cpmResults.filter(t => t.isCritical).length} critical tasks.` : 
            `CPM Calculation for Project ${projectId} finished with status: ${calculationStatus}. Found ${cpmResults.filter(t => t.isCritical).length} critical tasks (results may be inaccurate).`;
        console.log(`[Server] ${message}`);
        
        // Return success (endpoint ran), the data, and the calculation status
        res.json({ success: true, status: calculationStatus, data: cpmResults }); 
    } catch (error) {
        console.error(`[Server] Error during CPM calculation for Project ${projectId}:`, error);
        res.status(500).json({ success: false, status: "Error", error: error.message || 'Failed to perform CPM calculation' });
    }
});

// Ensure uploads directory exists (used by multer)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
  fs.mkdirSync(uploadsDir);
}

// Configure Multer for XER file uploads
const xerUpload = multer({ 
  dest: uploadsDir, // Temporary storage path
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    // Accept only .xer files
    if (!file.originalname.toLowerCase().endsWith('.xer')) {
      return cb(new Error('Only .xer files are allowed'), false);
    }
    cb(null, true);
  }
});

// Function to create UPLOAD_HISTORY table if it doesn't exist
function initializeUploadHistoryTable() {
  const logPrefix = '[Server initializeUploadHistoryTable]';
  const createTableSql = `
      CREATE TABLE IF NOT EXISTS UPLOAD_HISTORY (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL,
          upload_user TEXT,
          upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT CHECK(status IN ('Success', 'Failure')) NOT NULL,
          message TEXT
      );
  `;
  // Use the global db connection
  db.run(createTableSql, (err) => {
      if (err) {
          console.error(`${logPrefix} Error creating UPLOAD_HISTORY table:`, err.message);
      } else {
          console.log(`${logPrefix} UPLOAD_HISTORY table checked/created successfully.`);
      }
  });
}

// Function to insert upload history record
async function recordUploadHistory(filename, user = 'System', status, message = '') {
     const logPrefix = '[Server recordUploadHistory]';
     const insertSql = `
        INSERT INTO UPLOAD_HISTORY (filename, upload_user, status, message)
        VALUES (?, ?, ?, ?);
     `;
     // Ensure message is not excessively long (e.g., limit to 1000 chars)
     const truncatedMessage = message.length > 1000 ? message.substring(0, 997) + '...' : message;

     // Use a separate connection for logging to avoid conflicts? Or use global db?
     // Using global db for now. Consider dedicated logger db connection if issues arise.
     // const logDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => { ... });
     // logDb.run(...)
     // logDb.close()

     return new Promise((resolve, reject) => {
         db.run(insertSql, [filename, user, status, truncatedMessage], function(err) {
             if (err) {
                 console.error(`${logPrefix} Error inserting record into UPLOAD_HISTORY:`, err.message);
                 reject(err);
             } else {
                 console.log(`${logPrefix} Recorded upload attempt for ${filename} with status ${status}. ID: ${this.lastID}`);
                 resolve(this.lastID);
             }
         });
     });
}

// API endpoint to handle XER file upload and parsing
app.post('/api/xer/upload', xerUpload.single('xerFile'), async (req, res) => {
  const logPrefix = '[Server /api/xer/upload]';
  console.log(`${logPrefix} Received XER upload request.`);

  if (!req.file) {
    console.error(`${logPrefix} No file uploaded.`);
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  const tempFilePath = req.file.path;
  const originalFilename = req.file.originalname;
  const pythonScriptPath = path.join(__dirname, 'parse_xer_content.py'); // Assuming script is in root
  const currentDbPath = dbPath; // Use the global dbPath defined earlier

  console.log(`${logPrefix} File temporary path: ${tempFilePath}`);
  console.log(`${logPrefix} Original filename: ${originalFilename}`);
  console.log(`${logPrefix} Python script path: ${pythonScriptPath}`);
  console.log(`${logPrefix} Database path: ${currentDbPath}`);

  // Ensure the Python script exists
  if (!fs.existsSync(pythonScriptPath)) {
      const errorMsg = `Python parser script not found at ${pythonScriptPath}`;
      console.error(`${logPrefix} ${errorMsg}`);
      fs.unlinkSync(tempFilePath); // Clean up uploaded file
      await recordUploadHistory(originalFilename, 'System', 'Failure', errorMsg);
      return res.status(500).json({ success: false, message: errorMsg });
  }
   // Ensure the dbPath is accessible (basic check)
  // const dbDir = path.dirname(currentDbPath);
  // if (!fs.existsSync(dbDir)) {
  //      const errorMsg = `Database directory does not exist: ${dbDir}`;
  //      console.error(`${logPrefix} ${errorMsg}`);
  //      fs.unlinkSync(tempFilePath);
  //      await recordUploadHistory(originalFilename, 'System', 'Failure', errorMsg);
  //      return res.status(500).json({ success: false, message: errorMsg });
  // }

  let pythonOutput = '';
  let pythonError = '';

  try {
      const pythonProcess = spawn('python', [pythonScriptPath, tempFilePath, currentDbPath]);

      pythonProcess.stdout.on('data', (data) => {
          const outputChunk = data.toString();
          pythonOutput += outputChunk;
          console.log(`${logPrefix} Python stdout: ${outputChunk.trim()}`);
      });

      pythonProcess.stderr.on('data', (data) => {
          const errorChunk = data.toString();
          pythonError += errorChunk;
          console.error(`${logPrefix} Python stderr: ${errorChunk.trim()}`);
      });

      pythonProcess.on('close', async (code) => {
          console.log(`${logPrefix} Python script finished with code ${code}`);
          let historyStatus = 'Failure';
          let responseMessage = '';

          if (code === 0 && !pythonError) { // Success only if exit code is 0 AND no stderr output
               historyStatus = 'Success';
               responseMessage = `Successfully parsed and inserted data from ${originalFilename}. ${pythonOutput.trim()}`;
               console.log(`${logPrefix} ${responseMessage}`);
               await recordUploadHistory(originalFilename, 'Shrey', historyStatus, pythonOutput.trim() + (pythonError ? ` | Error: ${pythonError.trim()}` : '') );
               res.json({ success: true, message: responseMessage });
          } else {
              historyStatus = 'Failure';
              if (pythonError) {
                  responseMessage = `Python script error: ${pythonError.trim()}`;
              } else if (code !== 0) {
                  responseMessage = `Python script exited with non-zero code: ${code}. Output: ${pythonOutput.trim()}`;
              } else {
                   responseMessage = `Unknown processing error. Exit code: ${code}. Output: ${pythonOutput.trim()}. Error Stream: ${pythonError.trim()}`;
              }
               console.error(`${logPrefix} ${responseMessage}`);
               await recordUploadHistory(originalFilename, 'Shrey', historyStatus, responseMessage);
               res.status(500).json({ success: false, error: responseMessage });
          }
      });

      pythonProcess.on('error', (err) => {
           console.error(`${logPrefix} Failed to start Python script:`, err);
           const errorMsg = `Failed to start Python process. Is Python installed and in PATH? Error: ${err.message}`;
           console.error(`${logPrefix} ${errorMsg}`);
           recordUploadHistory(originalFilename, 'Shrey', 'Failure', errorMsg).catch(e => console.error('Hist err', e));
           res.status(500).json({ success: false, error: errorMsg });
           // Cleanup temp file on spawn error
           fs.unlink(tempFilePath, (unlinkErr) => {
             if (unlinkErr) console.error(`${logPrefix} Error deleting temp file on spawn error:`, unlinkErr);
           });
      });

  } catch (error) {
     console.error(`${logPrefix} Error trying to spawn Python script:`, error);
     const errorMsg = `Server error trying to run parser: ${error.message}`;
      recordUploadHistory(originalFilename, 'Shrey', 'Failure', errorMsg).catch(e => console.error('Hist err', e));
      res.status(500).json({ success: false, error: errorMsg });
       // Cleanup temp file on general error
      fs.unlink(tempFilePath, (unlinkErr) => {
        if (unlinkErr) console.error(`${logPrefix} Error deleting temp file on general error:`, unlinkErr);
      });
  }
});

// API endpoint to fetch project progress data for EVM analysis
app.get('/api/progress-data', async (req, res) => {
  const projectId = req.query.projectId || 'P1000';
  console.log(`[Server] Request for progress data for project: ${projectId}`);
  
  try {
    // Connect to the SQLite database
    const db = new sqlite3.Database(dbPath);
    
    // Create a promise-based query function
    const query = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };
    
    // Get project data from the database using columns that exist in the TASK table
    // We'll use a more basic query with the columns we know exist
    const progressData = await query(`
      SELECT 
        task_code as period,
        phys_complete_pct as planned,
        COALESCE(act_work_qty, 0) as actual,
        COALESCE(remain_work_qty, 0) as earned,
        target_work_qty as plannedCost,
        COALESCE(act_work_qty, 0) as actualCost
      FROM TASK
      WHERE proj_id = ?
      ORDER BY task_code
    `, [projectId]);
    
    // If no data is found, return sample data
    if (progressData.length === 0) {
      // Sample data structure - for testing purposes
      const sampleProgressData = [
        { period: 'Week 1', planned: 5, actual: 4, earned: 3, plannedCost: 10000, actualCost: 12000 },
        { period: 'Week 2', planned: 10, actual: 8, earned: 7, plannedCost: 15000, actualCost: 16500 },
        { period: 'Week 3', planned: 15, actual: 12, earned: 11, plannedCost: 22000, actualCost: 23000 },
        { period: 'Week 4', planned: 25, actual: 20, earned: 19, plannedCost: 30000, actualCost: 32000 },
        { period: 'Week 5', planned: 35, actual: 30, earned: 28, plannedCost: 38000, actualCost: 40000 },
        { period: 'Week 6', planned: 45, actual: 40, earned: 37, plannedCost: 46000, actualCost: 49000 },
        { period: 'Week 7', planned: 55, actual: 48, earned: 46, plannedCost: 54000, actualCost: 57000 },
        { period: 'Week 8', planned: 65, actual: 56, earned: 53, plannedCost: 62000, actualCost: 66000 },
        { period: 'Week 9', planned: 75, actual: 64, earned: 60, plannedCost: 70000, actualCost: 75000 },
        { period: 'Week 10', planned: 85, actual: 72, earned: 68, plannedCost: 78000, actualCost: 84000 },
        { period: 'Week 11', planned: 95, actual: 85, earned: 80, plannedCost: 86000, actualCost: 93000 },
        { period: 'Week 12', planned: 100, actual: 95, earned: 94, plannedCost: 95000, actualCost: 101000 }
      ];
      
      return res.json(sampleProgressData);
    }
    
    // Close the database connection
    db.close();
    
    res.json(progressData);
  } catch (error) {
    console.error('[Server] Error fetching progress data:', error.message);
    res.status(500).json({ error: 'Failed to fetch progress data' });
  }
});

// API endpoint to fetch projects list
app.get('/api/projects', async (req, res) => {
  console.log('[Server] Request for projects list');
  
  try {
    // Connect to the SQLite database
    const db = new sqlite3.Database(dbPath);
    
    // Create a promise-based query function
    const query = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };
    
    // Get projects from the database
    const projects = await query(`
      SELECT 
        proj_id as id, 
        proj_short_name as name
      FROM PROJECT
      ORDER BY proj_id
    `);
    
    // If no projects found, return sample data
    if (projects.length === 0) {
      const sampleProjects = [
        { id: 'P1000', name: 'Sample Project' },
        { id: 'P1001', name: 'Office Building' },
        { id: 'P1002', name: 'Data Center' }
      ];
      
      return res.json(sampleProjects);
    }
    
    // Close the database connection
    db.close();
    
    res.json(projects);
  } catch (error) {
    console.error('[Server] Error fetching projects:', error.message);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Diagnostic endpoint to check database status
app.get('/api/database/diagnostics', async (req, res) => {
  console.log('[Server] Running database diagnostics');
  const results = {
    databases: {},
    recommendation: ""
  };
  
  // Check primavera_p6.db
  try {
    const db1 = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    
    // Check if connection works
    results.databases.primavera_p6 = { exists: true, tables: [], error: null };
    
    // Check tables
    await new Promise((resolve) => {
      db1.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
          results.databases.primavera_p6.error = err.message;
        } else {
          results.databases.primavera_p6.tables = tables.map(t => t.name);
          results.databases.primavera_p6.has_project_table = tables.some(t => t.name === 'PROJECT');
          results.databases.primavera_p6.has_task_table = tables.some(t => t.name === 'TASK');
        }
        db1.close();
        resolve();
      });
    });
  } catch (error) {
    results.databases.primavera_p6 = { 
      exists: false, 
      error: error.message 
    };
  }
  
  // Check bim_xer_masher.db
  try {
    const db2 = new sqlite3.Database('./database/bim_xer_masher.db', sqlite3.OPEN_READONLY);
    
    // Check if connection works
    results.databases.bim_xer_masher = { exists: true, tables: [], error: null };
    
    // Check tables
    await new Promise((resolve) => {
      db2.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
          results.databases.bim_xer_masher.error = err.message;
        } else {
          results.databases.bim_xer_masher.tables = tables.map(t => t.name);
          results.databases.bim_xer_masher.has_project_table = tables.some(t => t.name === 'PROJECT');
          results.databases.bim_xer_masher.has_task_table = tables.some(t => t.name === 'TASK');
        }
        db2.close();
        resolve();
      });
    });
  } catch (error) {
    results.databases.bim_xer_masher = { 
      exists: false, 
      error: error.message 
    };
  }
  
  // Make recommendation
  if (results.databases.primavera_p6?.has_project_table) {
    results.recommendation = "Use primavera_p6.db for all database connections";
  } else if (results.databases.bim_xer_masher?.has_project_table) {
    results.recommendation = "Use bim_xer_masher.db for all database connections";
  } else {
    results.recommendation = "Neither database has the required tables. Check XER import process.";
  }
  
  res.json(results);
});

// API endpoint for hierarchical Gantt data
app.get('/api/hierarchical-gantt', async (req, res) => {
    const projectId = req.query.projectId;
    
    console.log(`[API] Hierarchical Gantt request received for project ${projectId}`);
    
    if (!projectId) {
        console.error('[API] Hierarchical Gantt: Missing project ID');
        return res.status(400).json({ error: 'Project ID is required' });
    }
    
    console.log(`[API] Hierarchical Gantt: Processing request for project ${projectId}`);
    
    try {
        // The hierarchical SQL query with parameterized values
        const hierarchicalQuery = `
        WITH RECURSIVE WBStructure (wbs_id, parent_wbs_id, wbs_name, level, path) AS (
            -- Anchor member: Select top-level WBS elements for Project
            SELECT
                p.wbs_id,
                p.parent_wbs_id,
                p.wbs_name,
                0 AS level,
                CAST(p.wbs_name AS TEXT) AS path
            FROM
                PROJWBS p
            WHERE p.proj_id = ? AND (
                p.parent_wbs_id IS NULL
                OR NOT EXISTS (SELECT 1 FROM PROJWBS parent WHERE parent.wbs_id = p.parent_wbs_id)
            )

            UNION ALL

            -- Recursive member: Select children WBS elements within Project
            SELECT
                p_child.wbs_id,
                p_child.parent_wbs_id,
                p_child.wbs_name,
                cte.level + 1,
                cte.path || ' > ' || p_child.wbs_name
            FROM
                PROJWBS p_child
            INNER JOIN
                WBStructure cte ON p_child.parent_wbs_id = cte.wbs_id
            WHERE p_child.proj_id = ?
        )
        -- Final selection joining WBS hierarchy with TASK data
        SELECT
            -- Task details
            t.task_id,
            t.task_name,
            -- Use CASE statements for date logic based on status_code
            CASE
                WHEN t.status_code IN ('TK_Complete','TK_Active') THEN t.act_start_date
                ELSE t.target_start_date
            END AS start_date,
            CASE
                WHEN t.status_code IN ('TK_NotStart','TK_Active') THEN t.target_end_date
                ELSE t.act_end_date
            END AS end_date,
            t.status_code,
            t.driving_path_flag,
            t.target_drtn_hr_cnt,
            t.task_code,

            -- WBS Hierarchy details from CTE
            wbs.wbs_id AS task_wbs_id,
            wbs.level AS wbs_level,
            wbs.path AS wbs_path,
            substr('                                                  ', 1, wbs.level * 2) || wbs.wbs_name AS indented_wbs_name

        FROM
            TASK t
        INNER JOIN
            WBStructure wbs ON t.wbs_id = wbs.wbs_id
        WHERE
            t.proj_id = ?
        ORDER BY
            wbs.path,
            CASE
                WHEN t.status_code IN ('TK_Complete','TK_Active') THEN t.act_start_date
                ELSE t.target_start_date
            END
        `;
        
        console.log(`[API] Hierarchical Gantt: Executing query for project ${projectId}`);
        
        // Execute the query with parameters
        const rows = await new Promise((resolve, reject) => {
            db.all(hierarchicalQuery, [projectId, projectId, projectId], (err, rows) => {
                if (err) {
                    console.error('[Database] Error executing hierarchical Gantt query:', err);
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
        
        console.log(`[API] Hierarchical Gantt: Query returned ${rows.length} rows for project ${projectId}`);
        
        if (rows.length === 0) {
            console.warn(`[API] Hierarchical Gantt: No data found for project ${projectId}`);
            // Return empty array but with a 200 status (not an error, just no data)
            return res.json([]);
        }
        
        // Return the results as JSON
        res.json(rows);
    } catch (error) {
        console.error('[API] Error in hierarchical Gantt endpoint:', error);
        res.status(500).json({ 
            error: 'Failed to fetch hierarchical Gantt data',
            details: error.message,
            projectId: projectId
        });
    }
});

// API endpoint for complete WBS structure (without limit)
app.get('/api/wbs-structure', async (req, res) => {
    const projectId = req.query.projectId;
    
    console.log(`[API] WBS Structure request received for project ${projectId}`);
    
    if (!projectId) {
        console.error('[API] WBS Structure: Missing project ID');
        return res.status(400).json({ error: 'Project ID is required' });
    }
    
    console.log(`[API] WBS Structure: Processing request for project ${projectId} (no limit)`);
    
    try {
        // The WBS structure SQL query with parameterized values - same as hierarchical-gantt but without limit
        const wbsStructureQuery = `
        WITH RECURSIVE WBStructure (wbs_id, parent_wbs_id, wbs_name, level, path) AS (
            -- Anchor member: Select top-level WBS elements for Project
            SELECT
                p.wbs_id,
                p.parent_wbs_id,
                p.wbs_name,
                0 AS level,
                CAST(p.wbs_name AS TEXT) AS path
            FROM
                PROJWBS p
            WHERE p.proj_id = ? AND (
                p.parent_wbs_id IS NULL
                OR NOT EXISTS (SELECT 1 FROM PROJWBS parent WHERE parent.wbs_id = p.parent_wbs_id)
            )

            UNION ALL

            -- Recursive member: Select children WBS elements within Project
            SELECT
                p_child.wbs_id,
                p_child.parent_wbs_id,
                p_child.wbs_name,
                cte.level + 1,
                cte.path || ' > ' || p_child.wbs_name
            FROM
                PROJWBS p_child
            INNER JOIN
                WBStructure cte ON p_child.parent_wbs_id = cte.wbs_id
            WHERE p_child.proj_id = ?
        )
        -- Final selection joining WBS hierarchy with TASK data
        SELECT
            -- Task details
            t.task_id,
            t.task_name,
            -- Use CASE statements for date logic based on status_code
            CASE
                WHEN t.status_code IN ('TK_Complete','TK_Active') THEN t.act_start_date
                ELSE t.target_start_date
            END AS start_date,
            CASE
                WHEN t.status_code IN ('TK_NotStart','TK_Active') THEN t.target_end_date
                ELSE t.act_end_date
            END AS end_date,
            t.status_code,
            t.driving_path_flag,
            t.target_drtn_hr_cnt,
            t.task_code,

            -- WBS Hierarchy details from CTE
            wbs.wbs_id AS task_wbs_id,
            wbs.level AS wbs_level,
            wbs.path AS wbs_path,
            substr('                                                  ', 1, wbs.level * 2) || wbs.wbs_name AS indented_wbs_name

        FROM
            TASK t
        INNER JOIN
            WBStructure wbs ON t.wbs_id = wbs.wbs_id
        WHERE
            t.proj_id = ?
        ORDER BY
            wbs.path,
            CASE
                WHEN t.status_code IN ('TK_Complete','TK_Active') THEN t.act_start_date
                ELSE t.target_start_date
            END
        `;
        
        console.log(`[API] WBS Structure: Executing query for project ${projectId}`);
        
        // Execute the query with parameters
        const rows = await new Promise((resolve, reject) => {
            db.all(wbsStructureQuery, [projectId, projectId, projectId], (err, rows) => {
                if (err) {
                    console.error('[Database] Error executing WBS structure query:', err);
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
        
        console.log(`[API] WBS Structure: Query returned ${rows.length} rows for project ${projectId}`);
        
        if (rows.length === 0) {
            console.warn(`[API] WBS Structure: No data found for project ${projectId}`);
            // Return empty array but with a 200 status (not an error, just no data)
            return res.json([]);
        }
        
        // Add diagnostic logging of first few rows and all field types
        if (rows.length > 0) {
            console.log(`[API] WBS Structure: First row sample:`, rows[0]);
            
            // Log data types of each field in the first row
            const typeSample = {};
            Object.entries(rows[0]).forEach(([key, value]) => {
                typeSample[key] = {
                    value: value,
                    type: typeof value,
                    isNull: value === null,
                    isUndefined: value === undefined,
                    sample: value?.toString?.().substring(0, 30) + (value?.toString?.().length > 30 ? '...' : '')
                };
            });
            console.log(`[API] WBS Structure: Field types:`, typeSample);
            
            // Check for specific task ID 85125 that was problematic
            const task85125 = rows.find(r => 
                (r.task_id && r.task_id.toString() === '85125') || 
                (r.task_code && r.task_code.includes('85125'))
            );
            
            if (task85125) {
                console.log(`[API] WBS Structure: Found task 85125:`, task85125);
            } else {
                console.log(`[API] WBS Structure: Task 85125 not found in result set`);
            }
        }
        
        // Return the results as JSON
        res.json(rows);
    } catch (error) {
        console.error('[API] Error in WBS structure endpoint:', error);
        res.status(500).json({ 
            error: 'Failed to fetch WBS structure data',
            details: error.message,
            projectId: projectId
        });
    }
});

// Schedule Drilldown API Routes
// Project list endpoint
app.get('/api/schedule/projects', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT 
                Project_ID as id, 
                Project_ID as name
            FROM ActivityRelationshipView 
            ORDER BY Project_ID
        `;
        
        const rows = await new Promise((resolve, reject) => {
            db.all(query, [], (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error fetching projects:', err);
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
        
        console.log(`[Schedule API] Found ${rows.length} projects`);
        res.json(rows);
    } catch (error) {
        console.error('[Schedule API] Error in projects endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Leads KPI endpoint
app.get('/api/schedule/leads-kpi', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        // Build filters for leads calculation (Lag < 0 and Relationship_Status = 'Incomplete')
        let leadsFilters = ["Relationship_Status = 'Incomplete'", "Lag < 0"];
        let remainingFilters = ["Relationship_Status = 'Incomplete'"];
        let totalFilters = [];
        
        const leadsParams = [];
        const remainingParams = [];
        const totalParams = [];
        
        if (projectId && projectId !== 'all') {
            leadsFilters.push('Project_ID = ?');
            remainingFilters.push('Project_ID = ?');
            totalFilters.push('Project_ID = ?');
            leadsParams.push(projectId);
            remainingParams.push(projectId);
            totalParams.push(projectId);
        }
        
        const leadsWhere = leadsFilters.length > 0 ? 'WHERE ' + leadsFilters.join(' AND ') : '';
        const remainingWhere = remainingFilters.length > 0 ? 'WHERE ' + remainingFilters.join(' AND ') : '';
        const totalWhere = totalFilters.length > 0 ? 'WHERE ' + totalFilters.join(' AND ') : '';
        
        // Get leads count
        const leadsQuery = `SELECT COUNT(*) as leads_count FROM ActivityRelationshipView ${leadsWhere}`;
        const leadsResult = await new Promise((resolve, reject) => {
            db.get(leadsQuery, leadsParams, (err, row) => {
                if (err) {
                    console.error('[Schedule API] Error in leads count:', err);
                    resolve({ leads_count: 0 });
                    return;
                }
                resolve(row || { leads_count: 0 });
            });
        });
        
        // Get remaining relationships count
        const remainingQuery = `SELECT COUNT(*) as remaining_count FROM ActivityRelationshipView ${remainingWhere}`;
        const remainingResult = await new Promise((resolve, reject) => {
            db.get(remainingQuery, remainingParams, (err, row) => {
                if (err) {
                    console.error('[Schedule API] Error in remaining count:', err);
                    resolve({ remaining_count: 0 });
                    return;
                }
                resolve(row || { remaining_count: 0 });
            });
        });
        
        // Get total relationships count
        const totalQuery = `SELECT COUNT(*) as total_count FROM ActivityRelationshipView ${totalWhere}`;
        const totalResult = await new Promise((resolve, reject) => {
            db.get(totalQuery, totalParams, (err, row) => {
                if (err) {
                    console.error('[Schedule API] Error in total count:', err);
                    resolve({ total_count: 0 });
                    return;
                }
                resolve(row || { total_count: 0 });
            });
        });
        
        const leadsCount = leadsResult.leads_count || 0;
        const remainingCount = remainingResult.remaining_count || 0;
        const totalCount = totalResult.total_count || 0;
        const leadPercentage = remainingCount > 0 ? Math.round((leadsCount * 100.0) / remainingCount * 100) / 100 : 0;
        
        res.json({
            Total_Relationship_Count: totalCount,
            Remaining_Relationship_Count: remainingCount,
            Leads_Count: leadsCount,
            Lead_Percentage: leadPercentage
        });
    } catch (error) {
        console.error('[Schedule API] Error in leads-kpi endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch leads KPI data' });
    }
});

// Leads chart data endpoint
app.get('/api/schedule/leads-chart-data', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["Relationship_Status = 'Incomplete'", "Lag < 0"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT 
                Lag as lag,
                RelationshipType as relationship_type,
                COUNT(*) as count
            FROM ActivityRelationshipView 
            ${whereClause}
            GROUP BY Lag, RelationshipType
            ORDER BY Lag, RelationshipType
        `;
        
        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in leads-chart-data:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });
        
        res.json(rows);
    } catch (error) {
        console.error('[Schedule API] Error in leads-chart-data endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch leads chart data' });
    }
});

// Leads percentage history endpoint
app.get('/api/schedule/leads-percentage-history', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["f.Relationship_Percentage IS NOT NULL", "a.Lag < 0"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('f.Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                strftime('%Y-%m', p.last_recalc_date) as date,
                AVG(f.Relationship_Percentage) as percentage
            FROM FinalActivityKPIView f
            INNER JOIN Project p ON f.Project_ID = p.proj_id
            INNER JOIN ActivityRelationshipView a ON f.Project_ID = a.Project_ID
            ${whereClause}
            GROUP BY strftime('%Y-%m', p.last_recalc_date)
            ORDER BY date
        `;

        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in leads-percentage-history:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });

        // Transform data to match expected format
        const transformedData = rows.map(row => ({
            date: row.date,
            percentage: Math.round(row.percentage * 100) / 100 // Round to 2 decimal places
        }));

        res.json(transformedData);
    } catch (error) {
        console.error('[Schedule API] Error in leads-percentage-history endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch leads history data' });
    }
});

// Leads table data endpoint
app.get('/api/schedule/leads', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        const limit = req.query.limit || 20;
        
        let filters = ["Relationship_Status = 'Incomplete'", "Lag < 0"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                Activity_ID as "Pred. ID",
                Activity_ID2 as "Succ. ID", 
                Activity_Name as "Pred. Name",
                Activity_Name2 as "Succ. Name",
                RelationshipType as "Relationship type",
                Lag,
                Driving,
                FreeFloat,
                Lead,
                ExcessiveLag,
                Relationship_Status
            FROM ActivityRelationshipView
            ${whereClause}
            ORDER BY Activity_ID
            LIMIT ?
        `;
        
        params.push(parseInt(limit));
        
        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in leads:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });
        
        res.json(rows);
    } catch (error) {
        console.error('[Schedule API] Error in leads endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch leads data' });
    }
});

// Lags KPI endpoint
app.get('/api/schedule/lags-kpi', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["Relationship_Status = 'Incomplete'", "Lag != 0", "Lag IS NOT NULL"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                COUNT(*) as lags_count,
                SUM(CASE WHEN CAST(Lag AS REAL) > 0 THEN 1 ELSE 0 END) as positive_lags,
                AVG(CAST(Lag AS REAL)) as avg_lag_days
            FROM ActivityRelationshipView
            ${whereClause}
        `;
        
        const result = await new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) {
                    console.error('[Schedule API] Error in lags-kpi:', err);
                    resolve({ lags_count: 0, positive_lags: 0, avg_lag_days: 0 });
                    return;
                }
                resolve(row || { lags_count: 0, positive_lags: 0, avg_lag_days: 0 });
            });
        });
        
        // Get remaining relationships for percentage calculation
        let remainingFilters = ["Relationship_Status = 'Incomplete'"];
        const remainingParams = [];
        if (projectId && projectId !== 'all') {
            remainingFilters.push('Project_ID = ?');
            remainingParams.push(projectId);
        }
        const remainingWhere = remainingFilters.length > 0 ? 'WHERE ' + remainingFilters.join(' AND ') : '';
        
        const remainingQuery = `SELECT COUNT(*) as remaining_count FROM ActivityRelationshipView ${remainingWhere}`;
        const remainingResult = await new Promise((resolve, reject) => {
            db.get(remainingQuery, remainingParams, (err, row) => {
                if (err) {
                    console.error('[Schedule API] Error in remaining count for lags:', err);
                    resolve({ remaining_count: 0 });
                    return;
                }
                resolve(row || { remaining_count: 0 });
            });
        });
        
        const lagsCount = result.lags_count || 0;
        const remainingCount = remainingResult.remaining_count || 0;
        const lagPercentage = remainingCount > 0 ? Math.round((lagsCount * 100.0) / remainingCount * 100) / 100 : 0;
        
        res.json({
            Total_Relationship_Count: remainingCount,
            Remaining_Relationship_Count: remainingCount,
            Lags_Count: lagsCount,
            Lag_Percentage: lagPercentage
        });
    } catch (error) {
        console.error('[Schedule API] Error in lags-kpi endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch lags KPI data' });
    }
});

// Lags data endpoint
app.get('/api/schedule/lags', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        const limit = req.query.limit || 20;
        
        let filters = ["Relationship_Status = 'Incomplete'", "Lag != 0", "Lag IS NOT NULL"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                Activity_ID as "Pred. ID",
                Activity_ID2 as "Succ. ID", 
                Activity_Name as "Pred. Name",
                Activity_Name2 as "Succ. Name",
                RelationshipType as "Relationship type",
                Lag,
                Driving,
                FreeFloat,
                Lead,
                ExcessiveLag,
                Relationship_Status
            FROM ActivityRelationshipView
            ${whereClause}
            ORDER BY Activity_ID
            LIMIT ?
        `;
        
        params.push(parseInt(limit));
        
        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in lags:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });
        
        res.json(rows);
    } catch (error) {
        console.error('[Schedule API] Error in lags endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch lags data' });
    }
});

// Lags chart data endpoint
app.get('/api/schedule/lags-chart-data', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["Relationship_Status = 'Incomplete'", "Lag != 0", "Lag IS NOT NULL"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT 
                Lag as lag,
                RelationshipType as relationship_type,
                COUNT(*) as count
            FROM ActivityRelationshipView 
            ${whereClause}
            GROUP BY Lag, RelationshipType
            ORDER BY Lag, RelationshipType
        `;
        
        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in lags chart data:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });
        
        res.json(rows);
    } catch (error) {
        console.error('[Schedule API] Error in lags-chart-data endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch lags chart data' });
    }
});

// Lags percentage history endpoint
app.get('/api/schedule/lags-percentage-history', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["f.Relationship_Percentage IS NOT NULL", "a.Lag != 0", "a.Lag IS NOT NULL"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('f.Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                strftime('%Y-%m', p.last_recalc_date) as date,
                AVG(f.Relationship_Percentage) as percentage
            FROM FinalActivityKPIView f
            INNER JOIN Project p ON f.Project_ID = p.proj_id
            INNER JOIN ActivityRelationshipView a ON f.Project_ID = a.Project_ID
            ${whereClause}
            GROUP BY strftime('%Y-%m', p.last_recalc_date)
            ORDER BY date
        `;

        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in lags-percentage-history:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });

        // Transform data to match expected format
        const transformedData = rows.map(row => ({
            date: row.date,
            percentage: Math.round(row.percentage * 100) / 100 // Round to 2 decimal places
        }));

        res.json(transformedData);
    } catch (error) {
        console.error('[Schedule API] Error in lags-percentage-history endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch lags history data' });
    }
});

// Excessive Lags KPI endpoint
app.get('/api/schedule/excessive-lags-kpi', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["Relationship_Status = 'Incomplete'", "ExcessiveLag > 0"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                COUNT(*) as excessive_lags_count,
                AVG(CAST(ExcessiveLag AS REAL)) as avg_excessive_lag
            FROM ActivityRelationshipView
            ${whereClause}
        `;
        
        const result = await new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) {
                    console.error('[Schedule API] Error in excessive lags KPI:', err);
                    resolve({ excessive_lags_count: 0, avg_excessive_lag: 0 });
                    return;
                }
                resolve(row || { excessive_lags_count: 0, avg_excessive_lag: 0 });
            });
        });
        
        // Get remaining relationships for percentage calculation
        let remainingFilters = ["Relationship_Status = 'Incomplete'"];
        const remainingParams = [];
        if (projectId && projectId !== 'all') {
            remainingFilters.push('Project_ID = ?');
            remainingParams.push(projectId);
        }
        const remainingWhere = remainingFilters.length > 0 ? 'WHERE ' + remainingFilters.join(' AND ') : '';
        
        const remainingQuery = `SELECT COUNT(*) as remaining_count FROM ActivityRelationshipView ${remainingWhere}`;
        const remainingResult = await new Promise((resolve, reject) => {
            db.get(remainingQuery, remainingParams, (err, row) => {
                if (err) {
                    console.error('[Schedule API] Error in remaining count for excessive lags:', err);
                    resolve({ remaining_count: 0 });
                    return;
                }
                resolve(row || { remaining_count: 0 });
            });
        });
        
        const excessiveLagsCount = result.excessive_lags_count || 0;
        const remainingCount = remainingResult.remaining_count || 0;
        const excessiveLagPercentage = remainingCount > 0 ? Math.round((excessiveLagsCount * 100.0) / remainingCount * 100) / 100 : 0;
        
        res.json({
            Total_Relationship_Count: remainingCount,
            Remaining_Relationship_Count: remainingCount,
            ExcessiveLags_Count: excessiveLagsCount,
            ExcessiveLag_Percentage: excessiveLagPercentage
        });
    } catch (error) {
        console.error('[Schedule API] Error in excessive lags KPI endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch excessive lags KPI data' });
    }
});

// Excessive Lags data endpoint
app.get('/api/schedule/excessive-lags', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        const limit = req.query.limit || 20;
        
        let filters = ["Relationship_Status = 'Incomplete'", "ExcessiveLag > 0"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                Activity_ID as "Pred. ID",
                Activity_ID2 as "Succ. ID", 
                Activity_Name as "Pred. Name",
                Activity_Name2 as "Succ. Name",
                RelationshipType as "Relationship type",
                Lag,
                Driving,
                FreeFloat,
                Lead,
                ExcessiveLag,
                Relationship_Status
            FROM ActivityRelationshipView
            ${whereClause}
            ORDER BY Activity_ID
            LIMIT ?
        `;
        
        params.push(parseInt(limit));
        
        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in excessive lags:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });
        
        res.json(rows);
    } catch (error) {
        console.error('[Schedule API] Error in excessive lags endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch excessive lags data' });
    }
});

// Excessive Lags chart data endpoint
app.get('/api/schedule/excessive-lags-chart-data', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["Relationship_Status = 'Incomplete'", "ExcessiveLag = 'Excessive Lag'"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT 
                Lag as lag,
                RelationshipType as relationship_type,
                COUNT(*) as count
            FROM ActivityRelationshipView 
            ${whereClause}
            GROUP BY Lag, RelationshipType
            ORDER BY CAST(Lag AS INTEGER), RelationshipType
        `;
        
        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in excessive lags chart data:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });
        
        res.json(rows);
    } catch (error) {
        console.error('[Schedule API] Error in excessive-lags-chart-data endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch excessive lags chart data' });
    }
});

// Excessive Lags percentage history endpoint
app.get('/api/schedule/excessive-lags-percentage-history', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["f.Relationship_Percentage IS NOT NULL", "a.ExcessiveLag = 'Excessive Lag'"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('f.Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                strftime('%Y-%m', p.last_recalc_date) as date,
                AVG(f.Relationship_Percentage) as percentage
            FROM FinalActivityKPIView f
            INNER JOIN Project p ON f.Project_ID = p.proj_id
            INNER JOIN ActivityRelationshipView a ON f.Project_ID = a.Project_ID
            ${whereClause}
            GROUP BY strftime('%Y-%m', p.last_recalc_date)
            ORDER BY date
        `;

        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in excessive-lags-percentage-history:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });

        // Transform data to match expected format
        const transformedData = rows.map(row => ({
            date: row.date,
            percentage: Math.round(row.percentage * 100) / 100 // Round to 2 decimal places
        }));

        res.json(transformedData);
    } catch (error) {
        console.error('[Schedule API] Error in excessive-lags-percentage-history endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch excessive lags history data' });
    }
});

// Excessive Lags table data endpoint
app.get('/api/schedule/excessive-lags', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        const limit = req.query.limit || 20;
        
        let filters = ["Relationship_Status = 'Incomplete'", "ExcessiveLag = 'Excessive Lag'"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                Activity_ID as "Pred. ID",
                Activity_ID2 as "Succ. ID", 
                Activity_Name as "Pred. Name",
                Activity_Name2 as "Succ. Name",
                RelationshipType as "Relationship type",
                Lag,
                Driving,
                FreeFloat,
                ExcessiveLag,
                Relationship_Status
            FROM ActivityRelationshipView
            ${whereClause}
            ORDER BY CAST(Lag AS REAL) DESC 
            LIMIT ?
        `;
        
        params.push(parseInt(limit));
        
        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in excessive-lags:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });
        
        res.json(rows);
    } catch (error) {
        console.error('[Schedule API] Error in excessive-lags endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch excessive lags data' });
    }
});

// Final Activity KPI endpoint (for both FS+0d and Non FS+0d)
app.get('/api/schedule/finalactivitykpi', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        let query = `
            SELECT
                COUNT(*) as count,
                COUNT(DISTINCT Project_ID) as activities,
                COUNT(*) as relationships,
                COUNT(DISTINCT Project_ID) as projects
            FROM FinalActivityKPIView
        `;
        
        const params = [];
        if (projectId) {
            query += ' WHERE Project_ID = ?';
            params.push(projectId);
        }
        
        const row = await new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) {
                    console.error('[Schedule API] Error in finalactivitykpi:', err);
                    resolve({ count: 0, activities: 0, relationships: 0, projects: 0 });
                    return;
                }
                resolve(row || { count: 0, activities: 0, relationships: 0, projects: 0 });
            });
        });
        
        res.json(row);
    } catch (error) {
        console.error('[Schedule API] Error in finalactivitykpi endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch final activity KPI data' });
    }
});

// FS+0d Line Chart endpoint
app.get('/api/schedule/fs-line-chart', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["f.Relationship_Percentage IS NOT NULL"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('f.Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                strftime('%Y-%m', p.last_recalc_date) as date,
                AVG(f.Relationship_Percentage) as percentage
            FROM FinalActivityKPIView f
            INNER JOIN Project p ON f.Project_ID = p.proj_id
            ${whereClause}
            GROUP BY strftime('%Y-%m', p.last_recalc_date)
            ORDER BY date
        `;

        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in fs-line-chart:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });

        // Transform data to match expected format
        const transformedData = rows.map(row => ({
            date: row.date,
            percentage: Math.round(row.percentage * 100) / 100 // Round to 2 decimal places
        }));

        res.json(transformedData);
    } catch (error) {
        console.error('[Schedule API] Error in fs-line-chart endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch FS line chart data' });
    }
});

// FS+0d percentage history endpoint
app.get('/api/schedule/fs-percentage-history', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["f.Relationship_Percentage IS NOT NULL", "a.RelationshipType = 'PR_FS'", "a.Lag = 0"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('f.Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                strftime('%Y-%m', p.last_recalc_date) as date,
                AVG(f.Relationship_Percentage) as percentage
            FROM FinalActivityKPIView f
            INNER JOIN Project p ON f.Project_ID = p.proj_id
            INNER JOIN ActivityRelationshipView a ON f.Project_ID = a.Project_ID
            ${whereClause}
            GROUP BY strftime('%Y-%m', p.last_recalc_date)
            ORDER BY date
        `;

        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in fs-percentage-history:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });

        // Transform data to match expected format
        const transformedData = rows.map(row => ({
            date: row.date,
            percentage: Math.round(row.percentage * 100) / 100 // Round to 2 decimal places
        }));

        res.json(transformedData);
    } catch (error) {
        console.error('[Schedule API] Error in fs-percentage-history endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch FS+0d history data' });
    }
});

// Non-FS+0d percentage history endpoint
app.get('/api/schedule/non-fs-percentage-history', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["f.Relationship_Percentage IS NOT NULL", "NOT (a.RelationshipType = 'PR_FS' AND a.Lag = 0)"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('f.Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                strftime('%Y-%m', p.last_recalc_date) as date,
                AVG(f.Relationship_Percentage) as percentage
            FROM FinalActivityKPIView f
            INNER JOIN Project p ON f.Project_ID = p.proj_id
            INNER JOIN ActivityRelationshipView a ON f.Project_ID = a.Project_ID
            ${whereClause}
            GROUP BY strftime('%Y-%m', p.last_recalc_date)
            ORDER BY date
        `;

        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in non-fs-percentage-history:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });

        // Transform data to match expected format
        const transformedData = rows.map(row => ({
            date: row.date,
            percentage: Math.round(row.percentage * 100) / 100 // Round to 2 decimal places
        }));

        res.json(transformedData);
    } catch (error) {
        console.error('[Schedule API] Error in non-fs-percentage-history endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch Non-FS+0d history data' });
    }
});

// Non FS+0d Line Chart endpoint
app.get('/api/schedule/non-fs-line-chart', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["f.Relationship_Percentage IS NOT NULL"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('f.Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                strftime('%Y-%m', p.last_recalc_date) as date,
                AVG(f.Relationship_Percentage) as percentage
            FROM FinalActivityKPIView f
            INNER JOIN Project p ON f.Project_ID = p.proj_id
            ${whereClause}
            GROUP BY strftime('%Y-%m', p.last_recalc_date)
            ORDER BY date
        `;

        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in non-fs-line-chart:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });

        // Transform data to match expected format
        const transformedData = rows.map(row => ({
            date: row.date,
            percentage: Math.round(row.percentage * 100) / 100 // Round to 2 decimal places
        }));

        res.json(transformedData);
    } catch (error) {
        console.error('[Schedule API] Error in non-fs-line-chart endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch Non-FS line chart data' });
    }
});

// Excessive Lags Line Chart endpoint
app.get('/api/schedule/excessive-lags-line-chart', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["f.Relationship_Percentage IS NOT NULL"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('f.Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                strftime('%Y-%m', p.last_recalc_date) as date,
                AVG(f.Relationship_Percentage) as percentage
            FROM FinalActivityKPIView f
            INNER JOIN Project p ON f.Project_ID = p.proj_id
            ${whereClause}
            GROUP BY strftime('%Y-%m', p.last_recalc_date)
            ORDER BY date
        `;
        
        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in excessive-lags-line-chart:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
        
        res.json({ value: rows });
    } catch (error) {
        console.error('[Schedule API] Error in excessive-lags-line-chart:', error);
        res.status(500).json({ error: 'Failed to fetch excessive lags line chart data' });
    }
});

// FS+0d KPI endpoint
app.get('/api/schedule/fs-kpi', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = [];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                COUNT(*) as Total_Relationship_Count,
                COUNT(*) - SUM(CASE WHEN RelationshipType = 'PR_FS' AND Lag = 0 THEN 1 ELSE 0 END) as Remaining_Relationship_Count,
                SUM(CASE WHEN RelationshipType = 'PR_FS' AND Lag = 0 THEN 1 ELSE 0 END) as FS_Count,
                ROUND(
                    (SUM(CASE WHEN RelationshipType = 'PR_FS' AND Lag = 0 THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 
                    2
                ) as FS_Percentage
            FROM ActivityRelationshipView
            ${whereClause}
        `;

        const row = await new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) {
                    console.error('[Schedule API] Error in fs-kpi:', err);
                    resolve({});
                    return;
                }
                resolve(row || {});
            });
        });

        res.json(row);
    } catch (error) {
        console.error('[Schedule API] Error in fs-kpi endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch FS+0d KPI data' });
    }
});

// Non-FS+0d KPI endpoint
app.get('/api/schedule/non-fs-kpi', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = [];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
        
        const query = `
            SELECT
                COUNT(*) as Total_Relationship_Count,
                SUM(CASE WHEN RelationshipType = 'PR_FS' AND Lag = 0 THEN 1 ELSE 0 END) as Remaining_Relationship_Count,
                COUNT(*) - SUM(CASE WHEN RelationshipType = 'PR_FS' AND Lag = 0 THEN 1 ELSE 0 END) as NonFS_Count,
                ROUND(
                    ((COUNT(*) - SUM(CASE WHEN RelationshipType = 'PR_FS' AND Lag = 0 THEN 1 ELSE 0 END)) * 100.0) / COUNT(*), 
                    2
                ) as NonFS_Percentage
            FROM ActivityRelationshipView
            ${whereClause}
        `;

        const row = await new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) {
                    console.error('[Schedule API] Error in non-fs-kpi:', err);
                    resolve({});
                    return;
                }
                resolve(row || {});
            });
        });

        res.json(row);
    } catch (error) {
        console.error('[Schedule API] Error in non-fs-kpi endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch Non-FS+0d KPI data' });
    }
});

// FS+0d Chart Data endpoint
app.get('/api/schedule/fs-chart-data', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["RelationshipType = 'PR_FS' AND Lag = 0"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = 'WHERE ' + filters.join(' AND ');
        
        const query = `
            SELECT
                RelationshipType as label,
                COUNT(*) as value
            FROM ActivityRelationshipView
            ${whereClause}
            GROUP BY RelationshipType
            ORDER BY value DESC
        `;

        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in fs-chart-data:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });

        res.json(rows);
    } catch (error) {
        console.error('[Schedule API] Error in fs-chart-data endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch FS+0d chart data' });
    }
});

// Non-FS+0d Chart Data endpoint
app.get('/api/schedule/non-fs-chart-data', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["NOT (RelationshipType = 'PR_FS' AND Lag = 0)"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = 'WHERE ' + filters.join(' AND ');
        
        const query = `
            SELECT
                RelationshipType as label,
                COUNT(*) as value
            FROM ActivityRelationshipView
            ${whereClause}
            GROUP BY RelationshipType
            ORDER BY value DESC
        `;

        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in non-fs-chart-data:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });

        res.json(rows);
    } catch (error) {
        console.error('[Schedule API] Error in non-fs-chart-data endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch Non-FS+0d chart data' });
    }
});

// FS+0d Table Data endpoint
app.get('/api/schedule/fs', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["RelationshipType = 'PR_FS' AND Lag = 0"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = 'WHERE ' + filters.join(' AND ');
        
        const query = `
            SELECT
                PredecessorActivityID,
                PredecessorActivityName,
                SuccessorActivityID,
                SuccessorActivityName,
                RelationshipType,
                Lag,
                FreeFloat,
                TotalFloat,
                Driving
            FROM ActivityRelationshipView
            ${whereClause}
            ORDER BY PredecessorActivityID
            LIMIT 100
        `;

        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in fs table data:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });

        res.json(rows);
    } catch (error) {
        console.error('[Schedule API] Error in fs table endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch FS+0d table data' });
    }
});

// Non-FS+0d Table Data endpoint
app.get('/api/schedule/non-fs', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        
        let filters = ["NOT (RelationshipType = 'PR_FS' AND Lag = 0)"];
        const params = [];
        
        if (projectId && projectId !== 'all') {
            filters.push('Project_ID = ?');
            params.push(projectId);
        }
        
        const whereClause = 'WHERE ' + filters.join(' AND ');
        
        const query = `
            SELECT
                PredecessorActivityID,
                PredecessorActivityName,
                SuccessorActivityID,
                SuccessorActivityName,
                RelationshipType,
                Lag,
                FreeFloat,
                TotalFloat,
                Driving
            FROM ActivityRelationshipView
            ${whereClause}
            ORDER BY PredecessorActivityID
            LIMIT 100
        `;

        const rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Schedule API] Error in non-fs table data:', err);
                    resolve([]);
                    return;
                }
                resolve(rows || []);
            });
        });

        res.json(rows);
    } catch (error) {
        console.error('[Schedule API] Error in non-fs table endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch Non-FS+0d table data' });
    }
});

// Fallback route for SPA - MOVED HERE
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`[Server] Backend server running at http://localhost:${PORT}`);
  // console.log(`[Server] Using database at: ${dbPath}`); // Log path on start is useful
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Server] SIGINT signal received: closing SQLite database connection.');
  db.close((err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('[Server] Closed the database connection.');
    process.exit(0);
  });
});

// Basic error handling middleware (add more specific ones as needed)
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled Error:', err.stack);
  res.status(500).send('Something broke!');
}); 
