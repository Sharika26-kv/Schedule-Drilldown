console.log('**** Analysis.js script started ****'); // Test log

/* // Temporarily comment out all component/function definitions
// Analysis.js - Progress S-Curve and EVM Analysis Dashboard
// Using React with Recharts for visualizations

// Sample data structure - will be replaced with actual P6 data
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
  { period: 'Week 12', planned: 100, actual: 95, earned: 94, plannedCost: 95000, actualCost: 101000 },
];

// Constants for BAC (Budget at Completion)
const BAC = 100000;

// Calculate EVM metrics
const calculateEVMMetrics = (data) => {
  // Get latest data point
  const current = data[data.length - 1];
  
  // Basic EVM calculations
  const PV = current.planned * BAC / 100; // Planned Value
  const EV = current.earned * BAC / 100;  // Earned Value
  const AC = current.actualCost;          // Actual Cost
  
  // Variances
  const CV = EV - AC;                     // Cost Variance
  const SV = EV - PV;                     // Schedule Variance
  
  // Performance Indices
  const CPI = EV / AC;                    // Cost Performance Index
  const SPI = EV / PV;                    // Schedule Performance Index
  
  // Forecasts
  const EAC = BAC / CPI;                  // Estimate at Completion
  const VAC = BAC - EAC;                  // Variance at Completion
  const TCPI = (BAC - EV) / (BAC - AC);   // To Complete Performance Index
  
  return {
    PV,
    EV,
    AC,
    CV,
    SV,
    CPI,
    SPI,
    EAC,
    VAC,
    TCPI,
    BAC
  };
};

// Generate forecast data
const generateForecastData = (data, metrics) => {
  const { CPI, SPI } = metrics;
  const forecastData = [...data];
  const lastPoint = data[data.length - 1];
  
  // If project is already at 100%, no need for forecasting
  if (lastPoint.earned >= 100) return forecastData;
  
  // Calculate remaining percentage and periods
  const remainingPercentage = 100 - lastPoint.earned;
  const remainingPeriods = Math.ceil(remainingPercentage / (lastPoint.planned / data.length * SPI));
  
  // Generate forecast periods
  for (let i = 1; i <= remainingPeriods; i++) {
    const period = `Forecast ${i}`;
    const progressIncrement = remainingPercentage / remainingPeriods * SPI;
    const costIncrement = (BAC - lastPoint.actualCost) / remainingPeriods / CPI;
    
    forecastData.push({
      period,
      planned: Math.min(100, lastPoint.planned + (i * (100 - lastPoint.planned) / remainingPeriods)),
      actual: null, // No actual data for forecast periods
      earned: Math.min(100, lastPoint.earned + (i * progressIncrement)),
      plannedCost: Math.min(BAC, lastPoint.plannedCost + (i * (BAC - lastPoint.plannedCost) / remainingPeriods)),
      actualCost: Math.min(metrics.EAC, lastPoint.actualCost + (i * costIncrement)),
      isForecast: true
    });
  }
  
  return forecastData;
};

// Main EVM Dashboard Component
const EVMDashboard = () => {
  console.log('[React] EVMDashboard component function executing...');
  const { useState, useEffect, useCallback } = React;
  
  // State for chart configuration
  const [chartType, setChartType] = useState('progress');
  const [showForecast, setShowForecast] = useState(false);
  const [progressData, setProgressData] = useState([]); // Start with empty data
  const [evmMetrics, setEVMMetrics] = useState({});
  const [forecastData, setForecastData] = useState([]);
  const [loading, setLoading] = useState(true); // Add loading state
  const [error, setError] = useState(null); // Add error state
  const [currentProjectId, setCurrentProjectId] = useState(null); // Track current project
  
  // Function to load data for a specific project
  const loadData = useCallback(async (projectId) => {
    console.log(`[React] Loading data for project: ${projectId}`);
    setLoading(true);
    setError(null);
    setCurrentProjectId(projectId);
    
    try {
      const fetchedData = await fetchProgressData(projectId);
      console.log('[React] Fetched progress data:', fetchedData);
      
      if (fetchedData && fetchedData.length > 0) {
        setProgressData(fetchedData);
        const metrics = calculateEVMMetrics(fetchedData);
        setEVMMetrics(metrics);
        const forecast = generateForecastData(fetchedData, metrics);
        setForecastData(forecast);
      } else {
        // Handle case where no data is returned but no error occurred
        setProgressData([]);
        setEVMMetrics({});
        setForecastData([]);
        setError('No progress data found for this project.');
        console.warn(`[React] No progress data returned for project ${projectId}`);
      }
    } catch (err) {
      console.error('[React] Error loading progress data:', err);
      setError(`Failed to load data: ${err.message}`);
      setProgressData([]); // Clear data on error
      setEVMMetrics({});
      setForecastData([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array, function doesn't change

  // Effect to load initial data when the component mounts
  // Also sets up listener for external project changes
  useEffect(() => {
    // Function to handle project changes triggered from outside React
    const handleProjectChange = () => {
      const projectId = document.getElementById('projectFilter').value;
      if (projectId && projectId !== currentProjectId) {
        loadData(projectId);
      }
    };
    
    // Initial load based on the project filter's initial value
    const projectFilterElement = document.getElementById('projectFilter');
    const initialProjectId = projectFilterElement ? projectFilterElement.value : null;
    if (initialProjectId && initialProjectId !== 'Loading...') {
      loadData(initialProjectId);
    }
    
    // Listen for clicks on the main Load button
    const refreshBtn = document.getElementById('refreshProjectBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', handleProjectChange);
    }
    
    // Cleanup listener on component unmount
    return () => {
      if (refreshBtn) {
        refreshBtn.removeEventListener('click', handleProjectChange);
      }
    };
  }, [loadData, currentProjectId]); // Rerun if loadData or currentProjectId changes
  
  // Handler for chart type change
  const handleChartTypeChange = (e) => {
    setChartType(e.target.value);
  };
  
  // Handler for forecast toggle
  const handleForecastToggle = (e) => {
    setShowForecast(e.target.checked);
  };
  
  // Determine which data to use based on forecast toggle
  const displayData = showForecast ? forecastData : progressData;
  
  // Log state before rendering
  console.log('[React] State before render:', { loading, error, hasProgressData: progressData.length > 0 });
  
  // Display loading or error messages
  if (loading) {
    return <div className="text-center p-8">Loading analysis data...</div>;
  }
  
  if (error) {
    return <div className="text-center p-8 text-red-600">Error: {error}</div>;
  }
  
  // Handle no data case after loading
  if (!progressData || progressData.length === 0) {
      return <div className="text-center p-8 text-gray-500">No data available for the selected project.</div>;
  }
  
  // Add a simple return for testing
  console.log('[React] EVMDashboard component reached end, returning test div.');
  return <div className="text-center p-8">Testing component render...</div>;
};

// Progress S-Curve Component
const ProgressSCurve = ({ data }) => {
  const { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
  } = Recharts;
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis 
          yAxisId="left" 
          orientation="left" 
          label={{ value: 'Completion (%)', angle: -90, position: 'insideLeft' }} 
          domain={[0, 100]}
        />
        <Tooltip 
          formatter={(value, name) => {
            switch (name) {
              case 'planned':
                return [`${value}%`, 'Planned Progress'];
              case 'actual':
                return [`${value !== null ? value : 'N/A'}%`, 'Actual Progress'];
              case 'earned':
                return [`${value}%`, 'Earned Value'];
              default:
                return [value, name];
            }
          }}
          labelFormatter={(label) => `Period: ${label}`}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="planned"
          name="Planned Progress"
          stroke="#8884d8"
          activeDot={{ r: 8 }}
          strokeWidth={2}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="actual"
          name="Actual Progress"
          stroke="#82ca9d"
          activeDot={{ r: 8 }}
          strokeWidth={2}
          connectNulls={true}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="earned"
          name="Earned Value"
          stroke="#ffc658"
          activeDot={{ r: 8 }}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

// Cost S-Curve Component
const CostSCurve = ({ data }) => {
  const { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
  } = Recharts;
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis 
          yAxisId="left" 
          orientation="left" 
          label={{ value: 'Cost ($)', angle: -90, position: 'insideLeft' }} 
        />
        <Tooltip 
          formatter={(value, name) => {
            const formatter = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
            });
            
            switch (name) {
              case 'plannedCost':
                return [formatter.format(value), 'Planned Cost'];
              case 'actualCost':
                return [value !== null ? formatter.format(value) : 'N/A', 'Actual Cost'];
              default:
                return [formatter.format(value), name];
            }
          }}
          labelFormatter={(label) => `Period: ${label}`}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="plannedCost"
          name="Planned Cost"
          stroke="#8884d8"
          activeDot={{ r: 8 }}
          strokeWidth={2}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="actualCost"
          name="Actual Cost"
          stroke="#ff7300"
          activeDot={{ r: 8 }}
          strokeWidth={2}
          connectNulls={true}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

// Variance Analysis Chart Component
const VarianceChart = ({ data }) => {
  const { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
  } = Recharts;
  
  // Calculate variance data
  const varianceData = data.map(entry => {
    const pv = entry.planned * BAC / 100;
    const ev = entry.earned * BAC / 100;
    const ac = entry.actualCost;
    const cv = entry.actualCost !== null ? ev - ac : null;
    const sv = ev - pv;
    
    return {
      period: entry.period,
      costVariance: cv,
      scheduleVariance: sv,
      isForecast: entry.isForecast
    };
  });
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={varianceData}
        margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis 
          label={{ value: 'Variance ($)', angle: -90, position: 'insideLeft' }} 
        />
        <Tooltip 
          formatter={(value, name) => {
            const formatter = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
            });
            
            switch (name) {
              case 'costVariance':
                return [value !== null ? formatter.format(value) : 'N/A', 'Cost Variance'];
              case 'scheduleVariance':
                return [formatter.format(value), 'Schedule Variance'];
              default:
                return [formatter.format(value), name];
            }
          }}
          labelFormatter={(label) => `Period: ${label}`}
        />
        <Legend />
        <ReferenceLine y={0} stroke="#000" />
        <Bar dataKey="costVariance" name="Cost Variance" fill="#ff7300" radius={[5, 5, 0, 0]} />
        <Bar dataKey="scheduleVariance" name="Schedule Variance" fill="#8884d8" radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// API function to fetch data from the backend
// This will be implemented to fetch the actual P6 data
const fetchProgressData = async (projectId) => {
  try {
    const response = await fetch(`/api/progress-data?projectId=${projectId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch progress data');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching progress data:', error);
    return sampleProgressData; // Return sample data as fallback
  }
};
*/

// Analysis.js - Vanilla JavaScript Implementation
console.log('**** Analysis.js script started ****');

// Sample data for testing
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

// Constants
const BAC = 100000; // Budget at Completion

// Formatters
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value / 100);
}

// Calculate EVM metrics
function calculateEVMMetrics(data) {
  console.log('Calculating EVM metrics...');
  // Get latest data point
  const current = data[data.length - 1];
  
  // Basic EVM calculations
  const PV = current.planned * BAC / 100;
  const EV = current.earned * BAC / 100;
  const AC = current.actualCost;
  
  // Variances
  const CV = EV - AC;
  const SV = EV - PV;
  
  // Performance Indices
  const CPI = EV / AC;
  const SPI = EV / PV;
  
  // Forecasts
  const EAC = BAC / CPI;
  const VAC = BAC - EAC;
  const TCPI = (BAC - EV) / (BAC - AC);
  
  return {
    PV, EV, AC, CV, SV, CPI, SPI, EAC, VAC, TCPI, BAC
  };
}

// Fetch progress data from server
async function fetchProgressData(projectId) {
  console.log('Fetching progress data for project:', projectId);
  try {
    const response = await fetch(`/api/progress-data?projectId=${projectId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch progress data');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching progress data:', error);
    return sampleProgressData; // Return sample data as fallback
  }
}

// Create a simple metrics dashboard
function createMetricsDashboard(data) {
  console.log('Creating metrics dashboard with data:', data);
  const rootElement = document.getElementById('evm-dashboard-root');
  if (!rootElement) {
    console.error('Root element not found!');
    return;
  }
  
  // Clear previous content
  rootElement.innerHTML = '';
  
  // Calculate metrics
  const metrics = calculateEVMMetrics(data);
  
  // Create container
  const container = document.createElement('div');
  container.className = 'bg-white rounded-lg shadow p-4 mb-6';
  
  // Add title
  const title = document.createElement('h2');
  title.className = 'text-xl font-semibold mb-4';
  title.textContent = 'Progress Analysis Dashboard';
  container.appendChild(title);
  
  // Add metrics cards
  const metricsGrid = document.createElement('div');
  metricsGrid.className = 'grid grid-cols-1 md:grid-cols-3 gap-4 mb-4';
  
  // Helper to create metric card
  function createMetricCard(label, value, description) {
    const card = document.createElement('div');
    card.className = 'bg-gray-50 rounded-lg p-4 border';
    
    const labelEl = document.createElement('div');
    labelEl.className = 'text-sm text-gray-500 mb-1';
    labelEl.textContent = label;
    
    const valueEl = document.createElement('div');
    valueEl.className = 'text-2xl font-bold text-gray-800';
    valueEl.textContent = value;
    
    const descEl = document.createElement('div');
    descEl.className = 'text-xs mt-2 text-gray-600';
    descEl.textContent = description;
    
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    card.appendChild(descEl);
    
    return card;
  }
  
  // Add metric cards
  metricsGrid.appendChild(createMetricCard('CPI', metrics.CPI.toFixed(2), 
    metrics.CPI > 1 ? 'Under budget' : metrics.CPI < 1 ? 'Over budget' : 'On budget'));
  
  metricsGrid.appendChild(createMetricCard('SPI', metrics.SPI.toFixed(2),
    metrics.SPI > 1 ? 'Ahead of schedule' : metrics.SPI < 1 ? 'Behind schedule' : 'On schedule'));
  
  metricsGrid.appendChild(createMetricCard('CV', formatCurrency(metrics.CV),
    metrics.CV > 0 ? 'Under budget' : metrics.CV < 0 ? 'Over budget' : 'On budget'));
  
  metricsGrid.appendChild(createMetricCard('SV', formatCurrency(metrics.SV),
    metrics.SV > 0 ? 'Ahead of schedule' : metrics.SV < 0 ? 'Behind schedule' : 'On schedule'));
  
  metricsGrid.appendChild(createMetricCard('EAC', formatCurrency(metrics.EAC),
    'Estimate at completion'));
  
  metricsGrid.appendChild(createMetricCard('BAC', formatCurrency(metrics.BAC),
    'Budget at completion'));
  
  container.appendChild(metricsGrid);
  
  // Add data table
  const tableSection = document.createElement('div');
  tableSection.className = 'overflow-x-auto';
  
  const tableTitle = document.createElement('h3');
  tableTitle.className = 'text-lg font-semibold mb-3';
  tableTitle.textContent = 'Progress Data';
  tableSection.appendChild(tableTitle);
  
  const table = document.createElement('table');
  table.className = 'min-w-full divide-y divide-gray-200';
  
  // Create table header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  ['Period', 'Planned %', 'Actual %', 'Earned %', 'PV ($)', 'EV ($)', 'AC ($)', 'CV ($)', 'SV ($)']
    .forEach(headerText => {
      const th = document.createElement('th');
      th.className = 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create table body
  const tbody = document.createElement('tbody');
  tbody.className = 'bg-white divide-y divide-gray-200';
  
  // Add data rows
  data.forEach(entry => {
    const row = document.createElement('tr');
    
    // Calculate metrics for this row
    const pv = entry.planned * BAC / 100;
    const ev = entry.earned * BAC / 100;
    const ac = entry.actualCost;
    const cv = ev - ac;
    const sv = ev - pv;
    
    // Helper to create cell
    function createCell(content, classNames = 'px-4 py-2 whitespace-nowrap text-sm text-gray-900') {
      const td = document.createElement('td');
      td.className = classNames;
      td.textContent = content;
      return td;
    }
    
    // Add cells
    row.appendChild(createCell(entry.period));
    row.appendChild(createCell(`${entry.planned}%`));
    row.appendChild(createCell(entry.actual !== null ? `${entry.actual}%` : '-'));
    row.appendChild(createCell(`${entry.earned}%`));
    row.appendChild(createCell(formatCurrency(pv)));
    row.appendChild(createCell(formatCurrency(ev)));
    row.appendChild(createCell(entry.actualCost !== null ? formatCurrency(ac) : '-'));
    
    // Apply color to CV, SV cells based on value
    const cvClass = `px-4 py-2 whitespace-nowrap text-sm ${cv > 0 ? 'text-green-600' : cv < 0 ? 'text-red-600' : 'text-yellow-600'}`;
    const svClass = `px-4 py-2 whitespace-nowrap text-sm ${sv > 0 ? 'text-green-600' : sv < 0 ? 'text-red-600' : 'text-yellow-600'}`;
    
    row.appendChild(createCell(formatCurrency(cv), cvClass));
    row.appendChild(createCell(formatCurrency(sv), svClass));
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  tableSection.appendChild(table);
  container.appendChild(tableSection);
  
  // Add to DOM
  rootElement.appendChild(container);
  console.log('Dashboard created successfully.');
}

// Initialize the application when DOM is loaded
console.log('Setting up DOMContentLoaded listener...');
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM content loaded. Initializing application...');
  const projectFilter = document.getElementById('projectFilter');
  const refreshProjectBtn = document.getElementById('refreshProjectBtn');
  const currentProjectSpan = document.getElementById('currentProjectId');
  
  console.log('Elements references:', {
    projectFilter: !!projectFilter,
    refreshProjectBtn: !!refreshProjectBtn,
    currentProjectSpan: !!currentProjectSpan
  });
  
  // Load initial data with sample data
  createMetricsDashboard(sampleProgressData);
  
  // Populate project filter
  async function populateProjectFilter() {
    console.log('Populating project filter...');
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }
      
      const projects = await response.json();
      console.log('Fetched projects:', projects);
      
      // Clear existing options
      projectFilter.innerHTML = '';
      
      if (projects && projects.length > 0) {
        // Add projects to filter
        projects.forEach(project => {
          const option = document.createElement('option');
          option.value = project.id;
          option.textContent = project.name;
          projectFilter.appendChild(option);
        });
        
        // Set current project ID
        currentProjectSpan.textContent = projects[0].id;
        
        // Load data for initial project
        loadProjectData(projects[0].id);
      } else {
        // Handle no projects found
        const option = document.createElement('option');
        option.textContent = 'No projects available';
        projectFilter.appendChild(option);
        currentProjectSpan.textContent = 'N/A';
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      projectFilter.innerHTML = '<option>Error loading projects</option>';
      currentProjectSpan.textContent = 'Error';
    }
  }
  
  // Load data for a specific project
  async function loadProjectData(projectId) {
    console.log(`Loading data for project: ${projectId}`);
    try {
      const data = await fetchProgressData(projectId);
      createMetricsDashboard(data);
    } catch (error) {
      console.error('Error loading project data:', error);
      // Show error in dashboard
      document.getElementById('evm-dashboard-root').innerHTML = 
        `<div class="bg-white rounded-lg shadow p-4">Error: ${error.message}</div>`;
    }
  }
  
  // Initialize project filter
  if (projectFilter) {
    populateProjectFilter();
    
    // Handle project change
    projectFilter.addEventListener('change', function() {
      const selectedProjectId = projectFilter.value;
      if (selectedProjectId) {
        currentProjectSpan.textContent = selectedProjectId;
        loadProjectData(selectedProjectId);
      }
    });
  }
  
  // Handle refresh button click
  if (refreshProjectBtn) {
    refreshProjectBtn.addEventListener('click', function() {
      const selectedProjectId = projectFilter.value;
      console.log(`Refresh button clicked. Selected project: ${selectedProjectId}`);
      if (selectedProjectId) {
        currentProjectSpan.textContent = selectedProjectId;
        loadProjectData(selectedProjectId);
      }
    });
  }
  
  console.log('Initialization complete.');
}); 