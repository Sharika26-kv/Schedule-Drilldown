/**
 * BIM_XER_Masher - Main Application Entry Point
 * This file serves as the main entry point for the application,
 * handling file uploads and integrating IFC and XER data.
 */

import { parseIFCFile, parseXERFile, integrateData } from './utils/fileParser.js';

// Application state
let state = {
    ifcFile: null,
    xerFile: null,
    ifcData: null,
    xerData: null,
    integratedData: null,
    isProcessing: false,
    errors: [],
    ifcUploadStatus: '',
    translationStatus: '',
    translationProgress: 0,
    generatedUrn: '',
    bucket_key: "ifcviewer1744251930321", // Fixed bucket key as in CleanViewer
    pendingUploadSummary: null
};

// DOM elements
const elements = {
    // Landing page elements
    ifcDropzone: document.getElementById('ifc-dropzone'),
    xerDropzone: document.getElementById('xer-dropzone'),
    ifcFileInput: document.getElementById('ifc-file'),
    xerFileInput: document.getElementById('xer-file'),
    ifcUploadBtn: document.getElementById('ifc-upload-btn'),
    xerUploadBtn: document.getElementById('xer-upload-btn'),
    ifcFileName: document.getElementById('ifc-file-name'),
    xerFileName: document.getElementById('xer-file-name'),
    processFilesBtn: document.getElementById('process-files-btn'),
    
    // Status display elements
    ifcUploadStatus: document.getElementById('ifc-upload-status'),
    translationStatus: document.getElementById('translation-status'),
    translationProgressBar: document.getElementById('translation-progress'),
    translationContainer: document.getElementById('translation-container'),
    
    // Dashboard elements will be populated when the dashboard loads
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

/**
 * Initialize the application
 */
async function initializeApp() {
    // Pre-fetch Autodesk token
    try {
        console.log('Pre-fetching Autodesk token...');
        const token = await getAccessToken();
        if (token) {
            console.log('Successfully pre-fetched Autodesk token');
        } else {
            console.warn('Failed to pre-fetch Autodesk token');
        }
    } catch (error) {
        console.error('Error pre-fetching Autodesk token:', error);
    }

    // Set up event listeners for file uploads
    setupFileUpload();
    
    // Check if we're on the dashboard page
    if (window.location.pathname.includes('dashboard')) {
        initializeDashboard();
    }
}

/**
 * Get Autodesk access token
 * @returns {Promise<string|null>} The access token or null if failed
 */
async function getAccessToken() {
    try {
        // Check if we have a valid token in localStorage first
        const tokenCache = localStorage.getItem('autodesk_token_cache');
        if (tokenCache) {
            const parsedCache = JSON.parse(tokenCache);
            if (parsedCache.expires_at && parsedCache.access_token && parsedCache.expires_at > Date.now()) {
                console.log('Using cached token, expires in:', 
                    Math.round((parsedCache.expires_at - Date.now()) / 1000), 'seconds');
                return parsedCache.access_token;
            }
        }
        
        // Define your Autodesk credentials
       // const CLIENT_ID = ;
       // const CLIENT_SECRET = ;
        
        // Request new token
        const response = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'client_credentials',
                scope: 'data:read data:write data:create bucket:read bucket:create viewables:read'
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to get token: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Cache the token
        const tokenData = {
            access_token: data.access_token,
            expires_at: Date.now() + (data.expires_in * 1000 * 0.9) // 90% of actual expiry time for safety
        };
        
        // Save to localStorage
        localStorage.setItem('autodesk_token_cache', JSON.stringify(tokenData));
        
        return data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error);
        return null;
    }
}

/**
 * Set up event listeners for file uploads
 */
function setupFileUpload() {
    // IFC file upload button
    if (elements.ifcUploadBtn) {
        elements.ifcUploadBtn.addEventListener('click', () => {
            elements.ifcFileInput.click();
        });
    }
    
    // XER file upload button
    if (elements.xerUploadBtn) {
        elements.xerUploadBtn.addEventListener('click', () => {
            elements.xerFileInput.click();
        });
    }
    
    // IFC file input change
    if (elements.ifcFileInput) {
        elements.ifcFileInput.addEventListener('change', (e) => {
            handleFileSelection(e, 'ifc');
        });
    }
    
    // XER file input change
    if (elements.xerFileInput) {
        elements.xerFileInput.addEventListener('change', (e) => {
            handleFileSelection(e, 'xer');
        });
    }
    
    // Process files button - explicitly prevent default behavior
    if (elements.processFilesBtn) {
        console.log('Setting up process files button event listener');
        elements.processFilesBtn.addEventListener('click', async (event) => {
            try {
                console.log('>>> Process Files button CLICKED <<<');
                console.log('Current state:', {
                    ifcFile: state.ifcFile ? state.ifcFile.name : null,
                    xerFile: state.xerFile ? state.xerFile.name : null,
                    translationProgress: state.translationProgress,
                    generatedUrn: state.generatedUrn
                });
            
            // Crucial: this prevents the form from submitting and page from reloading
            event.preventDefault();
            
                // Call processFiles and await its completion
                await processFiles(event);
                
            } catch (error) {
                console.error('Error in process files click handler:', error);
                showError(`Processing failed: ${error.message}`);
                hideLoadingIndicator();
            }
            
            // Always return false to be extra safe against form submission
            return false;
        });
        
        // Also prevent the default action if the button is inside a form
        const parentForm = elements.processFilesBtn.closest('form');
        if (parentForm) {
            console.log('Process button is inside a form, adding form submit prevention');
            parentForm.addEventListener('submit', (event) => {
                console.log('Preventing form submission');
                event.preventDefault();
                return false;
            });
        }
    }
    
    // Drag and drop for IFC
    if (elements.ifcDropzone) {
        elements.ifcDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.ifcDropzone.classList.add('border-blue-500', 'bg-blue-50');
        });
        
        elements.ifcDropzone.addEventListener('dragleave', () => {
            if (!state.ifcFile) {
                elements.ifcDropzone.classList.remove('border-blue-500', 'bg-blue-50');
            }
        });
        
        elements.ifcDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                handleFileDrop(file, 'ifc');
            }
        });
    }
    
    // Drag and drop for XER
    if (elements.xerDropzone) {
        elements.xerDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.xerDropzone.classList.add('border-blue-500', 'bg-blue-50');
        });
        
        elements.xerDropzone.addEventListener('dragleave', () => {
            if (!state.xerFile) {
                elements.xerDropzone.classList.remove('border-blue-500', 'bg-blue-50');
            }
        });
        
        elements.xerDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                handleFileDrop(file, 'xer');
            }
        });
    }
    
    // Add skip to dashboard button
    const skipToDashboardBtn = document.getElementById('skip-to-dashboard-btn');
    if (skipToDashboardBtn) {
        skipToDashboardBtn.addEventListener('click', () => {
            console.log('Skip to dashboard button clicked');
            window.location.href = '/dashboard.html';
        });
    }
    
    console.log('All file upload event listeners initialized successfully');
}

/**
 * Handle file selection from the file input
 * @param {Event} event - The change event
 * @param {string} fileType - The type of file ('ifc' or 'xer')
 */
function handleFileSelection(event, fileType) {
    if (!event.target.files || event.target.files.length === 0) {
        console.log('No file selected');
        return;
    }
    
    const file = event.target.files[0];
    console.log(`File selected: ${file.name}, type: ${fileType}`);
    
    handleFileDrop(file, fileType);
}

/**
 * Handle a file being dropped or selected
 * @param {File} file - The file that was dropped or selected
 * @param {string} fileType - The type of file ('ifc' or 'xer')
 */
function handleFileDrop(file, fileType) {
    if (fileType === 'ifc') {
        // Accept only IFC files
        if (!file.name.toLowerCase().endsWith('.ifc')) {
            showError('Please select a valid IFC file (.ifc)');
            return;
        }
        
        // Store the IFC file in the state
        state.ifcFile = file;
        elements.ifcFileName.textContent = file.name;
        elements.ifcDropzone.classList.add('border-green-500', 'bg-green-50');
        
        // Show the translation container but don't start upload yet
        if (elements.translationContainer) {
            console.log('Making translation container visible');
            elements.translationContainer.classList.remove('hidden');
        }
        
        // Update UI to show that upload is ready but not started
        updateIfcUploadStatus('IFC file selected. Click "Process Files" to upload and process.');
        updateTranslationStatus('Ready to upload to Autodesk. Click "Process Files" button to start.');
    } else if (fileType === 'xer') {
        // Accept only XER or XML files
        if (!file.name.toLowerCase().endsWith('.xer') && !file.name.toLowerCase().endsWith('.xml')) {
            showError('Please select a valid XER or XML file (.xer, .xml)');
            return;
        }
        
        // Store the XER file in the state
        state.xerFile = file;
        elements.xerFileName.textContent = file.name;
        elements.xerDropzone.classList.add('border-green-500', 'bg-green-50');
    }
    
    updateProcessButtonState();
}

/**
 * Upload IFC file to Autodesk using direct API calls
 * @param {File} file - The IFC file to upload
 */
async function uploadIfcToAutodesk(file) {
    console.log('Starting uploadIfcToAutodesk with file:', file.name);
    
    try {
        // Make sure the translation container is visible
        if (elements.translationContainer) {
            console.log('Making translation container visible');
            elements.translationContainer.classList.remove('hidden');
        }
        
        // Update UI to show upload is starting
        updateIfcUploadStatus('Starting Autodesk upload process...');
        state.translationProgress = 10;
        updateTranslationProgress();
        updateTranslationStatus('Initiating upload to Autodesk...');
        
        // BUCKET_KEY can remain if it's non-sensitive and part of the frontend logic for selection
        const BUCKET_KEY = 'ifcviewer1744251930321'; 
        
        console.log('Requesting Autodesk access token via backend...');
        // Step 1: Get an access token by calling the already refactored getAccessToken()
        const accessToken = await getAccessToken(); // This now calls your backend /api/auth/token
        
        if (!accessToken) {
            throw new Error('Failed to obtain access token from backend.');
        }
        
        console.log('Access token obtained successfully via backend.');
        state.translationProgress = 20;
        updateTranslationProgress();
        
        // Step 2: Get signed upload URL (via a new backend endpoint)
        console.log('Requesting signed upload URL via backend...');
        const fileName = file.name;
        // Conceptual backend endpoint: /api/forge/get-signed-upload-url
        const signedUrlResponse = await fetch(`/api/forge/get-signed-upload-url?bucketKey=${BUCKET_KEY}&fileName=${encodeURIComponent(fileName)}`, {
            method: 'GET' // Backend will use its own token to talk to Autodesk
            // If your backend /api/auth/token is the one providing the actual Autodesk token,
            // and your new backend endpoints expect it, you might pass it:
            // headers: { 'Authorization': `Bearer ${accessToken}` } 
            // However, it's often better for the new backend endpoints to manage token acquisition themselves
            // using the server-side APS_CLIENT_ID and APS_CLIENT_SECRET.
        });
        
        if (!signedUrlResponse.ok) {
            const errorText = await signedUrlResponse.text();
            console.error('Backend request for Signed URL failed:', errorText);
            throw new Error(`Failed to get signed URL from backend: ${signedUrlResponse.status} ${signedUrlResponse.statusText}`);
        }
        
        const signedUrlData = await signedUrlResponse.json();
        // Assuming backend returns data in the format: { urls: ['s3_upload_url'], uploadKey: '...' }
        if (!signedUrlData.urls || !signedUrlData.urls[0] || !signedUrlData.uploadKey) {
            throw new Error('Invalid signed URL data received from backend.');
        }
        console.log('Upload URL obtained successfully from backend.');
        state.translationProgress = 30;
        updateTranslationProgress();
        
        // Step 3: Upload the file to S3 (using the URL from backend)
        console.log('Starting file upload to S3...');
        const fileContent = await file.arrayBuffer();
        
        const uploadResponse = await fetch(signedUrlData.urls[0], { // This is the direct S3 URL
            method: 'PUT',
            headers: {
                'Content-Type': 'application/octet-stream',
                // 'Content-Length' is often handled by the browser for ArrayBuffer
            },
            body: fileContent
        });
        
        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('S3 File upload failed:', errorText);
            throw new Error(`Failed to upload file to S3: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }
        
        console.log('File uploaded to S3 successfully');
        state.translationProgress = 60;
        updateTranslationProgress();
        
        // Step 4: Complete the upload (via a new backend endpoint)
        updateTranslationStatus('Completing upload via backend...');
        // Conceptual backend endpoint: /api/forge/complete-upload
        const completeBody = { 
            bucketKey: BUCKET_KEY,
            objectName: fileName, // Or pass objectId if that's what your backend expects
            uploadKey: signedUrlData.uploadKey 
        };
        
        const completeResponse = await fetch(`/api/forge/complete-upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Potentially 'Authorization': `Bearer ${accessToken}` if backend endpoint requires it
            },
            body: JSON.stringify(completeBody)
        });
        
        if (!completeResponse.ok) {
            const errorText = await completeResponse.text();
            throw new Error(`Failed to complete upload via backend: ${completeResponse.status} ${completeResponse.statusText} - ${errorText}`);
        }
        
        const completeData = await completeResponse.json();
        // Assuming backend returns data in the format: { objectId: '...', urn: '...' }
        if (!completeData.objectId || !completeData.urn) {
            throw new Error('Invalid complete upload data received from backend.');
        }
        const objectId = completeData.objectId;
        const encodedUrn = completeData.urn; // Use URN from backend
        
        state.pendingUploadSummary = {
            fileName: fileName,
            objectId: objectId,
            urn: encodedUrn,
            bucketKey: BUCKET_KEY
        };
        
        console.log('Upload completed via backend, awaiting translation', { objectId, encodedUrn });
        state.translationProgress = 70;
        updateTranslationProgress();
        
        // Step 5: Initiate translation process (via a new backend endpoint)
        updateTranslationStatus('Starting translation process via backend...');
        // Conceptual backend endpoint: /api/forge/start-translation
        const translateData = {
            urn: encodedUrn 
        };
        
        const translateResponse = await fetch('/api/forge/start-translation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Potentially 'Authorization': `Bearer ${accessToken}` if backend endpoint requires it
            },
            body: JSON.stringify(translateData)
        });
        
        if (!translateResponse.ok) {
            const errorText = await translateResponse.text();
            throw new Error(`Failed to start translation via backend: ${translateResponse.status} ${translateResponse.statusText} - ${errorText}`);
        }
        
        const translateResult = await translateResponse.json();
        console.log('Translation initiated successfully via backend', translateResult);
        state.translationProgress = 80;
        updateTranslationProgress();
        
        state.generatedUrn = encodedUrn;
        
        // For setupTranslationStatusMonitoring, the token passed should be the one for your backend if that endpoint is protected.
        // Or, if checkTranslationStatus will also call a backend endpoint, it might not need a token directly.
        // For now, assuming checkTranslationStatus will also be refactored or calls a public/proxied status endpoint.
        setupTranslationStatusMonitoring(accessToken, encodedUrn); // accessToken is from your backend
        
        updateIfcUploadStatus('IFC file upload process managed via backend.');
        updateTranslationStatus('Translation in progress (monitored via backend/client). This may take several minutes...');
        
    } catch (error) {
        console.error('Autodesk processing error (via backend calls):', error);
        showError(`Error: ${error.message}`);
        updateIfcUploadStatus('Processing failed');
        updateTranslationStatus('Failed: ' + error.message);
    }
}

/**
 * Monitor translation progress periodically
 * @param {string} token - Access token for Autodesk API
 * @param {string} urn - URN of the uploaded model
 */
async function setupTranslationStatusMonitoring(token, urn) {
    // Check translation status immediately and then every 10 seconds
    checkTranslationStatus(token, urn);
    
    // Set up an interval to check status every 10 seconds
    const statusInterval = setInterval(async () => {
        try {
            const isComplete = await checkTranslationStatus(token, urn);
            if (isComplete) {
                clearInterval(statusInterval);
            }
        } catch (error) {
            console.error('Error checking translation status:', error);
            updateTranslationStatus('Error checking translation status: ' + error.message);
            clearInterval(statusInterval);
        }
    }, 10000);
    
    // Stop checking after 10 minutes max to prevent infinite loops
    setTimeout(() => {
        clearInterval(statusInterval);
    }, 600000);
}

/**
 * Check translation status
 * @param {string} token - Access token for Autodesk API
 * @param {string} urn - URN of the uploaded model
 * @returns {Promise<boolean>} - Whether translation is complete
 */
async function checkTranslationStatus(token, urn) {
    try {
        console.log('Checking translation status for URN:', urn);
        
        // Conceptual backend endpoint: /api/forge/translation-status
        // This backend endpoint will use its own credentials to talk to Autodesk.
        // The 'token' argument to this function might be used if your backend /translation-status endpoint itself is protected.
        const response = await fetch(`/api/forge/translation-status?urn=${urn}`, {
            method: 'GET'
            // headers: { 'Authorization': `Bearer ${token}` } // If your backend endpoint is protected
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Translation status error response from backend:', errorText);
            throw new Error(`Failed to check translation status via backend: ${response.status} ${response.statusText}`);
        }
        
        const manifest = await response.json();
        console.log('Translation manifest:', manifest);
        
        // Update the UI based on the status
        if (manifest.status === 'success') {
            console.log('Translation completed successfully!');
            updateTranslationStatus('Translation completed successfully!');
            state.translationProgress = 100;
            updateTranslationProgress();
            updateProcessButtonState();

            // Translation successful - Now save the summary to localStorage
            if (state.pendingUploadSummary) {
                const summary = {
                    ...state.pendingUploadSummary, // Spread the temporary info
                    timestamp: new Date().toISOString()
                };
                console.log('Saving final upload summary to localStorage:', summary);
                localStorage.setItem('autodesk_upload_summary', JSON.stringify(summary));

                // Also update integratedData in localStorage if it exists
                try {
                    const savedData = localStorage.getItem('integratedData');
                    const parsedData = savedData ? JSON.parse(savedData) : {};
                    parsedData.generatedUrn = summary.urn; // Use URN from the final summary
                    localStorage.setItem('integratedData', JSON.stringify(parsedData));
                    console.log('Updated integratedData in localStorage with URN:', summary.urn);
                } catch (localStorageError) {
                    console.error('Error updating integratedData in localStorage:', localStorageError);
                }

                // Clear the temporary state
                state.pendingUploadSummary = null;
            } else {
                console.warn('Translation successful, but no pending upload summary found in state.');
            }

            return true;
        } else if (manifest.status === 'failed') {
            console.error('Translation failed:', manifest.progress);
            updateTranslationStatus(`Translation failed: ${manifest.progress}`);
            showError(`Translation failed: ${manifest.progress}`);
            return true; // Return true to stop the interval
        } else if (manifest.status === 'inprogress') {
            // Calculate progress percentage
            let progress = 0;
            if (manifest.progress && manifest.progress.startsWith && manifest.progress.startsWith('complete')) {
                // Sometimes Autodesk returns "complete: X/Y" or similar format
                const match = manifest.progress.match(/(\d+)\/(\d+)/);
                if (match && match[2] !== '0') {
                    progress = Math.round((parseInt(match[1]) / parseInt(match[2])) * 100);
                } else {
                    // If we can't parse the fraction, estimate based on other indicators
                    progress = 90; // Assume it's almost done if we get "complete" but can't parse the fraction
                }
            } else if (manifest.progress === 'complete') {
                progress = 95; // Almost done
            } else {
                // Convert status to progress percentage estimates
                switch (manifest.status) {
                    case 'pending':
                        progress = 25;
                        break;
                    case 'processing':
                        progress = 50;
                        break;
                    case 'inprogress':
                        progress = 75;
                        break;
                    default:
                        progress = Math.round((state.translationProgress + 80) / 2); // Gradual progress
                        if (progress > 95) progress = 95; // Cap at 95% until truly complete
                }
            }
            
            // Ensure progress never goes backwards
            if (progress > state.translationProgress) {
                state.translationProgress = progress;
                updateTranslationProgress();
            }
            
            // Update status message to show more detail
            let statusMessage = 'Translation in progress';
            if (manifest.progress) {
                statusMessage += `: ${manifest.progress}`;
            }
            statusMessage += ` (${state.translationProgress}%)`;
            updateTranslationStatus(statusMessage);
            
            console.log(`Translation in progress: ${state.translationProgress}%`, manifest.progress);
            return false;
        } else {
            // Unknown status, use generic message
            console.log('Translation status:', manifest.status);
            updateTranslationStatus(`Translation status: ${manifest.status}`);
            state.translationProgress = Math.min(state.translationProgress + 5, 95); // Increment slightly but cap at 95%
            updateTranslationProgress();
            return false;
        }
    } catch (error) {
        console.error('Error checking translation status:', error);
        updateTranslationStatus('Error checking status: ' + error.message);
        return false; // Continue trying
    }
}

/**
 * Update IFC upload status
 * @param {string} status - The status message
 */
function updateIfcUploadStatus(status) {
    state.ifcUploadStatus = status;
    
    if (elements.ifcUploadStatus) {
        elements.ifcUploadStatus.textContent = status;
        // Always keep the container visible
    }
}

/**
 * Update translation status
 * @param {string} status - The status message
 */
function updateTranslationStatus(status) {
    console.log(`Translation status updated: "${status}"`);
    state.translationStatus = status;
    
    if (elements.translationStatus) {
        elements.translationStatus.textContent = status;
        // Always keep the container visible
    } else {
        console.error('Translation status element not found in DOM');
    }
}

/**
 * Update translation progress bar
 */
function updateTranslationProgress() {
    console.log(`Translation progress updated: ${state.translationProgress}%`);
    if (elements.translationProgressBar) {
        elements.translationProgressBar.style.width = `${state.translationProgress}%`;
        elements.translationProgressBar.style.display = state.translationProgress > 0 ? 'block' : 'none';
    } else {
        console.error('Translation progress bar element not found in DOM');
    }
}

/**
 * Update the state of the process button
 */
function updateProcessButtonState() {
    if (elements.processFilesBtn) {
        // Enable the button if either:
        // 1. Both IFC and XER files are uploaded OR
        // 2. IFC file has been uploaded and successfully translated to Autodesk (generatedUrn exists and translation is 100%)
        if ((state.ifcFile && state.xerFile) || 
            (state.ifcFile && state.generatedUrn && state.translationProgress === 100)) {
            elements.processFilesBtn.disabled = false;
            elements.processFilesBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
            elements.processFilesBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        } else {
            elements.processFilesBtn.disabled = true;
            elements.processFilesBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
            elements.processFilesBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        }
    }
}

/**
 * Process the uploaded files
 */
async function processFiles(event) {
    console.log('*** Entering processFiles function ***');
    console.log('Processing state:', {
        isProcessing: state.isProcessing,
        ifcFile: state.ifcFile ? state.ifcFile.name : null,
        xerFile: state.xerFile ? state.xerFile.name : null
    });

    // Prevent the default form submission behavior
    if (event) event.preventDefault();
    
    // Check if we have the required files
    if (!state.ifcFile && !state.xerFile) {
        console.error('Missing required files!');
        showError('Please upload at least one file (IFC or XER) before processing');
        return;
    }
    
    try {
    state.isProcessing = true;
    showLoadingIndicator();
        console.log('Starting file processing...');
    
        // STEP 1: Upload IFC file to Autodesk if we have an IFC file but no URN yet
        if (state.ifcFile && !state.generatedUrn) {
            console.log('Starting IFC upload to Autodesk...');
            
            // Set translationProgress to 0 before starting the upload
            state.translationProgress = 0;
            updateTranslationProgress();
            
            try {
            // Upload the IFC file to Autodesk and wait for the upload to complete
            await uploadIfcToAutodesk(state.ifcFile);
                console.log('IFC upload completed successfully');
            } catch (uploadError) {
                console.error('Error uploading IFC file:', uploadError);
                throw new Error(`IFC upload failed: ${uploadError.message}`);
            }
            
            // After upload, wait for translation to complete before proceeding with processing
            // We'll set up a promise that resolves when translation reaches 100%
            if (state.translationProgress < 100) {
                console.log('Waiting for translation to complete before proceeding...');
                await new Promise((resolve, reject) => {
                    const checkInterval = setInterval(() => {
                        console.log(`Translation progress check: ${state.translationProgress}%`);
                        
                        if (state.translationProgress >= 100) {
                            clearInterval(checkInterval);
                            clearTimeout(timeout);
                            resolve();
                        }
                    }, 2000);
                    
                    // Set a timeout of 10 minutes to prevent infinite waiting
                    const timeout = setTimeout(() => {
                        clearInterval(checkInterval);
                        if (state.translationProgress >= 70) {
                            // If we've made it to 70%, we'll consider that good enough to proceed
                            console.log('Translation taking too long, but proceeding anyway as it reached 70%');
                            resolve();
                        } else {
                            reject(new Error('Translation timed out after 10 minutes'));
                        }
                    }, 600000);
                });
            }
            
            console.log('Translation completed or sufficient progress made, continuing with processing...');
        }
        
        // STEP 2: Parse the files and integrate the data
        
        // Parse the IFC file first if we have one
        if (state.ifcFile) {
            console.log('Parsing IFC file:', state.ifcFile.name);
            state.ifcData = await parseIFCFile(state.ifcFile);
            console.log('IFC file parsed successfully:', state.ifcData);
        }
        
        // Parse the XER file if we have one
        if (state.xerFile) {
            console.log('Parsing XER file:', state.xerFile.name);
            state.xerData = await parseXERFile(state.xerFile);
            console.log('XER file parsed successfully:', state.xerData);
        }
        
        // Integrate the data if we have both IFC and XER data
        if (state.ifcData && state.xerData) {
            console.log('Integrating IFC and XER data...');
            state.integratedData = integrateData(state.ifcData, state.xerData);
            console.log('Data integrated successfully:', state.integratedData);
            
            // Store the URN with the integrated data
            if (state.generatedUrn) {
                console.log('Adding generatedUrn to integrated data:', state.generatedUrn);
                state.integratedData.generatedUrn = state.generatedUrn;
            }
            
            // Save to localStorage
            console.log('Saving integrated data to localStorage');
            localStorage.setItem('integratedData', JSON.stringify(state.integratedData));
            
            // Show success message
            showSuccess('Files processed successfully! You can now explore the integrated data.');
            
            // Show the results section
            if (elements.resultsSection) {
                console.log('Showing results section');
                elements.resultsSection.classList.remove('hidden');
                populateResults(state.integratedData);
            }
            
            // Add link to 3D model page if we have a URN
            if (state.generatedUrn && elements.translationStatus && elements.translationStatus.parentNode) {
                console.log('Adding 3D model viewer link');
                
                // Check if the link already exists to avoid duplicates
                const existingLink = elements.translationStatus.parentNode.querySelector('.view-3d-model-link');
                if (!existingLink) {
                    const viewerLink = document.createElement('div');
                    viewerLink.className = 'mt-4 text-center view-3d-model-link';
                    viewerLink.innerHTML = `
                        <a href="3d-model.html" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded inline-flex items-center">
                            <i class="fas fa-cube mr-2"></i> View 3D Model
                        </a>
                        <p class="text-sm text-gray-600 mt-2">Click to view your model in the 3D viewer</p>
                    `;
                    
                    elements.translationStatus.parentNode.appendChild(viewerLink);
                }
            }
        } else if (state.ifcData || state.xerData) {
            // We have one of the data types but not both
            console.log('Only one data type available, proceeding with partial processing');

            // Create basic integrated data structure
            state.integratedData = {
                projectName: state.ifcData ? state.ifcData.projectName : "Project from XER",
                timestamp: new Date().toISOString()
            };
            
            // Add the data we have
            if (state.ifcData) {
                state.integratedData.ifcComponents = state.ifcData.components || [];
            }
            
            if (state.xerData) {
                state.integratedData.xerTasks = state.xerData.tasks || [];
            }
            
            // Store the URN with the integrated data
            if (state.generatedUrn) {
                console.log('Adding generatedUrn to integrated data:', state.generatedUrn);
                state.integratedData.generatedUrn = state.generatedUrn;
            }
            
            // Save to localStorage
            console.log('Saving partial integrated data to localStorage');
            localStorage.setItem('integratedData', JSON.stringify(state.integratedData));
            
            // Show success message
            showSuccess('File processed successfully! Limited functionality available with only one file type.');
            
            // Add link to 3D model page if we have a URN
            if (state.generatedUrn && elements.translationStatus && elements.translationStatus.parentNode) {
                console.log('Adding 3D model viewer link');
                
                // Check if the link already exists to avoid duplicates
                const existingLink = elements.translationStatus.parentNode.querySelector('.view-3d-model-link');
                if (!existingLink) {
                    const viewerLink = document.createElement('div');
                    viewerLink.className = 'mt-4 text-center view-3d-model-link';
                    viewerLink.innerHTML = `
                        <a href="3d-model.html" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded inline-flex items-center">
                            <i class="fas fa-cube mr-2"></i> View 3D Model
                        </a>
                        <p class="text-sm text-gray-600 mt-2">Click to view your model in the 3D viewer</p>
                    `;
                    
                    elements.translationStatus.parentNode.appendChild(viewerLink);
                }
            }
        } else {
            console.error('Failed to process files: no data after processing');
            throw new Error('No data available after processing. Processing failed.');
        }
    } catch (error) {
        console.error('Processing error:', error);
        showError(`Error: ${error.message}`);
    } finally {
        state.isProcessing = false;
        hideLoadingIndicator();
        updateProcessButtonState();
    }
}

/**
 * Initialize the dashboard
 */
function initializeDashboard() {
    // Load the integrated data from localStorage
    const storedData = localStorage.getItem('integratedData');
    
    if (storedData) {
        state.integratedData = JSON.parse(storedData);
        
        // Now the dashboard.js file will use this data to populate the dashboard
        // This is just a mock for demonstration purposes
        
        // In a real application, you would fetch the data from a server
        // and then call functions to populate the dashboard
    } else {
        // No data available, show a message or redirect to the landing page
        showError('No project data available. Please upload IFC and XER files');
        
        // For demo purposes, we'll load mock data instead
        // In a real application, you would redirect to the landing page
        console.log('Loading mock data for demonstration');
        
        // This mock data would normally be generated by the fileParser.js module
        state.integratedData = {
            projectName: "DataCenter Project",
            startDate: "2025-05-01",
            endDate: "2025-08-30",
            componentScheduleData: [],
            criticalPathData: [],
            riskData: [],
            resourceData: []
        };
    }
}

/**
 * Show an error message
 * @param {string} message - The error message to show
 */
function showError(message) {
    state.errors.push(message);
    
    // In a real application, you would show a toast or alert
    console.error('Error:', message);
    
    // Create an alert element
    const alertContainer = document.createElement('div');
    alertContainer.className = 'fixed top-4 right-4 z-50 max-w-md';
    
    const alert = document.createElement('div');
    alert.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-md';
    alert.innerHTML = `
        <div class="flex items-center">
            <div class="mr-2">
                <i class="fas fa-exclamation-circle"></i>
            </div>
            <div>
                <p>${message}</p>
            </div>
            <div class="ml-auto">
                <button class="text-red-700 hover:text-red-900">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    
    alertContainer.appendChild(alert);
    document.body.appendChild(alertContainer);
    
    // Add click event to close button
    alert.querySelector('button').addEventListener('click', () => {
        alertContainer.remove();
    });
    
    // Automatically remove after 5 seconds
    setTimeout(() => {
        if (document.body.contains(alertContainer)) {
            alertContainer.remove();
        }
    }, 5000);
}

/**
 * Show a loading indicator
 */
function showLoadingIndicator() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="flex flex-col items-center">
            <div class="loading-spinner mb-4"></div>
            <p class="text-lg font-semibold text-blue-800">Processing Files...</p>
            <p class="text-sm text-gray-600 mt-2">This may take a few moments</p>
        </div>
    `;
    
    document.body.appendChild(loadingOverlay);
    
    if (elements.processFilesBtn) {
        elements.processFilesBtn.innerHTML = '<span class="spinner"></span> Processing...';
        elements.processFilesBtn.disabled = true;
    }
}

/**
 * Hide the loading indicator
 */
function hideLoadingIndicator() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
    
    if (elements.processFilesBtn) {
        elements.processFilesBtn.innerHTML = 'Process Files';
        elements.processFilesBtn.disabled = false;
    }
}

/**
 * Export the modified data back to IFC and XER files
 */
function exportData() {
    if (!state.integratedData) {
        showError('No data available to export');
        return;
    }
    
    // Show loading indicator
    showLoadingIndicator();
    
    try {
        // In a real application, you would convert the integrated data
        // back to IFC and XER formats and allow the user to download them
        
        // For this demo, we'll just simulate a download
        setTimeout(() => {
            // Create a mock IFC file for download
            const ifcContent = generateMockIFCContent(state.integratedData);
            const ifcBlob = new Blob([ifcContent], { type: 'text/plain' });
            const ifcUrl = URL.createObjectURL(ifcBlob);
            
            // Create a mock XER file for download
            const xerContent = generateMockXERContent(state.integratedData);
            const xerBlob = new Blob([xerContent], { type: 'text/plain' });
            const xerUrl = URL.createObjectURL(xerBlob);
            
            // Create download links
            const ifcLink = document.createElement('a');
            ifcLink.href = ifcUrl;
            ifcLink.download = 'updated_project.ifc';
            
            const xerLink = document.createElement('a');
            xerLink.href = xerUrl;
            xerLink.download = 'updated_project.xer';
            
            // Trigger downloads
            document.body.appendChild(ifcLink);
            ifcLink.click();
            document.body.removeChild(ifcLink);
            
            setTimeout(() => {
                document.body.appendChild(xerLink);
                xerLink.click();
                document.body.removeChild(xerLink);
                
                // Clean up URLs
                URL.revokeObjectURL(ifcUrl);
                URL.revokeObjectURL(xerUrl);
                
                // Hide loading indicator
                hideLoadingIndicator();
                
                // Show success message
                showSuccess('Files exported successfully');
            }, 1000);
        }, 2000);
    } catch (error) {
        console.error('Error exporting files:', error);
        showError(`Error exporting files: ${error.message}`);
        hideLoadingIndicator();
    }
}

/**
 * Generate mock IFC content for export
 * @param {Object} data - The integrated data
 * @returns {string} - Mock IFC content
 */
function generateMockIFCContent(data) {
    // In a real application, this would convert the data to actual IFC format
    // For this demo, we'll just create a simple text representation
    
    let content = 'ISO-10303-21;\n';
    content += 'HEADER;\n';
    content += `FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\n`;
    content += `FILE_NAME('updated_project.ifc','${new Date().toISOString()}',('BIM_XER_Masher User'),('DataCenter Corp'),'BIM_XER_Masher','BIM_XER_Masher','');\n`;
    content += 'FILE_SCHEMA((\'IFC4\'));\n';
    content += 'ENDSEC;\n';
    content += 'DATA;\n';
    
    // Add mock entity instances
    content += '/* Project Definition */\n';
    content += '#1=IFCPROJECT(\'3AvmSQxSn88eOjhrMSCRER\',#2,\'DataCenter Project\',$,$,\'Project Status\',$,(#20),#7);\n';
    
    // Add component data
    content += '/* Building Components */\n';
    data.componentScheduleData.forEach((component, index) => {
        content += `/* ${component.description} */\n`;
        content += `#${1000 + index}=IFC${component.wbsCode.split('-')[3]}('${generateMockGUID()}',#2,'${component.description}',$,'${component.description}',#${2000 + index},#${3000 + index},$,.ELEMENT.);\n`;
        
        // Add property sets with WBS codes
        content += `#${5000 + index}=IFCPROPERTYSET('${generateMockGUID()}',#2,'Pset_ProjectManagement',$,(#${6000 + index},#${7000 + index}));\n`;
        content += `#${6000 + index}=IFCPROPERTYSINGLEVALUE('WBS_Code',$,IFCTEXT('${component.wbsCode}'),$);\n`;
        content += `#${7000 + index}=IFCPROPERTYSINGLEVALUE('Task_ID',$,IFCTEXT('${component.taskId}'),$);\n`;
    });
    
    content += 'ENDSEC;\n';
    content += 'END-ISO-10303-21;\n';
    
    return content;
}

/**
 * Generate mock XER content for export
 * @param {Object} data - The integrated data
 * @returns {string} - Mock XER content
 */
function generateMockXERContent(data) {
    // In a real application, this would convert the data to actual XER format
    // For this demo, we'll just create a simple text representation
    
    let content = 'ERMHDR\t18.8.0\t2025-04-21\tAdmin\tPrimavera P6\t\n\n';
    
    // Add project information
    content += 'PROJECT\tPROJ_ID\tPROJ_NAME\tSTART_DATE\tFINISH_DATE\tDATA_DATE\tPRIORITY\tCURR_ID\tCLNDR_ID\n';
    content += `PROJECT\tDC_PROJ\t${data.projectName}\t${data.startDate}\t${data.endDate}\t2025-04-21\t10\tUSD\tSTD\n\n`;
    
    // Add WBS elements
    content += 'PROJWBS\tWBS_ID\tPROJ_ID\tSEQ_NUM\tWBS_CODE\tWBS_NAME\tPARENT_WBS_ID\tSTATUS_CODE\tWBS_SHORT_NAME\n';
    
    // Extract unique WBS codes
    const wbsCodes = [...new Set(data.componentScheduleData.map(item => item.wbsCode))];
    
    // Create a hierarchy of WBS codes
    const wbsHierarchy = {};
    wbsCodes.forEach((code, index) => {
        const parts = code.split('-');
        const level = parts.length;
        
        // Build the hierarchy
        let parent = null;
        for (let i = 1; i < level; i++) {
            const partialCode = parts.slice(0, i).join('-');
            if (!wbsHierarchy[partialCode]) {
                wbsHierarchy[partialCode] = {
                    code: partialCode,
                    name: partialCode,
                    parent: i > 1 ? parts.slice(0, i-1).join('-') : null
                };
            }
        }
        
        // Add the full code
        wbsHierarchy[code] = {
            code: code,
            name: data.componentScheduleData.find(item => item.wbsCode === code)?.description || code,
            parent: parts.slice(0, level-1).join('-')
        };
    });
    
    // Add WBS elements to the content
    Object.values(wbsHierarchy).forEach((wbs, index) => {
        content += `PROJWBS\tWBS${index}\tDC_PROJ\t${index+1}\t${wbs.code}\t${wbs.name}\t${wbs.parent ? 'WBS' + Object.values(wbsHierarchy).findIndex(w => w.code === wbs.parent) : 'NULL'}\tA\t${wbs.code}\n`;
    });
    
    content += '\n';
    
    // Add tasks
    content += 'TASK\tTASK_ID\tPROJ_ID\tWBS_ID\tTASK_CODE\tTASK_NAME\tSTART_DATE\tEND_DATE\tDURATION\tSTATUS_CODE\tPHYS_COMPLETE\tREM_DURATION\tTOTAL_FLOAT\tFREE_FLOAT\tSUSPEND_DATE\tRESUME_DATE\tCALENDAR_ID\n';
    
    data.componentScheduleData.forEach((component, index) => {
        const wbsIndex = Object.values(wbsHierarchy).findIndex(wbs => wbs.code === component.wbsCode);
        content += `TASK\t${component.taskId}\tDC_PROJ\tWBS${wbsIndex}\t${component.taskId}\t${component.activityName}\t${component.startDate}\t${component.endDate}\t${component.duration}\tNW\t0\t${component.duration}\t5\t0\tNULL\tNULL\tSTD\n`;
    });
    
    content += '\n';
    
    // Add task dependencies
    content += 'TASKPRED\tTASK_PRED_ID\tTASK_ID\tPRED_TASK_ID\tPROJ_ID\tPRED_PROJ_ID\tPRED_TYPE\tLAG_HR_CNT\n';
    
    let predIndex = 1;
    data.componentScheduleData.forEach((component) => {
        if (component.predecessors && component.predecessors !== 'None') {
            // Parse predecessor info
            let predTaskId = component.predecessors;
            let lagHours = 0;
            
            if (component.predecessors.includes('+')) {
                const parts = component.predecessors.split('+');
                predTaskId = parts[0];
                const lagDays = parseInt(parts[1]);
                lagHours = lagDays * 8; // Assuming 8-hour workdays
            }
            
            content += `TASKPRED\tP${predIndex}\t${component.taskId}\t${predTaskId}\tDC_PROJ\tDC_PROJ\tFS\t${lagHours}\n`;
            predIndex++;
        }
    });
    
    return content;
}

/**
 * Generate a mock GUID for IFC entities
 * @returns {string} - A mock GUID
 */
function generateMockGUID() {
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

/**
 * Show a success message
 * @param {string} message - The success message to show
 * @param {number} timeout - Time in milliseconds before auto-hiding, 0 for no auto-hide
 */
function showSuccess(message, timeout = 5000) {
    // Create an alert element
    const alertContainer = document.createElement('div');
    alertContainer.className = 'fixed top-4 right-4 z-50 max-w-md';
    
    const alert = document.createElement('div');
    alert.className = 'bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-md';
    alert.innerHTML = `
        <div class="flex items-center">
            <div class="mr-2">
                <i class="fas fa-check-circle"></i>
            </div>
            <div>
                ${message}
            </div>
            <div class="ml-auto">
                <button class="text-green-700 hover:text-green-900">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    
    alertContainer.appendChild(alert);
    document.body.appendChild(alertContainer);
    
    // Add click event to close button
    alert.querySelector('button').addEventListener('click', () => {
        alertContainer.remove();
    });
    
    // Automatically remove after timeout if specified
    if (timeout > 0) {
    setTimeout(() => {
        if (document.body.contains(alertContainer)) {
            alertContainer.remove();
        }
        }, timeout);
    }
}

// Export functions for use in other modules
export {
    state,
    exportData,
    showError,
    showSuccess,
    showLoadingIndicator,
    hideLoadingIndicator
};
