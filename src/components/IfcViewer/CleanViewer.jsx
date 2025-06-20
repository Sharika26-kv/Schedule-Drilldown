import React, { useEffect, useRef, useState } from 'react';

// Viewer component with improved token handling
const CleanViewer = ({ modelUrn }) => { 
  const viewerRef = useRef(null);
  const viewerContainerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modelData, setModelData] = useState([]);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [noUrnAvailable, setNoUrnAvailable] = useState(false);
  
  // Default project URN - will be used if no URN is found in localStorage
  const DEFAULT_PROJECT_URN = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWZjdmlld2VyMTc0NDI1MTkzMDMyMS9EYXRhQ2VudGVyX1Byb2plY3QuaWZj';
  
  // Initialize the viewer once the component mounts
  useEffect(() => {
    loadViewerScripts();
    
    // Cleanup function
    return () => {
      if (viewerRef.current) {
        viewerRef.current.finish();
        viewerRef.current = null; // Clear the ref
      }
      
      // Cleanup scripts/styles
      const existingScripts = document.querySelectorAll('script[data-viewer-script]');
      existingScripts.forEach(script => script.remove());
      const existingStyles = document.querySelectorAll('link[data-viewer-style]');
      existingStyles.forEach(style => style.remove());
    };
  }, []);

  // Initialize the viewer with the loaded scripts
  const initializeViewer = async () => {
    if (!window.Autodesk) {
      console.error('Autodesk Viewer scripts not loaded properly');
      setError('Autodesk Viewer failed to load');
      return;
    }
    
    console.log('Initializing Autodesk Viewer...');
    setLoading(true);
    
    // Debug the localStorage and URN flow here
    console.log('=== URN FLOW DEBUG ===');
    console.log('Provided modelUrn from props:', modelUrn);
    
    // Check autodesk_upload_summary
    const uploadSummary = localStorage.getItem('autodesk_upload_summary');
    if (uploadSummary) {
      try {
        const summaryData = JSON.parse(uploadSummary);
        console.log('Found autodesk_upload_summary in localStorage:', summaryData);
      } catch (err) {
        console.error('Error parsing autodesk_upload_summary:', err);
      }
    } else {
      console.log('No autodesk_upload_summary found in localStorage');
    }
    
    // Check integratedData
    const integratedData = localStorage.getItem('integratedData');
    if (integratedData) {
      try {
        const parsedData = JSON.parse(integratedData);
        console.log('Found integratedData in localStorage:', parsedData);
        console.log('Generated URN from integratedData:', parsedData.generatedUrn);
      } catch (err) {
        console.error('Error parsing integratedData:', err);
      }
    } else {
      console.log('No integratedData found in localStorage');
    }
    
    // Check token cache
    const tokenCache = localStorage.getItem('autodesk_token_cache');
    if (tokenCache) {
      try {
        const parsedCache = JSON.parse(tokenCache);
        console.log('Found token cache with expiry:', new Date(parsedCache.expires_at).toLocaleString());
        // Don't log the full token for security
        console.log('Token starts with:', parsedCache.access_token.substring(0, 10) + '...');
      } catch (err) {
        console.error('Error parsing token cache:', err);
      }
    }
    console.log('=== END DEBUG ===');

    const options = {
      env: 'AutodeskProduction',
      api: 'derivativeV2',
      getAccessToken: async (onTokenReady) => {
        try {
          console.log('getAccessToken callback invoked');
          const token = await getAccessToken();
          if (token) {
            console.log('Token obtained successfully, first 10 chars:', token.substring(0, 10) + '...');
            onTokenReady(token, 3600); // Use fixed expiry time of 1 hour
          } else {
            console.error('Failed to obtain access token');
            setError('Failed to obtain access token');
          }
        } catch (error) {
          console.error('Error in getAccessToken callback:', error);
          setError(`Token error: ${error.message}`);
        }
      },
    };

    window.Autodesk.Viewing.Initializer(options, () => {
      try {
        // Add a proxy to intercept API calls from the viewer
        const originalFetch = window.fetch;
        window.fetch = function(url, options) {
          // Only log Autodesk API calls
          if (url && typeof url === 'string' && 
             (url.includes('developer.api.autodesk.com') || url.includes('cdn.derivative.autodesk.com'))) {
            console.log('Viewer API call:', url);
            if (options && options.headers) {
              // Log if we have auth header (but not the full token)
              const hasAuth = options.headers.Authorization || 
                             (options.headers.get && options.headers.get('Authorization'));
              console.log('Has Authorization header:', !!hasAuth);
            }
          }
          return originalFetch.apply(this, arguments);
        };

        const viewer = new window.Autodesk.Viewing.GuiViewer3D(viewerContainerRef.current);
        viewerRef.current = viewer;

        const startCode = viewer.start();
        if (startCode > 0) {
          console.error('Failed to start viewer, error code:', startCode);
          setError(`Failed to start viewer (code: ${startCode})`);
          return;
        }

        console.log('Viewer initialized successfully');
        viewer.addEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeometryLoaded);
        viewer.addEventListener(window.Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, onObjectTreeCreated);

        // Determine which URN to load - prefer uploaded model or use default
        let urnToLoad = null;
        try {
          // First check if a URN was directly provided to the component
          if (modelUrn) {
            urnToLoad = modelUrn;
            console.log('Using provided URN from props:', urnToLoad);
          } else {
            // Then try to get the latest URN from summary file
            const uploadSummary = localStorage.getItem('autodesk_upload_summary');
            if (uploadSummary) {
              const summary = JSON.parse(uploadSummary);
              if (summary.urn) {
                urnToLoad = summary.urn;
                console.log('Using URN from upload summary:', urnToLoad);
              }
            }
            
            // Then try integratedData
            if (!urnToLoad) {
              const savedData = localStorage.getItem('integratedData');
              if (savedData) {
                const parsedData = JSON.parse(savedData);
                if (parsedData.generatedUrn) {
                  urnToLoad = parsedData.generatedUrn;
                  console.log('Using URN from integrated data:', urnToLoad);
                }
              }
            }
            
            // If no URN found in localStorage, use the default DataCenter_Project.ifc URN
            if (!urnToLoad) {
              console.log('No URN found in any storage, using default DataCenter_Project.ifc URN');
              urnToLoad = DEFAULT_PROJECT_URN;
              
              // Also store this URN in localStorage for future use
              const uploadSummaryData = {
                urn: DEFAULT_PROJECT_URN,
                fileName: 'DataCenter_Project.ifc',
                bucketKey: 'ifcviewer1744251930321',
                timestamp: new Date().toISOString()
              };
              localStorage.setItem('autodesk_upload_summary', JSON.stringify(uploadSummaryData));
              
              const integratedData = {
                generatedUrn: DEFAULT_PROJECT_URN,
                timestamp: new Date().toISOString()
              };
              localStorage.setItem('integratedData', JSON.stringify(integratedData));
              
              console.log('Default URN stored in localStorage');
            }
          }
          
          // --- START: HARDCODED URN ---
          urnToLoad = "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aWZjdmlld2VyMTc0NDI1MTkzMDMyMS9leDIuaWZj"; 
          console.log('USING HARDCODED URN:', urnToLoad);
          // --- END: HARDCODED URN ---
          
          console.log('Final URN to load:', urnToLoad);
          if (urnToLoad) {
            loadModel(urnToLoad);
          }
        } catch (urnError) {
          console.error('Error determining URN:', urnError);
          setError(`Error determining which model to load: ${urnError.message}`);
          setLoading(false);
        }
      } catch (initError) {
        console.error('Viewer initialization error:', initError);
        setError(`Viewer initialization error: ${initError.message}`);
        setLoading(false);
      }
    });
  };

  // Event handlers
  const onGeometryLoaded = () => {
    console.log('Model geometry loaded');
    setLoading(false);
    setModelLoaded(true);
    if (viewerRef.current) {
      viewerRef.current.fitToView();
      viewerRef.current.setLightPreset(0); 
      viewerRef.current.setEnvMapBackground(true);
      try {
        viewerRef.current.setQualityLevel(true);
        viewerRef.current.setDisplayEdges(false);
        viewerRef.current.setGroundShadow(true);
      } catch (e) {
        console.warn('Some visual settings not supported:', e);
      }
    }
  };
  
  const onObjectTreeCreated = () => {
    console.log('Object tree created');
    if (viewerRef.current && viewerRef.current.model) {
      try {
        const tree = viewerRef.current.model.getInstanceTree();
        if (tree) {
          console.log('Instance tree available');
          extractModelData();
        }
      } catch (e) {
        console.warn('Could not access model tree:', e);
      }
    }
  };
  
  // Extract model data
  const extractModelData = () => {
    if (!viewerRef.current || !viewerRef.current.model) return;
    try {
      const model = viewerRef.current.model;
      const tableData = [];
      tableData.push({ property: 'URN', value: modelUrn || 'Current model' }); 

      if (model.getData) {
        const modelProps = model.getData();
        if (modelProps) {
          if (modelProps.loadTime) tableData.push({ property: 'Load Time', value: `${modelProps.loadTime.toFixed(2)} seconds` });
          if (modelProps.geometry) {
            const geometry = modelProps.geometry;
            if (geometry.boundingBox) {
              const bbox = geometry.boundingBox;
              tableData.push({ property: 'Dimensions', value: `X: ${(bbox.max.x - bbox.min.x).toFixed(2)}, Y: ${(bbox.max.y - bbox.min.y).toFixed(2)}, Z: ${(bbox.max.z - bbox.min.z).toFixed(2)}` });
            }
          }
        }
      }

      if (model.getDocumentNode) {
        const node = model.getDocumentNode();
        if (node && node.data) {
          const nodeData = node.data();
          if (nodeData.name) tableData.push({ property: 'Name', value: nodeData.name });
          if (nodeData.role) tableData.push({ property: 'Role', value: nodeData.role });
          if (nodeData.type) tableData.push({ property: 'Type', value: nodeData.type });
        }
      }
      setModelData(tableData);
    } catch (error) {
      console.warn('Error extracting model data:', error);
    }
  };

  // Get access token from backend API instead of directly from Autodesk
  const getAccessToken = async () => {
    try {
      console.log('getAccessToken function called');
      
      // Try to check if we have a valid token in localStorage first
      const tokenCache = localStorage.getItem('autodesk_token_cache');
      if (tokenCache) {
        const parsedCache = JSON.parse(tokenCache);
        if (parsedCache.expires_at && parsedCache.access_token && parsedCache.expires_at > Date.now()) {
          console.log('Using cached token from localStorage, expires in:', 
            Math.round((parsedCache.expires_at - Date.now()) / 1000), 'seconds');
          return parsedCache.access_token;
        } else {
          console.log('Token cache expired or invalid, requesting new token');
        }
      } else {
        console.log('No token cache found, requesting new token');
      }
      
      // Request token from backend instead of directly from Autodesk
      console.log('Requesting token from backend for viewer');
      const response = await fetch('/api/auth/token');
      
      console.log('Backend token API response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend token API error response:', errorText);
        throw new Error(`Failed to get token from backend: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Token API response received, expires_in:', data.expires_in);
      
      // Cache the token
      const tokenData = {
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in * 1000 * 0.9) // 90% of actual expiry time for safety
      };
      
      // Save to localStorage
      localStorage.setItem('autodesk_token_cache', JSON.stringify(tokenData));
      
      console.log('New token obtained from backend and cached successfully');
      return data.access_token;
    } catch (error) {
      console.error('Error getting access token from backend:', error);
      setError(`Error obtaining access token from backend: ${error.message}`);
      return null;
    }
  };

  // Load the necessary viewer scripts
  const loadViewerScripts = () => {
    const viewerScriptUrl = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js';
    const viewerStyleUrl = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css';
    
    if (!document.querySelector(`script[src="${viewerScriptUrl}"]`)) {
      // Load CSS
      const styleLink = document.createElement('link');
      styleLink.rel = 'stylesheet';
      styleLink.type = 'text/css';
      styleLink.href = viewerStyleUrl;
      styleLink.dataset.viewerStyle = 'true';
      document.head.appendChild(styleLink);
      
      // Load script
      const script = document.createElement('script');
      script.src = viewerScriptUrl;
      script.dataset.viewerScript = 'true';
      script.onload = () => initializeViewer();
      script.onerror = () => setError('Failed to load Autodesk Viewer scripts');
      document.head.appendChild(script);
    } else {
      // Scripts already loaded, initialize viewer
      initializeViewer();
    }
  };

  // Load model function
  const loadModel = (urnToLoad) => {
    if (!urnToLoad) {
      console.warn('URN is required to load a model');
      setError('URN is required.');
      return;
    }

    setLoading(true);
    setError(null);
    setModelLoaded(false);
    setModelData([]);

    if (viewerRef.current.model) {
      console.log('Unloading previous model...');
      viewerRef.current.unloadModel(viewerRef.current.model);
    }

    // Add direct visible debugging
    console.log(`Loading document with URN: ${urnToLoad}`);
    
    // Make sure URN is properly formatted
    let documentId = urnToLoad;
    if (!documentId.startsWith('urn:')) {
      documentId = 'urn:' + documentId;
      console.log('Added urn: prefix, document ID is now:', documentId);
    }

    // Check if the URN contains proper base64 characters
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    const urnPart = documentId.replace('urn:', '');
    if (!base64Pattern.test(urnPart)) {
      console.warn('URN does not appear to be valid base64:', urnPart);
      setError('URN does not appear to be valid base64 format');
      setLoading(false);
      return;
    }

    window.Autodesk.Viewing.Document.load(
      documentId,
      (doc) => {
        console.log('Document loaded successfully:', doc);
        const viewables = doc.getRoot().search({ type: 'geometry', role: '3d' });
        console.log('Found viewables:', viewables.length);
        
        if (viewables.length === 0) {
          setError('No 3D viewable found in the model.');
          setLoading(false);
          console.error('Error: No 3D viewable found');
          return;
        }
        
        const defaultModel = viewables[0];
        console.log('Loading viewable:', defaultModel.guid());
        
        viewerRef.current.loadDocumentNode(doc, defaultModel)
          .then(() => {
            console.log('Model loading initiated successfully');
          })
          .catch((loadErrorCode, loadErrorMsg) => {
            console.error('Error loading document node:', loadErrorCode, loadErrorMsg);
            setError(`Error loading model: ${loadErrorMsg} (code: ${loadErrorCode})`);
            setLoading(false);
          });
      },
      (loadErrorCode, loadErrorMsg) => {
        console.error('Error loading document:', loadErrorCode, loadErrorMsg);
        console.error('URN that failed:', documentId);
        setError(`Failed to load document: ${loadErrorMsg} (code: ${loadErrorCode})`);
        setLoading(false);
      }
    );
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Viewer container */}
      <div 
        ref={viewerContainerRef}
        className="w-full flex-grow bg-gray-100 border border-gray-300 rounded-md overflow-hidden" 
        style={{ minHeight: '400px' }}
      ></div>
      
      {/* Status indicators */}
      <div className="mt-4">
        {loading && (
          <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mb-3">
            <div className="flex items-center">
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
              <span className="text-blue-700">Loading model...</span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 p-3 rounded-md border border-red-200 mb-3">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}
        
        {noUrnAvailable && (
          <div className="bg-orange-50 p-3 rounded-md border border-orange-200 mb-3">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-orange-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-orange-700">No model available. Please upload an IFC file first by using the file uploader on the main page.</span>
            </div>
          </div>
        )}
        
        {modelLoaded && (
          <div className="bg-green-50 p-3 rounded-md border border-green-200 mb-3">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-700">Model loaded successfully</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Model Information Table */}
      {modelLoaded && modelData.length > 0 && (
        <div className="mt-4 bg-white p-4 rounded-md border border-gray-200">
          <h3 className="text-lg font-semibold mb-2">Model Information</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody>
                {modelData.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-2 px-4 border-b border-gray-200 text-sm">{item.property}</td>
                    <td className="py-2 px-4 border-b border-gray-200 text-sm font-mono text-gray-800">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleanViewer; 