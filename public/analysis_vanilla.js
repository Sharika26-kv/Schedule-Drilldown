// Analysis_vanilla.js - Vanilla JavaScript Implementation
console.log('**** Analysis_vanilla.js script started ****');

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

// Sample project data for testing
const sampleProjects = [
  { id: "proj1", name: "Project 1 - Main Development" },
  { id: "proj2", name: "Project 2 - Expansion" },
  { id: "proj3", name: "Project 3 - Maintenance" }
];

// Constants
const BAC = 100000; // Budget at Completion

// Global references to chart instances
const chartInstances = {
  progress: null,
  cost: null,
  variance: null
};

// Global state
let currentData = sampleProgressData;
let showForecast = false;
let dashboardInitialized = false;

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

// Generate forecast data
function generateForecastData(data, metrics) {
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
    
    // Process the data for S-curves
    return processDataForSCurve(data);
  } catch (error) {
    console.error('Error fetching progress data:', error);
    return sampleProgressData; // Return sample data as fallback
  }
}

// Process raw task data into time-based S-curve data
function processDataForSCurve(rawData) {
  console.log('Processing data for S-curve, raw data count:', rawData.length);
  
  if (!rawData || rawData.length === 0) {
    return sampleProgressData;
  }
  
  // Extract numeric values from string data if needed
  const processedRawData = rawData.map(item => ({
    ...item,
    planned: parseFloat(item.planned) || 0,
    actual: parseFloat(item.actual) || 0,
    earned: parseFloat(item.earned) || 0,
    plannedCost: parseFloat(item.plannedCost) || 0,
    actualCost: parseFloat(item.actualCost) || 0
  }));
  
  // For now, create 12 time periods (simulated months or weeks)
  // In a real implementation, you would use actual dates from tasks
  const timePeriodsCount = 12;
  const result = [];
  
  // Get total values for percentages
  const totalPlannedCost = processedRawData.reduce((sum, item) => sum + item.plannedCost, 0);
  const totalActualCost = processedRawData.reduce((sum, item) => sum + item.actualCost, 0);
  const totalEarnedValue = processedRawData.reduce((sum, item) => sum + item.earned, 0);
  
  // Create time-based periods (simulated for now)
  for (let i = 0; i < timePeriodsCount; i++) {
    const periodName = `Period ${i + 1}`;
    
    // Simulate cumulative progress by period
    // In a real implementation, you'd group tasks by their dates
    const cumulativePercentage = (i + 1) / timePeriodsCount;
    
    result.push({
      period: periodName,
      planned: Math.min(100, Math.round(cumulativePercentage * 100)),
      actual: Math.min(100, Math.round(cumulativePercentage * 85 + Math.random() * 10 - 5)),
      earned: Math.min(100, Math.round(cumulativePercentage * 90 + Math.random() * 10 - 5)),
      plannedCost: Math.round(cumulativePercentage * totalPlannedCost),
      actualCost: Math.round(cumulativePercentage * totalActualCost * (0.95 + Math.random() * 0.1))
    });
  }
  
  console.log('Processed data into time periods:', result.length);
  return result;
}

// Initialize the dashboard layout
function initDashboardLayout() {
  // Only initialize layout once
  if (dashboardInitialized) return;
  
  const rootElement = document.getElementById('evm-dashboard-root');
  if (!rootElement) {
    console.error('Root element not found!');
    return;
  }
  
  // Clear any existing content
  rootElement.innerHTML = '';
  
  // Create dashboard layout structure
  rootElement.innerHTML = `
    <div class="dashboard-options mb-4">
      <div class="mb-2 flex items-center">
        <label class="inline-flex items-center mr-4">
          <input type="checkbox" id="forecast-toggle" class="form-checkbox h-4 w-4 text-blue-600">
          <span class="ml-2 text-sm text-gray-700">Show Forecast</span>
        </label>
      </div>
    </div>
    
    <div id="charts-container">
      <div id="progress-chart-container" class="bg-white rounded-lg shadow p-4 mb-6">
        <h3 class="text-lg font-semibold mb-3">Progress S-Curve</h3>
        <div class="chart-wrapper" style="position: relative; height: 300px;">
          <canvas id="progress-chart"></canvas>
        </div>
      </div>
      
      <div id="cost-chart-container" class="bg-white rounded-lg shadow p-4 mb-6">
        <h3 class="text-lg font-semibold mb-3">Cost S-Curve</h3>
        <div class="chart-wrapper" style="position: relative; height: 300px;">
          <canvas id="cost-chart"></canvas>
        </div>
      </div>
      
      <div id="variance-chart-container" class="bg-white rounded-lg shadow p-4 mb-6">
        <h3 class="text-lg font-semibold mb-3">Schedule & Cost Variance</h3>
        <div class="chart-wrapper" style="position: relative; height: 300px;">
          <canvas id="variance-chart"></canvas>
        </div>
      </div>
    </div>
    
    <div id="metrics-container" class="bg-white rounded-lg shadow p-4 mb-6">
      <h3 class="text-lg font-semibold mb-3">EVM Metrics</h3>
      <div id="metrics-grid" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"></div>
    </div>
    
    <div id="data-table-container" class="bg-white rounded-lg shadow p-4 mb-6">
      <h3 class="text-lg font-semibold mb-3">Progress Data</h3>
      <div id="data-table-wrapper" class="overflow-x-auto"></div>
    </div>
  `;
  
  // Set up event listeners
  document.getElementById('forecast-toggle').addEventListener('change', function(e) {
    showForecast = e.target.checked;
    updateDashboard(currentData);
  });
  
  dashboardInitialized = true;
}

// Create progress chart
function createProgressChart(data) {
  const displayData = showForecast ? 
    generateForecastData(data, calculateEVMMetrics(data)) : 
    data;
  
  // Extract labels and datasets
  const labels = displayData.map(d => d.period);
  const planned = displayData.map(d => d.planned);
  const actual = displayData.map(d => d.actual);
  const earned = displayData.map(d => d.earned);
  
  // Determine where forecast data begins (if any)
  const forecastStartIndex = data.length;
  
  // Get canvas context
  const ctx = document.getElementById('progress-chart').getContext('2d');
  
  // Destroy previous chart instance if it exists
  if (chartInstances.progress) {
    chartInstances.progress.destroy();
  }
  
  // Create new chart
  chartInstances.progress = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Planned Progress',
          data: planned,
          borderColor: 'rgb(59, 130, 246)', // Tailwind blue-500
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: false,
          pointRadius: 4,
          pointBackgroundColor: 'rgb(59, 130, 246)',
          segment: {
            borderDash: ctx => ctx.p0.parsed.x >= forecastStartIndex ? [6, 6] : undefined,
          }
        },
        {
          label: 'Actual Progress',
          data: actual,
          borderColor: 'rgb(16, 185, 129)', // Tailwind green-500
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: 'rgb(16, 185, 129)',
          segment: {
            borderDash: ctx => ctx.p0.parsed.x >= forecastStartIndex ? [6, 6] : undefined,
          },
          spanGaps: true // Connect the line across null values
        },
        {
          label: 'Earned Value',
          data: earned,
          borderColor: 'rgb(245, 158, 11)', // Tailwind amber-500
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: 'rgb(245, 158, 11)',
          segment: {
            borderDash: ctx => ctx.p0.parsed.x >= forecastStartIndex ? [6, 6] : undefined,
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Progress (%)',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            callback: value => `${value}%`,
            font: {
              size: 12
            }
          }
        },
        x: {
          title: {
            display: true,
            text: 'Time Period',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            font: {
              size: 12
            }
          }
        }
      },
      plugins: {
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          padding: 10,
          callbacks: {
            label: function(context) {
              const value = context.raw;
              return `${context.dataset.label}: ${value !== null ? value.toFixed(1) + '%' : 'N/A'}`;
            }
          }
        },
        legend: {
          position: 'top',
          labels: {
            font: {
              size: 13
            },
            padding: 15
          }
        }
      }
    }
  });
}

// Create cost chart
function createCostChart(data) {
  const displayData = showForecast ? 
    generateForecastData(data, calculateEVMMetrics(data)) : 
    data;
  
  // Extract labels and datasets
  const labels = displayData.map(d => d.period);
  const plannedCost = displayData.map(d => d.plannedCost);
  const actualCost = displayData.map(d => d.actualCost);
  const earnedCost = displayData.map(d => d.earned * BAC / 100);
  
  // Determine where forecast data begins (if any)
  const forecastStartIndex = data.length;
  
  // Get canvas context
  const ctx = document.getElementById('cost-chart').getContext('2d');
  
  // Destroy previous chart instance if it exists
  if (chartInstances.cost) {
    chartInstances.cost.destroy();
  }
  
  // Create new chart
  chartInstances.cost = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Planned Value (PV)',
          data: plannedCost,
          borderColor: 'rgb(59, 130, 246)', // Tailwind blue-500
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: false,
          pointRadius: 4,
          pointBackgroundColor: 'rgb(59, 130, 246)'
        },
        {
          label: 'Actual Cost (AC)',
          data: actualCost,
          borderColor: 'rgb(239, 68, 68)', // Tailwind red-500
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: 'rgb(239, 68, 68)',
          segment: {
            borderDash: ctx => ctx.p0.parsed.x >= forecastStartIndex ? [6, 6] : undefined,
          },
          spanGaps: true // Connect the line across null values
        },
        {
          label: 'Earned Value (EV)',
          data: earnedCost,
          borderColor: 'rgb(16, 185, 129)', // Tailwind green-500
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: 'rgb(16, 185, 129)',
          segment: {
            borderDash: ctx => ctx.p0.parsed.x >= forecastStartIndex ? [6, 6] : undefined,
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Cost ($)',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            callback: value => formatCurrency(value),
            font: {
              size: 12
            }
          }
        },
        x: {
          title: {
            display: true,
            text: 'Time Period',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            font: {
              size: 12
            }
          }
        }
      },
      plugins: {
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          padding: 10,
          callbacks: {
            label: function(context) {
              const value = context.raw;
              return `${context.dataset.label}: ${value !== null ? formatCurrency(value) : 'N/A'}`;
            }
          }
        },
        legend: {
          position: 'top',
          labels: {
            font: {
              size: 13
            },
            padding: 15
          }
        }
      }
    }
  });
}

// Create variance chart
function createVarianceChart(data) {
  const displayData = showForecast ? 
    generateForecastData(data, calculateEVMMetrics(data)) : 
    data;
  
  // Calculate variances
  const labels = displayData.map(d => d.period);
  const scheduleVariance = displayData.map(d => {
    const pv = d.planned * BAC / 100;
    const ev = d.earned * BAC / 100;
    return ev - pv; // Schedule Variance
  });
  const costVariance = displayData.map(d => {
    const ev = d.earned * BAC / 100;
    const ac = d.actualCost;
    return ev - ac; // Cost Variance
  });
  
  // Get canvas context
  const ctx = document.getElementById('variance-chart').getContext('2d');
  
  // Destroy previous chart instance if it exists
  if (chartInstances.variance) {
    chartInstances.variance.destroy();
  }
  
  // Create new chart
  chartInstances.variance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Schedule Variance (SV)',
          data: scheduleVariance,
          backgroundColor: ctx => {
            const value = ctx.raw;
            return value >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)';
          },
          borderColor: ctx => {
            const value = ctx.raw;
            return value >= 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)';
          },
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Cost Variance (CV)',
          data: costVariance,
          backgroundColor: ctx => {
            const value = ctx.raw;
            return value >= 0 ? 'rgba(59, 130, 246, 0.7)' : 'rgba(245, 158, 11, 0.7)';
          },
          borderColor: ctx => {
            const value = ctx.raw;
            return value >= 0 ? 'rgb(59, 130, 246)' : 'rgb(245, 158, 11)';
          },
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          title: {
            display: true,
            text: 'Variance ($)',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            callback: value => formatCurrency(value),
            font: {
              size: 12
            }
          }
        },
        x: {
          title: {
            display: true,
            text: 'Time Period',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            font: {
              size: 12
            }
          }
        }
      },
      plugins: {
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          padding: 10,
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const statusText = value >= 0 ? 'Positive' : 'Negative';
              return `${context.dataset.label}: ${formatCurrency(value)} (${statusText})`;
            }
          }
        },
        legend: {
          position: 'top',
          labels: {
            font: {
              size: 13
            },
            padding: 15
          }
        }
      }
    }
  });
}

// Update metrics section
function updateMetricsSection(data) {
  // Calculate metrics
  const metrics = calculateEVMMetrics(data);
  
  // Get the metrics grid container
  const metricsGrid = document.getElementById('metrics-grid');
  metricsGrid.innerHTML = '';
  
  // Helper to create metric card
  function createMetricCard(label, value, description) {
    return `
      <div class="bg-gray-50 rounded-lg p-4 border">
        <div class="text-sm text-gray-500 mb-1">${label}</div>
        <div class="text-2xl font-bold text-gray-800">${value}</div>
        <div class="text-xs mt-2 text-gray-600">${description}</div>
      </div>
    `;
  }
  
  // Add metric cards
  metricsGrid.innerHTML += createMetricCard('CPI', metrics.CPI.toFixed(2), 
    metrics.CPI > 1 ? 'Under budget' : metrics.CPI < 1 ? 'Over budget' : 'On budget');
  
  metricsGrid.innerHTML += createMetricCard('SPI', metrics.SPI.toFixed(2),
    metrics.SPI > 1 ? 'Ahead of schedule' : metrics.SPI < 1 ? 'Behind schedule' : 'On schedule');
  
  metricsGrid.innerHTML += createMetricCard('CV', formatCurrency(metrics.CV),
    metrics.CV > 0 ? 'Under budget' : metrics.CV < 0 ? 'Over budget' : 'On budget');
  
  metricsGrid.innerHTML += createMetricCard('SV', formatCurrency(metrics.SV),
    metrics.SV > 0 ? 'Ahead of schedule' : metrics.SV < 0 ? 'Behind schedule' : 'On schedule');
  
  metricsGrid.innerHTML += createMetricCard('EAC', formatCurrency(metrics.EAC),
    'Estimate at completion');
  
  metricsGrid.innerHTML += createMetricCard('BAC', formatCurrency(metrics.BAC),
    'Budget at completion');
}

// Update data table
function updateDataTable(data) {
  const tableWrapper = document.getElementById('data-table-wrapper');
  
  // Create table HTML
  let tableHTML = `
    <table class="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Planned %</th>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual %</th>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Earned %</th>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PV ($)</th>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EV ($)</th>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AC ($)</th>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CV ($)</th>
          <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SV ($)</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
  `;
  
  // Add table rows
  data.forEach(entry => {
    // Calculate metrics for this row
    const pv = entry.planned * BAC / 100;
    const ev = entry.earned * BAC / 100;
    const ac = entry.actualCost;
    const cv = ev - ac;
    const sv = ev - pv;
    
    // Determine classes for variance cells
    const cvClass = cv > 0 ? 'text-green-600' : cv < 0 ? 'text-red-600' : 'text-yellow-600';
    const svClass = sv > 0 ? 'text-green-600' : sv < 0 ? 'text-red-600' : 'text-yellow-600';
    
    tableHTML += `
      <tr>
        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${entry.period}</td>
        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${entry.planned}%</td>
        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${entry.actual !== null ? entry.actual + '%' : '-'}</td>
        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${entry.earned}%</td>
        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${formatCurrency(pv)}</td>
        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${formatCurrency(ev)}</td>
        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${entry.actualCost !== null ? formatCurrency(ac) : '-'}</td>
        <td class="px-4 py-2 whitespace-nowrap text-sm ${cvClass}">${formatCurrency(cv)}</td>
        <td class="px-4 py-2 whitespace-nowrap text-sm ${svClass}">${formatCurrency(sv)}</td>
      </tr>
    `;
  });
  
  tableHTML += `
      </tbody>
    </table>
  `;
  
  tableWrapper.innerHTML = tableHTML;
}

// Update the entire dashboard with new data
function updateDashboard(data) {
  console.log('Updating dashboard with data:', data);
  
  // Store current data
  currentData = data;
  
  // Ensure the dashboard layout is initialized
  initDashboardLayout();
  
  // Update charts
  createProgressChart(data);
  createCostChart(data);
  createVarianceChart(data);
  
  // Update metrics and table
  updateMetricsSection(data);
  updateDataTable(data);
  
  console.log('Dashboard updated successfully.');
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
  
  // Initialize the dashboard with sample data
  updateDashboard(sampleProgressData);
  
  // Populate project filter
  async function populateProjectFilter() {
    console.log('Populating project filter...');
    try {
      // Try to fetch from API
      let projects = null;
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }
        projects = await response.json();
      } catch (apiError) {
        console.warn('API error, using sample data instead:', apiError);
        // Use sample data if API fails
        projects = sampleProjects;
      }
      
      console.log('Projects data:', projects);
      
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
      console.error('Error in project filter setup:', error);
      projectFilter.innerHTML = '<option>Error loading projects</option>';
      currentProjectSpan.textContent = 'Error';
    }
  }
  
  // Load data for a specific project
  async function loadProjectData(projectId) {
    console.log(`Loading data for project: ${projectId}`);
    try {
      const data = await fetchProgressData(projectId);
      updateDashboard(data);
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