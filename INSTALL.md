# BIM_XER_Masher Installation and Setup Guide

This guide will help you install and set up BIM_XER_Masher, a web application for integrating BIM IFC files with project schedule XER files.

## Prerequisites

- Node.js (v14.0.0 or later)
- npm (v6.0.0 or later)

## Installation

1. Clone the repository or download the source code
   ```bash
   git clone https://github.com/yourusername/BIM_XER_Masher.git
   cd BIM_XER_Masher
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Build the application
   ```bash
   npm run build
   ```

## Running the Application

### Development Mode

To run the application in development mode with live reloading:

```bash
npm run dev
```

### Production Mode

To run the application in production mode:

```bash
npm start
```

The application will be available at http://localhost:3000

## Testing with Sample Files

1. Start the application using one of the methods above
2. Open your browser and navigate to http://localhost:3000
3. Use the sample files provided in the `sample-files` directory:
   - `DataCenter_Project.ifc` - Sample IFC file
   - `DataCenter_Project.xer` - Sample XER file
4. Upload these files through the web interface
5. Click "Process Files" to see the integrated data in the dashboard

## Directory Structure

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
├── sample-files/        # Sample IFC and XER files for testing
│
├── package.json         # Project dependencies and scripts
├── webpack.config.js    # Webpack configuration
├── .babelrc             # Babel configuration
└── README.md            # Project documentation
```

## Troubleshooting

### Common Issues

1. **Cannot find module error**
   - Ensure all dependencies are installed: `npm install`
   
2. **File upload not working**
   - Check browser console for errors
   - Ensure file types are correct (.ifc and .xer)
   - Check file sizes (maximum file size is 100MB)

3. **Dashboard not showing data**
   - Check if files were processed successfully
   - Check browser console for errors
   - Try clearing browser cache and localStorage

### Getting Help

If you encounter any issues not covered in this guide, please:

1. Check the GitHub repository issues page
2. Create a new issue with details about your problem
3. Contact the development team at support@bim-xer-masher.com

## Next Steps

After installation, you may want to:

1. Customize the application for your specific needs
2. Add additional features or integrations
3. Contribute to the project by submitting pull requests

## License

This project is for demonstration purposes only.
