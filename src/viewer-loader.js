import React from 'react';
import ReactDOM from 'react-dom/client';
import CleanViewer from './components/IfcViewer/CleanViewer';

console.log('=== VIEWER LOADER INITIALIZATION ===');

// Try to get the URN from localStorage first
let MODEL_URN = null; // Initialize as null instead of using default sample

// First check upload summary which would be most recent
try {
  console.log('Checking autodesk_upload_summary for URN...');
  const uploadSummary = localStorage.getItem('autodesk_upload_summary');
  if (uploadSummary) {
    const summaryData = JSON.parse(uploadSummary);
    if (summaryData.urn) {
      console.log('Found URN in upload summary:', summaryData.urn);
      MODEL_URN = summaryData.urn;
    } else {
      console.log('No URN found in upload summary');
    }
  } else {
    console.log('No upload summary found in localStorage');
  }
} catch (error) {
  console.error('Error retrieving URN from upload summary:', error);
}

// If we didn't find a URN in the upload summary, check integratedData
if (!MODEL_URN) {
  try {
    console.log('Checking integratedData for URN...');
    const savedData = localStorage.getItem('integratedData');
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      if (parsedData.generatedUrn) {
        console.log('Found URN in integratedData:', parsedData.generatedUrn);
        MODEL_URN = parsedData.generatedUrn;
      } else {
        console.log('No URN found in integratedData');
      }
    } else {
      console.log('No integratedData found in localStorage');
    }
  } catch (error) {
    console.error('Error retrieving URN from integratedData:', error);
  }
}

// If we still don't have a URN, use the sample
if (!MODEL_URN) {
  MODEL_URN = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6c2FtcGxlcy0xL29mZmljZS5ydnQ';
  console.warn('No URN found in any storage, using default sample model:', MODEL_URN);
}

console.log('FINAL URN TO BE PASSED TO VIEWER:', MODEL_URN);

const container = document.getElementById('apsViewer');

if (container) {
  console.log('Found viewer container, rendering viewer component');
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <CleanViewer modelUrn={MODEL_URN} /> 
    </React.StrictMode>
  );
} else {
  console.error('Could not find the root element #apsViewer for the IFC viewer.');
}

console.log('=== VIEWER LOADER COMPLETED ==='); 