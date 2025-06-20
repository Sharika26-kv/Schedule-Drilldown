# BIM_XER_Masher

A web application for integrating BIM (Building Information Modeling) IFC files with project schedule XER files.

## Overview

BIM_XER_Masher is a SaaS application that allows construction professionals to upload IFC (Industry Foundation Classes) and XER (Primavera P6 Exchange Format) files, and visualize the integrated data in a comprehensive dashboard. The application maps building components from IFC models to project schedule activities using WBS (Work Breakdown Structure) codes.

## Features

- **File Upload**: Easy drag-and-drop interface for uploading IFC and XER files
- **Automatic Integration**: Maps IFC building components to XER activities using WBS codes
- **Comprehensive Dashboard**: Visualize integrated data with interactive charts and tables
- **Component Schedule**: View detailed schedule information for each building component
- **Critical Path Analysis**: Identify the critical path of your project
- **Resource Allocation**: Analyze resource usage across different building components
- **Risk Analysis**: Identify and manage risk factors for building components
- **Edit & Export**: Make changes to the integrated data and export updated IFC and XER files

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Edge, or Safari)
- IFC model file (.ifc)
- Primavera P6 schedule file (.xer)

### Usage

1. Visit the landing page at `index.html`
2. Upload your IFC and XER files using the provided interface
3. Click "Process Files" to integrate the data
4. Explore the dashboard to visualize and analyze your project
5. Make changes if needed
6. Export updated files for use in your BIM and scheduling tools

## Project Structure

```
BIM_XER_Masher/
│
├── public/               # Static assets and HTML files
│   ├── index.html       # Landing page
│   ├── dashboard.html   # Dashboard page
│   ├── styles.css       # Main CSS styles
│   ├── dashboard.css    # Dashboard-specific styles
│   ├── app.js           # Landing page JavaScript
│   └── dashboard.js     # Dashboard JavaScript
│
├── src/                 # Source code
│   ├── index.js         # Main application entry point
│   ├── components/      # UI components
│   ├── pages/           # Page components
│   └── utils/           # Utility functions
│       └── fileParser.js # IFC and XER file parser
│
└── README.md            # Project documentation
```

## Technical Details

### IFC Integration

The application parses IFC files to extract building components, their geometries, and associated WBS codes stored in property sets. It uses string matching and regular expressions for demonstration purposes, but in a production environment, it would use a dedicated IFC parsing library like IFC.js or web-ifc.

### XER Integration

XER files are parsed to extract project activities, WBS elements, and relationships. The application maps these elements to the corresponding building components using the WBS codes as the integration point.

### Data Visualization

The dashboard uses Chart.js for data visualization, including:
- Gantt-style timeline chart for activity durations
- Pie chart for resource allocation
- Interactive tables for component schedules and risk analysis

## Development

### Future Enhancements

- 3D viewer for IFC models with schedule integration
- Real-time collaboration features
- Advanced critical path analysis
- Cost analysis and earned value management
- Mobile-responsive design

## License

This project is for demonstration purposes only.

## Contact

For any questions or feedback, please contact admin@bim-xer-masher.com

## Direct Autodesk Upload Feature

This application now supports a direct upload approach using PowerShell for uploading IFC files to Autodesk Platform Services.

### How to Use

1. **Choose an IFC file** by clicking the "Choose IFC File" button in the web interface
2. **Click "Process Files"** in the web interface
3. Save the IFC file when prompted by the browser
4. **Run the PowerShell script** in the folder where you saved the file:
   ```powershell
   .\autodesk_s3_upload.ps1 -FilePath "YourFile.ifc"
   ```
5. The script will:
   - Get an access token from Autodesk
   - Upload your file to Autodesk's cloud storage
   - Initiate the translation process
   - Create a summary file (`autodesk_upload_summary.json`) with the URN and other details

### Supported File Types

- **IFC Files**: Industry Foundation Classes (.ifc) for BIM models
- **XER Files**: Primavera P6 project files (.xer) for schedules

### Requirements

- Modern web browser with File System Access API support
- PowerShell 5.1 or later
- Internet connection to access Autodesk Platform Services

### Troubleshooting

If you encounter issues with the PowerShell script:

1. Ensure PowerShell execution policy allows running scripts:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. Check that the file path is correct:
   ```powershell
   .\autodesk_s3_upload.ps1 -FilePath "C:\full\path\to\your\file.ifc"
   ```

3. Make sure you have an internet connection and the Autodesk Platform Services are available.

## About the Bucket

This application uses a specific bucket (`ifcviewer1744251930321`) for storing files in Autodesk Platform Services. This bucket configuration is fixed for all uploads.
