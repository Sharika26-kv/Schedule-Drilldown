// Schedule Drilldown JavaScript - Integrated with Nirman Portfolio Management

let currentChart = null;
let currentHistoryChart = null;
let currentMetric = null;
let currentProjectId = null;

// API Base URL - Updated to use current server port
const API_BASE = window.location.origin;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        // Update last updated time
        document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
        
        // Load projects
        await loadProjects();
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('Schedule Drilldown initialized successfully');
    } catch (error) {
        console.error('Error initializing Schedule Drilldown:', error);
        showError('Failed to initialize application');
    }
}

function setupEventListeners() {
    // Metric card selection
    document.querySelectorAll('.metric-card').forEach(card => {
        card.addEventListener('click', function() {
            const metric = this.dataset.metric;
            selectMetric(metric);
        });
    });
    
    // Project filter
    document.getElementById('projectFilter').addEventListener('change', function() {
        currentProjectId = this.value;
        if (currentMetric) {
            loadMetricData(currentMetric);
        }
    });
    
    // Refresh button
    document.getElementById('refreshProjectBtn').addEventListener('click', function() {
        if (currentMetric) {
            loadMetricData(currentMetric);
        } else {
            loadProjects();
        }
    });
    
    // Export buttons in header
    document.getElementById('exportPdf').addEventListener('click', function() {
        if (!currentMetric) {
            alert('Please select a metric first');
            return;
        }
        exportFullPageToPDF();
    });
    
    document.getElementById('exportExcel').addEventListener('click', function() {
        if (!currentMetric) {
            alert('Please select a metric first');
            return;
        }
        exportFullPageToExcel();
    });
    
    document.getElementById('exportImage').addEventListener('click', function() {
        if (!currentMetric) {
            alert('Please select a metric first');
            return;
        }
        exportFullPageToImage();
    });
}

async function loadProjects() {
    try {
        const response = await fetch(`${API_BASE}/api/schedule/projects`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const projects = await response.json();
        const select = document.getElementById('projectFilter');
        
        // Clear existing options except "All Projects"
        select.innerHTML = '<option value="">All Projects</option>';
        
        // Add project options
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            select.appendChild(option);
        });
        
        console.log('Loaded projects:', projects.length);
    } catch (error) {
        console.error('Error loading projects:', error);
        showError('Failed to load projects');
    }
}

function selectMetric(metric) {
    // Update UI state
    document.querySelectorAll('.metric-card').forEach(card => {
        card.classList.remove('border-blue-500', 'border-green-500', 'border-orange-500', 'border-purple-500', 'border-red-500');
        card.classList.add('border-transparent');
    });
    
    const selectedCard = document.querySelector(`[data-metric="${metric}"]`);
    if (selectedCard) {
        const colorMap = {
            'leads': 'border-blue-500',
            'lags': 'border-green-500',
            'excessive-lags': 'border-orange-500',
            'fs': 'border-purple-500',
            'non-fs': 'border-red-500'
        };
        selectedCard.classList.add(colorMap[metric]);
    }
    
    // Show content area and hide initial message
    document.getElementById('metric-content').classList.remove('hidden');
    document.getElementById('initial-message').classList.add('hidden');
    
    currentMetric = metric;
    loadMetricData(metric);
}

async function loadMetricData(metric) {
    try {
        showLoading();
        
        // Load all metric data in parallel
        const [kpiData, chartData, historyData, tableData] = await Promise.all([
            fetchKPIData(metric),
            fetchChartData(metric),
            fetchHistoryData(metric),
            fetchTableData(metric)
        ]);
        
        // Update UI with data
        updateKPISection(kpiData, metric);
        updateChartSection(chartData, metric);
        updateHistorySection(historyData, metric);
        updateTableSection(tableData, metric);
        
        hideLoading();
    } catch (error) {
        console.error('Error loading metric data:', error);
        showError(`Failed to load ${metric} data`);
        hideLoading();
    }
}

async function fetchKPIData(metric) {
    const endpoint = getKPIEndpoint(metric);
    const url = currentProjectId ? 
        `${API_BASE}${endpoint}?project_id=${currentProjectId}` : 
        `${API_BASE}${endpoint}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch KPI data: ${response.status}`);
    return response.json();
}

async function fetchChartData(metric) {
    const endpoint = getChartEndpoint(metric);
    const url = currentProjectId ? 
        `${API_BASE}${endpoint}?project_id=${currentProjectId}` : 
        `${API_BASE}${endpoint}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch chart data: ${response.status}`);
    return response.json();
}

async function fetchHistoryData(metric) {
    const endpoint = getHistoryEndpoint(metric);
    const url = currentProjectId ? 
        `${API_BASE}${endpoint}?project_id=${currentProjectId}` : 
        `${API_BASE}${endpoint}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch history data: ${response.status}`);
    return response.json();
}

async function fetchTableData(metric) {
    const endpoint = getTableEndpoint(metric);
    const url = currentProjectId ? 
        `${API_BASE}${endpoint}?project_id=${currentProjectId}&limit=20` : 
        `${API_BASE}${endpoint}?limit=20`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch table data: ${response.status}`);
    return response.json();
}

function getKPIEndpoint(metric) {
    const endpoints = {
        'leads': '/api/schedule/leads-kpi',
        'lags': '/api/schedule/lags-kpi',
        'excessive-lags': '/api/schedule/excessive-lags-kpi',
        'fs': '/api/schedule/fs-kpi',
        'non-fs': '/api/schedule/non-fs-kpi'
    };
    return endpoints[metric];
}

function getChartEndpoint(metric) {
    const endpoints = {
        'leads': '/api/schedule/leads-chart-data',
        'lags': '/api/schedule/lags-chart-data',
        'excessive-lags': '/api/schedule/excessive-lags-chart-data',
        'fs': '/api/schedule/fs-chart-data',
        'non-fs': '/api/schedule/non-fs-chart-data'
    };
    return endpoints[metric];
}

function getHistoryEndpoint(metric) {
    const endpoints = {
        'leads': '/api/schedule/leads-percentage-history',
        'lags': '/api/schedule/lags-percentage-history',
        'excessive-lags': '/api/schedule/excessive-lags-line-chart',
        'fs': '/api/schedule/fs-line-chart',
        'non-fs': '/api/schedule/non-fs-line-chart'
    };
    
    return endpoints[metric] || endpoints['leads'];
}

function getTableEndpoint(metric) {
    const endpoints = {
        'leads': '/api/schedule/leads',
        'lags': '/api/schedule/lags',
        'excessive-lags': '/api/schedule/excessive-lags',
        'fs': '/api/schedule/fs',
        'non-fs': '/api/schedule/non-fs'
    };
    return endpoints[metric];
}

function updateKPISection(data, metric) {
    const kpiSection = document.getElementById('kpi-section');
    kpiSection.innerHTML = '';
    
    const kpiCards = getKPICards(data, metric);
    kpiCards.forEach(card => {
        const cardElement = createKPICard(card);
        kpiSection.appendChild(cardElement);
    });
}

function getKPICards(data, metric) {
    switch (metric) {
        case 'leads':
            return [
                { title: 'Total Relationships', value: data.Total_Relationship_Count || 0, icon: 'fas fa-list', color: 'blue' },
                { title: 'Remaining Relationships', value: data.Remaining_Relationship_Count || 0, icon: 'fas fa-exclamation-triangle', color: 'red' },
                { title: 'Leads', value: data.Leads_Count || 0, icon: 'fas fa-calendar', color: 'green' },
                { title: 'Lead Percentage', value: (data.Lead_Percentage || 0).toFixed(2) + '%', icon: 'fas fa-arrow-right', color: 'purple' }
            ];
        case 'lags':
            return [
                { title: 'Total Relationships', value: data.Total_Relationship_Count || 0, icon: 'fas fa-list', color: 'blue' },
                { title: 'Remaining Relationships', value: data.Remaining_Relationship_Count || 0, icon: 'fas fa-exclamation-triangle', color: 'red' },
                { title: 'Lags', value: data.Lags_Count || 0, icon: 'fas fa-clock', color: 'green' },
                { title: 'Lag Percentage', value: (data.Lag_Percentage || 0).toFixed(2) + '%', icon: 'fas fa-chart-line', color: 'purple' }
            ];
        case 'excessive-lags':
            return [
                { title: 'Total Relationships', value: data.Total_Relationship_Count || 0, icon: 'fas fa-list', color: 'blue' },
                { title: 'Remaining Relationships', value: data.Remaining_Relationship_Count || 0, icon: 'fas fa-exclamation-triangle', color: 'red' },
                { title: 'Excessive Lags', value: data.ExcessiveLags_Count || 0, icon: 'fas fa-clock', color: 'orange' },
                { title: 'Excessive Lag %', value: (data.ExcessiveLag_Percentage || 0).toFixed(2) + '%', icon: 'fas fa-percentage', color: 'purple' }
            ];
        case 'fs':
            return [
                { title: 'Total Relationships', value: data.Total_Relationship_Count || 0, icon: 'fas fa-list', color: 'blue' },
                { title: 'Remaining Relationships', value: data.Remaining_Relationship_Count || 0, icon: 'fas fa-exclamation-triangle', color: 'red' },
                { title: 'FS+0d', value: data.FS_Count || 0, icon: 'fas fa-link', color: 'green' },
                { title: 'FS+0d Percentage', value: (data.FS_Percentage || 0).toFixed(2) + '%', icon: 'fas fa-percentage', color: 'purple' }
            ];
        case 'non-fs':
            return [
                { title: 'Total Relationships', value: data.Total_Relationship_Count || 0, icon: 'fas fa-list', color: 'blue' },
                { title: 'Remaining Relationships', value: data.Remaining_Relationship_Count || 0, icon: 'fas fa-exclamation-triangle', color: 'red' },
                { title: 'Non FS+0d', value: data.NonFS_Count || 0, icon: 'fas fa-link', color: 'orange' },
                { title: 'Non FS+0d %', value: (data.NonFS_Percentage || 0).toFixed(2) + '%', icon: 'fas fa-percentage', color: 'purple' }
            ];
        default:
            return [];
    }
}

function createKPICard(card) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-lg shadow p-6';
    div.innerHTML = `
        <div class="flex items-center">
            <div class="bg-${card.color}-100 p-3 rounded-full">
                <i class="${card.icon} text-${card.color}-600 text-xl"></i>
            </div>
            <div class="ml-4">
                <h3 class="text-gray-500 text-sm">${card.title}</h3>
                <p class="text-xl font-semibold text-gray-800">${card.value}</p>
            </div>
        </div>
    `;
    return div;
}

function updateChartSection(data, metric) {
    if (currentChart) {
        currentChart.destroy();
    }
    
    const ctx = document.getElementById('metric-chart').getContext('2d');
    currentChart = createChart(ctx, data, metric);
}

function updateHistorySection(data, metric) {
    if (currentHistoryChart) {
        currentHistoryChart.destroy();
    }
    
    const ctx = document.getElementById('history-chart').getContext('2d');
    currentHistoryChart = createHistoryChart(ctx, data, metric);
}

function createChart(ctx, data, metric) {
    // Special handling for leads, lags, and excessive-lags - stacked column chart
    if (metric === 'leads' || metric === 'lags' || metric === 'excessive-lags') {
        return createStackedColumnChart(ctx, data, metric);
    }
    
    // Default chart configuration for other metrics (fs, non-fs)
    const config = {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
                    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        fontSize: 12,
                        padding: 10,
                        usePointStyle: true
                    }
                }
            },
            cutout: '60%'
        }
    };
    
    // Process data based on metric type
    if (Array.isArray(data) && data.length > 0) {
        config.data.labels = data.map(item => item.label || item.name || 'Unknown');
        config.data.datasets[0].data = data.map(item => item.value || item.count || 0);
    } else if (data && typeof data === 'object') {
        // Handle object-based data
        const entries = Object.entries(data);
        if (entries.length > 0) {
            config.data.labels = entries.map(([key]) => key);
            config.data.datasets[0].data = entries.map(([, value]) => value);
        }
    }
    
    return new Chart(ctx, config);
}

function createStackedColumnChart(ctx, data, metric) {
    // Determine X-axis label based on metric
    let xAxisLabel = 'Lags';
    if (metric === 'leads') {
        xAxisLabel = 'Leads';
    } else if (metric === 'lags') {
        xAxisLabel = 'Lags';
    } else if (metric === 'excessive-lags') {
        xAxisLabel = 'Excessive Lags';
    }
    
    const config = {
        type: 'bar',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: xAxisLabel
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Count'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        fontSize: 12,
                        padding: 10,
                        usePointStyle: true
                    }
                }
            }
        }
    };
    
    // Process stacked chart data
    if (Array.isArray(data) && data.length > 0) {
        // Group data by lag values and relationship types
        const lagGroups = {};
        const relationshipTypes = new Set();
        
        data.forEach(item => {
            const lag = item.lag || item.ExcessiveLag || 'Unknown';
            const relType = item.relationship_type || item.RelationshipType || 'Unknown';
            const count = item.count || item.value || 0;
            
            if (!lagGroups[lag]) {
                lagGroups[lag] = {};
            }
            lagGroups[lag][relType] = (lagGroups[lag][relType] || 0) + count;
            relationshipTypes.add(relType);
        });
        
        // Set labels (lag values)
        config.data.labels = Object.keys(lagGroups).sort((a, b) => {
            const numA = parseFloat(a);
            const numB = parseFloat(b);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.localeCompare(b);
        });
        
        // Create datasets for each relationship type
        const colors = [
            '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
            '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
        ];
        
        Array.from(relationshipTypes).forEach((relType, index) => {
            const dataset = {
                label: relType,
                data: config.data.labels.map(lag => lagGroups[lag][relType] || 0),
                backgroundColor: colors[index % colors.length],
                borderColor: colors[index % colors.length],
                borderWidth: 1
            };
            config.data.datasets.push(dataset);
        });
    }
    
    return new Chart(ctx, config);
}

function createHistoryChart(ctx, data, metric) {
    const config = {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: `${metric.charAt(0).toUpperCase() + metric.slice(1)} Trend`,
                data: [],
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        fontSize: 12
                    }
                },
                x: {
                    ticks: {
                        fontSize: 12,
                        maxRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        fontSize: 12,
                        padding: 10,
                        usePointStyle: true
                    }
                }
            }
        }
    };
    
    // Process history data
    if (Array.isArray(data) && data.length > 0) {
        config.data.labels = data.map(item => item.date || item.period || 'Period');
        config.data.datasets[0].data = data.map(item => item.value || item.percentage || 0);
    }
    
    return new Chart(ctx, config);
}

function updateTableSection(data, metric) {
    const tableConfig = getTableConfig(metric);
    const tableHead = document.getElementById('table-head');
    const tableBody = document.getElementById('table-body');
    
    // Clear existing content
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';
    
    if (!Array.isArray(data) || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="100%" class="text-center py-4 text-gray-500">No data available</td></tr>';
        return;
    }
    
    // Create table headers
    const headerRow = document.createElement('tr');
    tableConfig.columns.forEach(column => {
        const th = document.createElement('th');
        th.className = 'px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
        th.textContent = column.title;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);
    
    // Create table rows
    data.slice(0, 50).forEach(row => { // Limit to 50 rows for performance
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        
        tableConfig.columns.forEach(column => {
            const td = document.createElement('td');
            td.className = 'px-4 py-2 text-sm text-gray-900';
            td.textContent = row[column.field] || '';
            tr.appendChild(td);
        });
        
        tableBody.appendChild(tr);
    });
    
    // Show total count if more than 50 rows
    if (data.length > 50) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="${tableConfig.columns.length}" class="px-4 py-2 text-sm text-gray-500 text-center">Showing 50 of ${data.length} records</td>`;
        tableBody.appendChild(tr);
    }
}

function getTableConfig(metric) {
    const configs = {
        'leads': {
            columns: [
                { field: 'Pred. ID', title: 'Pred. ID' },
                { field: 'Succ. ID', title: 'Succ. ID' },
                { field: 'Pred. Name', title: 'Pred. Name' },
                { field: 'Succ. Name', title: 'Succ. Name' },
                { field: 'Relationship type', title: 'Relationship Type' },
                { field: 'Lag', title: 'Lag' },
                { field: 'Lead', title: 'Lead' },
                { field: 'ExcessiveLag', title: 'Excessive Lag' },
                { field: 'Driving', title: 'Driving' },
                { field: 'FreeFloat', title: 'Free Float' },
                { field: 'Relationship_Status', title: 'Rel. Status' }
            ]
        },
        'lags': {
            columns: [
                { field: 'Pred. ID', title: 'Pred. ID' },
                { field: 'Succ. ID', title: 'Succ. ID' },
                { field: 'Pred. Name', title: 'Pred. Name' },
                { field: 'Succ. Name', title: 'Succ. Name' },
                { field: 'Relationship type', title: 'Relationship Type' },
                { field: 'Lag', title: 'Lag' },
                { field: 'Lead', title: 'Lead' },
                { field: 'ExcessiveLag', title: 'Excessive Lag' },
                { field: 'Driving', title: 'Driving' },
                { field: 'FreeFloat', title: 'Free Float' },
                { field: 'Relationship_Status', title: 'Rel. Status' }
            ]
        },
        'excessive-lags': {
            columns: [
                { field: 'Pred. ID', title: 'Pred. ID' },
                { field: 'Succ. ID', title: 'Succ. ID' },
                { field: 'Pred. Name', title: 'Pred. Name' },
                { field: 'Succ. Name', title: 'Succ. Name' },
                { field: 'Relationship type', title: 'Relationship Type' },
                { field: 'Lag', title: 'Lag' },
                { field: 'Lead', title: 'Lead' },
                { field: 'ExcessiveLag', title: 'Excessive Lag' },
                { field: 'Driving', title: 'Driving' },
                { field: 'FreeFloat', title: 'Free Float' },
                { field: 'Relationship_Status', title: 'Rel. Status' }
            ]
        },
        'fs': {
            columns: [
                { field: 'Pred. ID', title: 'Pred. ID' },
                { field: 'Succ. ID', title: 'Succ. ID' },
                { field: 'Pred. Name', title: 'Pred. Name' },
                { field: 'Succ. Name', title: 'Succ. Name' },
                { field: 'Relationship type', title: 'Relationship Type' },
                { field: 'Lag', title: 'Lag' },
                { field: 'Lead', title: 'Lead' },
                { field: 'ExcessiveLag', title: 'Excessive Lag' },
                { field: 'Driving', title: 'Driving' },
                { field: 'FreeFloat', title: 'Free Float' },
                { field: 'Relationship_Status', title: 'Rel. Status' }
            ]
        },
        'non-fs': {
            columns: [
                { field: 'Pred. ID', title: 'Pred. ID' },
                { field: 'Succ. ID', title: 'Succ. ID' },
                { field: 'Pred. Name', title: 'Pred. Name' },
                { field: 'Succ. Name', title: 'Succ. Name' },
                { field: 'Relationship type', title: 'Relationship Type' },
                { field: 'Lag', title: 'Lag' },
                { field: 'Lead', title: 'Lead' },
                { field: 'ExcessiveLag', title: 'Excessive Lag' },
                { field: 'Driving', title: 'Driving' },
                { field: 'FreeFloat', title: 'Free Float' },
                { field: 'Relationship_Status', title: 'Rel. Status' }
            ]
        }
    };
    
    return configs[metric] || configs['leads'];
}

// Export functions
async function exportToPDF(sectionId, filename) {
    try {
        const element = document.getElementById(sectionId);
        const canvas = await html2canvas(element);
        const imgData = canvas.toDataURL('image/png');
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        const imgWidth = 190;
        const pageHeight = pdf.internal.pageSize.height;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        
        let position = 10;
        
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        
        pdf.save(`${filename}.pdf`);
    } catch (error) {
        console.error('Error exporting PDF:', error);
        showError('Failed to export PDF');
    }
}

function exportToExcel(filename) {
    try {
        if (currentMetric) {
            // For now, we'll export as CSV
            fetchTableData(currentMetric).then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    const csv = convertToCSV(data);
                    downloadCSV(csv, `${filename}.csv`);
                }
            });
        }
    } catch (error) {
        console.error('Error exporting Excel:', error);
        showError('Failed to export Excel');
    }
}

async function exportToImage(sectionId, filename) {
    try {
        const element = document.getElementById(sectionId);
        const canvas = await html2canvas(element);
        
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL();
        link.click();
    } catch (error) {
        console.error('Error exporting image:', error);
        showError('Failed to export image');
    }
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    return csvContent;
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Utility functions
function showLoading() {
    // Could add a loading spinner here
    console.log('Loading...');
}

function hideLoading() {
    // Hide loading spinner
    console.log('Loading complete');
}

function showError(message) {
    // Could add a toast notification or alert
    console.error('Error:', message);
    alert(message);
}

// Make functions available globally for onclick handlers
window.exportToPDF = exportToPDF;
window.exportToExcel = exportToExcel;
window.exportToImage = exportToImage;

// Full page export functions for header buttons
async function exportFullPageToPDF() {
    try {
        const mainContent = document.querySelector('main');
        const canvas = await html2canvas(mainContent, {
            scale: 1,
            useCORS: true,
            allowTaint: true
        });
        
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        
        const imgX = (pdfWidth - imgWidth * ratio) / 2;
        const imgY = 10;
        
        pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
        
        const filename = `schedule-drilldown-${currentMetric}-${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(filename);
        
        console.log('Full page exported to PDF successfully');
    } catch (error) {
        console.error('Error exporting full page to PDF:', error);
        showError('Failed to export page to PDF');
    }
}

async function exportFullPageToExcel() {
    try {
        // Get all table data for Excel export
        const tableData = await fetchTableData(currentMetric);
        
        if (!Array.isArray(tableData) || tableData.length === 0) {
            showError('No data available to export');
            return;
        }
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Add main data sheet
        const ws = XLSX.utils.json_to_sheet(tableData);
        XLSX.utils.book_append_sheet(wb, ws, `${currentMetric} Data`);
        
        // Add KPI summary if available
        try {
            const kpiData = await fetchKPIData(currentMetric);
            if (kpiData) {
                const kpiArray = Object.entries(kpiData).map(([key, value]) => ({
                    'Metric': key,
                    'Value': value
                }));
                const kpiWs = XLSX.utils.json_to_sheet(kpiArray);
                XLSX.utils.book_append_sheet(wb, kpiWs, 'KPI Summary');
            }
        } catch (error) {
            console.warn('Could not add KPI data to Excel:', error);
        }
        
        // Save file
        const filename = `schedule-drilldown-${currentMetric}-${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        console.log('Full page exported to Excel successfully');
    } catch (error) {
        console.error('Error exporting full page to Excel:', error);
        showError('Failed to export page to Excel');
    }
}

async function exportFullPageToImage() {
    try {
        const mainContent = document.querySelector('main');
        const canvas = await html2canvas(mainContent, {
            scale: 2, // Higher quality
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#f3f4f6' // Match the page background
        });
        
        // Create download link
        const link = document.createElement('a');
        const filename = `schedule-drilldown-${currentMetric}-${new Date().toISOString().split('T')[0]}.png`;
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('Full page exported to image successfully');
    } catch (error) {
        console.error('Error exporting full page to image:', error);
        showError('Failed to export page to image');
    }
} 