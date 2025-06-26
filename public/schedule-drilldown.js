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
        
        // Load projects and filter options
        await Promise.all([
            loadProjects(),
            loadRelationshipTypes(),
            loadFreeFloatOptions()
        ]);
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('Schedule Drilldown initialized successfully');
    } catch (error) {
        console.error('Error initializing Schedule Drilldown:', error);
        showError('Failed to initialize application');
    }
}

function setupEventListeners() {
    // Metric card selection with hover functionality
    document.querySelectorAll('.metric-card').forEach(card => {
        const metric = card.dataset.metric;
        const color = card.dataset.color;
        
        console.log(`🎯 Setting up listeners for ${metric} with color ${color}`);
        
        // Mouse enter - add hover effect
        card.addEventListener('mouseenter', function() {
            if (!this.classList.contains('selected')) {
                console.log(`🖱️ Hover enter: ${metric} (${color})`);
                this.classList.remove('border-transparent');
                this.classList.add(`border-${color}-500`);
            }
        });
        
        // Mouse leave - remove hover effect if not selected
        card.addEventListener('mouseleave', function() {
            if (!this.classList.contains('selected')) {
                console.log(`🖱️ Hover leave: ${metric} (${color})`);
                this.classList.remove(`border-${color}-500`);
                this.classList.add('border-transparent');
            }
        });
        
        // Click - select metric
        card.addEventListener('click', function() {
            console.log(`🖱️ Click: ${metric} (${color})`);
            selectMetric(metric);
        });
    });
    
    // Project filter - auto-refresh data when project changes
    document.getElementById('projectFilter').addEventListener('change', function() {
        currentProjectId = this.value;
        updateActiveFiltersCount();
        // Reload all filter options based on new project selection
        if (currentMetric) {
            if (currentMetric === 'open-ends') {
                // For Open Ends, reload activity-based filters
                Promise.all([
                    loadActivityTypes(),
                    loadActivityStatuses()
                ]).then(() => {
                    loadMetricData(currentMetric);
                });
            } else if (currentMetric === 'constraints') {
                // For Constraints, reload activity-based filters 
                Promise.all([
                    loadActivityTypes(),
                    loadHardSoftConstraints()
                ]).then(() => {
                    loadMetricData(currentMetric);
                });
            } else {
                // For other metrics, reload relationship-based filters
                Promise.all([
                    loadRelationshipTypes(currentMetric),
                    loadDrivingOptions(currentMetric),
                    loadFreeFloatOptions(currentMetric)
                ]).then(() => {
                    loadMetricData(currentMetric);
                });
            }
        }
    });
    
    // Apply filters button
    document.getElementById('applyFiltersBtn').addEventListener('click', function() {
        console.log('🔥 Apply Filters button clicked');
        updateActiveFiltersCount();
        if (currentMetric) {
            console.log(`🔥 Applying filters for metric: ${currentMetric}`);
            loadMetricData(currentMetric);
        } else {
            alert('Please select a metric first');
        }
    });
    
    // Clear filters button
    document.getElementById('clearFiltersBtn').addEventListener('click', function() {
        clearAllFilters();
        if (currentMetric) {
            loadMetricData(currentMetric);
        }
        updateActiveFiltersCount();
    });
    
    // Filter change handlers for real-time updates
    const filterElements = [
        'relationshipTypeFilter', 'drivingFilter', 'freeFloatFilter'
    ];
    
    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', function() {
                updateActiveFiltersCount();
                
                // Only reload dependent filter options for relationship-based metrics
                if (currentMetric && currentMetric !== 'open-ends' && currentMetric !== 'constraints') {
                    // Reload dependent filter options when filters change
                    if (id === 'relationshipTypeFilter') {
                        // When relationship type changes, reload driving and free float options
                        loadDrivingOptions(currentMetric);
                        loadFreeFloatOptions(currentMetric);
                    } else if (id === 'drivingFilter') {
                        // When driving changes, reload free float options
                        loadFreeFloatOptions(currentMetric);
                    }
                }
                
                // Auto-refresh data when filters change (only if a metric is selected)
                if (currentMetric) {
                    console.log(`🔄 Filter ${id} changed, refreshing data...`);
                    loadMetricData(currentMetric);
                }
            });
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
        const response = await fetch(`${API_BASE}/api/project-options`);
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

async function loadRelationshipTypes(metricType = 'general') {
    try {
        // Use different endpoint based on metric type
        let endpoint = '/api/relationship-type-options'; // Default general endpoint
        
        if (metricType === 'fs') {
            endpoint = '/api/fs-relationship-type-options';
        } else if (metricType === 'non-fs') {
            endpoint = '/api/non-fs-relationship-type-options';
        } else if (metricType === 'leads') {
            endpoint = '/api/leads-relationship-type-options';
        } else if (metricType === 'lags') {
            endpoint = '/api/lags-relationship-type-options';
        } else if (metricType === 'excessive-lags') {
            endpoint = '/api/excessive-lags-relationship-type-options';
        }
        
        // Add project filter if available
        const params = new URLSearchParams();
        if (currentProjectId && currentProjectId !== '') {
            params.append('project_id', currentProjectId);
        }
        
        const queryString = params.toString() ? '?' + params.toString() : '';
        const response = await fetch(`${API_BASE}${endpoint}${queryString}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const relationshipTypes = await response.json();
        const select = document.getElementById('relationshipTypeFilter');
        
        // Clear existing options except "All Types"
        select.innerHTML = '<option value="all">All Types</option>';
        
        // Add relationship type options
        relationshipTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.textContent = type.label;
            select.appendChild(option);
        });
        
        console.log(`Loaded relationship types (${metricType}):`, relationshipTypes.length);
    } catch (error) {
        console.error('Error loading relationship types:', error);
        showError('Failed to load relationship types');
    }
}

async function loadDrivingOptions(metricType = 'general') {
    try {
        // Skip loading driving options for metrics that don't need them
        if (metricType === 'constraints' || metricType === 'open-ends') {
            console.log(`Skipping driving options for ${metricType} - not needed`);
            return;
        }
        
        // Use different endpoint based on metric type
        let endpoint = null;
        
        if (metricType === 'leads') {
            endpoint = '/api/leads-driving-options';
        } else if (metricType === 'lags') {
            endpoint = '/api/lags-driving-options';
        } else if (metricType === 'excessive-lags') {
            endpoint = '/api/excessive-lags-driving-options';
        } else if (metricType === 'fs') {
            endpoint = '/api/fs-driving-options';
        } else if (metricType === 'non-fs') {
            endpoint = '/api/non-fs-driving-options';
        } else {
            // For unknown metrics, skip loading driving options
            console.log(`No driving options endpoint for metric: ${metricType}`);
            return;
        }
        
        // Build query parameters
        const params = new URLSearchParams();
        
        if (currentProjectId && currentProjectId !== '') {
            params.append('project_id', currentProjectId);
        }
        
        const relationshipType = document.getElementById('relationshipTypeFilter')?.value;
        if (relationshipType && relationshipType !== 'all' && relationshipType !== '') {
            params.append('relationship_type', relationshipType);
        }
        
        const queryString = params.toString() ? '?' + params.toString() : '';
        const response = await fetch(`${API_BASE}${endpoint}${queryString}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const drivingValues = await response.json();
        const select = document.getElementById('drivingFilter');
        const currentValue = select.value;
        
        // Clear existing options except "All Values"
        select.innerHTML = '<option value="all">All Values</option>';
        
        // Add driving options
        drivingValues.forEach(driving => {
            const option = document.createElement('option');
            option.value = driving.value;
            option.textContent = driving.label;
            select.appendChild(option);
        });
        
        // Restore previous selection if it still exists
        if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
        
        console.log(`Loaded driving options for ${metricType}:`, drivingValues.length);
    } catch (error) {
        console.error('Error loading driving options:', error);
        showError('Failed to load driving options');
    }
}

async function loadFreeFloatOptions(metricType = 'general') {
    try {
        // Skip loading free float options for metrics that don't need them
        if (metricType === 'constraints' || metricType === 'open-ends') {
            console.log(`Skipping free float options for ${metricType} - not needed`);
            return;
        }
        
        // Use different endpoint based on metric type
        let endpoint = null;
        
        if (metricType === 'leads') {
            endpoint = '/api/leads-free-float-options';
        } else if (metricType === 'lags') {
            endpoint = '/api/lags-free-float-options';
        } else if (metricType === 'excessive-lags') {
            endpoint = '/api/excessive-lags-free-float-options';
        } else if (metricType === 'fs') {
            endpoint = '/api/fs-free-float-options';
        } else if (metricType === 'non-fs') {
            endpoint = '/api/non-fs-free-float-options';
        } else {
            // For unknown metrics, skip loading free float options
            console.log(`No free float options endpoint for metric: ${metricType}`);
            return;
        }
        
        // Build query parameters based on current filter state (excluding free float itself)
        const params = new URLSearchParams();
        
        // Add metric type filter for general endpoint
        if (metricType === 'fs' || metricType === 'non-fs') {
            params.append('metric_type', metricType);
        }
        
        // Add project filter
        if (currentProjectId && currentProjectId !== '') {
            params.append('project_id', currentProjectId);
        }
        
        // Add relationship type filter  
        const relationshipType = document.getElementById('relationshipTypeFilter')?.value;
        if (relationshipType && relationshipType !== 'all' && relationshipType !== '') {
            params.append('relationship_type', relationshipType);
        }
        
        // Add driving filter
        const driving = document.getElementById('drivingFilter')?.value;
        if (driving && driving !== 'all' && driving !== '') {
            params.append('driving', driving);
        }
        
        const queryString = params.toString() ? '?' + params.toString() : '';
        const response = await fetch(`${API_BASE}${endpoint}${queryString}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const freeFloatValues = await response.json();
        const select = document.getElementById('freeFloatFilter');
        const currentValue = select.value; // Preserve current selection if possible
        
        // Clear existing options except "All Values"
        select.innerHTML = '<option value="all">All Values</option>';
        
        // Add free float options
        freeFloatValues.forEach(float => {
            const option = document.createElement('option');
            option.value = float.value;
            option.textContent = float.label;
            select.appendChild(option);
        });
        
        // Restore previous selection if it still exists
        if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
        
        console.log(`Loaded context-aware free float values for ${metricType}:`, freeFloatValues.length);
    } catch (error) {
        console.error('Error loading free float values:', error);
        showError('Failed to load free float values');
    }
}

async function loadActivityTypes() {
    try {
        // Build query parameters for project filtering
        const params = new URLSearchParams();
        if (currentProjectId && currentProjectId !== '') {
            params.append('project_id', currentProjectId);
        }
        
        const queryString = params.toString() ? '?' + params.toString() : '';
        const response = await fetch(`${API_BASE}/api/activity-types${queryString}`);
        if (!response.ok) throw new Error(`Failed to fetch activity types: ${response.status}`);
        
        const activityTypes = await response.json();
        const relationshipSelect = document.getElementById('relationshipTypeFilter');
        const label = document.querySelector('label[for="relationshipTypeFilter"]');
        
        // Update the label and options for Activity Type
        label.textContent = 'Activity Type:';
        relationshipSelect.innerHTML = '<option value="all">All Types</option>';
        
        activityTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.name || type.ActivityType;
            option.textContent = type.name || type.ActivityType;
            relationshipSelect.appendChild(option);
        });
        
        console.log(`Loaded ${activityTypes.length} activity types for project ${currentProjectId || 'all'}`);
    } catch (error) {
        console.error('Error loading activity types:', error);
        showError('Failed to load activity types');
    }
}

async function loadActivityStatuses() {
    try {
        // Build query parameters for project filtering
        const params = new URLSearchParams();
        if (currentProjectId && currentProjectId !== '') {
            params.append('project_id', currentProjectId);
        }
        
        const queryString = params.toString() ? '?' + params.toString() : '';
        const response = await fetch(`${API_BASE}/api/activity-statuses${queryString}`);
        if (!response.ok) throw new Error(`Failed to fetch activity statuses: ${response.status}`);
        
        const activityStatuses = await response.json();
        const drivingSelect = document.getElementById('drivingFilter');
        const label = document.querySelector('label[for="drivingFilter"]');
        
        // Update the label and options for Activity Status
        label.textContent = 'Activity Status:';
        drivingSelect.innerHTML = '<option value="all">All Statuses</option>';
        
        activityStatuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status.name || status.ActivityStatus;
            option.textContent = status.name || status.ActivityStatus;
            drivingSelect.appendChild(option);
        });
        
        // Hide the Free Float filter for Open Ends
        const freeFloatContainer = document.querySelector('label[for="freeFloatFilter"]').parentElement;
        freeFloatContainer.style.display = 'none';
        
        console.log(`Loaded ${activityStatuses.length} activity statuses for project ${currentProjectId || 'all'}`);
    } catch (error) {
        console.error('Error loading activity statuses:', error);
        showError('Failed to load activity statuses');
    }
}

function resetFilterLabels() {
    console.log('🔄 Resetting filter labels to relationship-based filters');
    
    // Reset to original relationship-based filter labels
    const relationshipLabel = document.querySelector('label[for="relationshipTypeFilter"]');
    const drivingLabel = document.querySelector('label[for="drivingFilter"]');
    const freeFloatContainer = document.querySelector('label[for="freeFloatFilter"]').parentElement;
    
    if (relationshipLabel) {
        relationshipLabel.textContent = 'Relationship Type:';
    }
    if (drivingLabel) {
        drivingLabel.textContent = 'Driving:';
    }
    if (freeFloatContainer) {
        freeFloatContainer.style.display = 'block'; // Show free float filter
    }
    
    // Reset the select elements to default relationship-based options
    const relationshipSelect = document.getElementById('relationshipTypeFilter');
    const drivingSelect = document.getElementById('drivingFilter');
    const freeFloatSelect = document.getElementById('freeFloatFilter');
    
    if (relationshipSelect) {
        relationshipSelect.innerHTML = '<option value="all">All</option>';
    }
    if (drivingSelect) {
        drivingSelect.innerHTML = `
            <option value="all">All</option>
            <option value="Y">Yes</option>
            <option value="N">No</option>
        `;
    }
    if (freeFloatSelect) {
        freeFloatSelect.innerHTML = '<option value="all">All</option>';
    }
}

async function selectMetric(metric) {
    console.log(`🔥 Selecting metric: ${metric}`);
    
    // Remove selected class and borders from all cards
    document.querySelectorAll('.metric-card').forEach(card => {
        card.classList.remove('selected');
        const cardColor = card.dataset.color;
        console.log(`🧹 Clearing ${card.dataset.metric} (${cardColor})`);
        card.classList.remove(`border-${cardColor}-500`);
        card.classList.add('border-transparent');
    });
    
    // Add selected class and border to clicked card
    const selectedCard = document.querySelector(`[data-metric="${metric}"]`);
    if (selectedCard) {
        const color = selectedCard.dataset.color;
        console.log(`✅ Selecting ${metric} with color ${color}`);
        selectedCard.classList.add('selected');
        selectedCard.classList.remove('border-transparent');
        selectedCard.classList.add(`border-${color}-500`);
        
        // Verify the classes were applied
        console.log(`🔍 Applied classes:`, selectedCard.classList.toString());
    }
    
    // Show content area and hide initial message
    document.getElementById('metric-content').classList.remove('hidden');
    document.getElementById('initial-message').classList.add('hidden');
    
    currentMetric = metric;
    
    // Check if this metric has implemented functionality
    const implementedMetrics = ['fs', 'non-fs', 'leads', 'lags', 'excessive-lags', 'open-ends', 'constraints'];
    
    if (implementedMetrics.includes(metric)) {
        // Load appropriate filter options based on metric
        if (metric === 'open-ends' || metric === 'constraints') {
            // Update filter labels for activity-based metrics
            const relationshipLabel = document.querySelector('label[for="relationshipTypeFilter"]');
            const drivingLabel = document.querySelector('label[for="drivingFilter"]');
            const freeFloatContainer = document.querySelector('label[for="freeFloatFilter"]').parentElement;
            
            if (relationshipLabel) {
                relationshipLabel.textContent = 'Activity Type:';
            }
            if (drivingLabel) {
                drivingLabel.textContent = metric === 'constraints' ? 'Hard/Soft Constraint:' : 'Activity Status:';
            }
            if (freeFloatContainer) {
                freeFloatContainer.style.display = 'none'; // Hide free float filter for activity-based metrics
            }
            
            // For Open Ends and Constraints, we need Activity Type and Activity Status (or Hard/Soft Constraint) filters
            if (metric === 'constraints') {
                await Promise.all([
                    loadActivityTypes(),
                    loadHardSoftConstraints()
                ]);
            } else {
                await Promise.all([
                    loadActivityTypes(),
                    loadActivityStatuses()
                ]);
            }
        } else {
            // For all other metrics (fs, non-fs, leads, lags, excessive-lags), use relationship-based filters
            console.log(`🔄 Loading relationship-based filters for ${metric}`);
            resetFilterLabels(); // Reset filter labels first
            
            await Promise.all([
                loadRelationshipTypes(metric),
                loadDrivingOptions(metric),
                loadFreeFloatOptions(metric)
            ]);
        }
        
    loadMetricData(metric);
    } else {
        // Show "Work in Progress" for non-implemented metrics
        showWorkInProgress(metric);
    }
}

async function loadMetricData(metric) {
    try {
        showLoading();
        
        // Check if PR_FS1 is selected for FS metric - skip API calls and show messages only
        const relationshipType = document.getElementById('relationshipTypeFilter')?.value;
        if (metric === 'fs' && relationshipType === 'PR_FS1') {
            console.log('🚫 PR_FS1 selected - showing messages without API calls');
            
            // Show messages instead of loading data
            updateKPISection(null, metric);
            updateChartSection([], metric);
            updateHistorySection([], metric);
            updateTableSection([], metric);
            
            hideLoading();
            return;
        }
        
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
    const queryParams = buildQueryParams();
    const url = `${API_BASE}${endpoint}${queryParams}`;
    
    console.log(`📊 Fetching KPI data for ${metric}:`, url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch KPI data: ${response.status}`);
    const data = await response.json();
    console.log(`📊 KPI Response for ${metric}:`, data);
    return data;
}

function buildQueryParams() {
    const params = new URLSearchParams();
    
    // Project filter
    if (currentProjectId && currentProjectId !== '') {
        params.append('project_id', currentProjectId);
    }
    
    // Relationship type filter
    const relationshipType = document.getElementById('relationshipTypeFilter')?.value;
    if (relationshipType && relationshipType !== 'all' && relationshipType !== '') {
        params.append('relationship_type', relationshipType);
    }
    
    // Driving filter
    const driving = document.getElementById('drivingFilter')?.value;
    if (driving && driving !== 'all' && driving !== '') {
        params.append('driving', driving);
    }
    
    // Free float filter
    const freeFloat = document.getElementById('freeFloatFilter')?.value;
    if (freeFloat && freeFloat !== 'all' && freeFloat !== '') {
        params.append('free_float', freeFloat);
    }
    
    const queryString = params.toString() ? '?' + params.toString() : '';
    console.log('🔍 Query params:', queryString);
    return queryString;
}

async function fetchChartData(metric) {
    const endpoint = getChartEndpoint(metric);
    const queryParams = buildQueryParams();
    const url = `${API_BASE}${endpoint}${queryParams}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch chart data: ${response.status}`);
    return response.json();
}

async function fetchHistoryData(metric) {
    const endpoint = getHistoryEndpoint(metric);
    const queryParams = buildQueryParams();
    const url = `${API_BASE}${endpoint}${queryParams}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch history data: ${response.status}`);
    return response.json();
}

async function fetchTableData(metric) {
    const endpoint = getTableEndpoint(metric);
    const queryParams = buildQueryParams();
    const limitParam = queryParams ? '&limit=20' : '?limit=20';
    const url = `${API_BASE}${endpoint}${queryParams}${limitParam}`;
    
    console.log(`📋 Fetching table data for ${metric}:`, url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch table data: ${response.status}`);
    const data = await response.json();
    console.log(`📋 Table Response for ${metric}:`, data.length, 'rows');
    return data;
}

function getKPIEndpoint(metric) {
    const endpoints = {
        'leads': '/api/schedule/leads-kpi',
        'lags': '/api/schedule/lags-kpi',
        'excessive-lags': '/api/schedule/excessive-lags-kpi',
        'fs': '/api/schedule/fs-kpi',
        'non-fs': '/api/schedule/non-fs-kpi',
        'open-ends': '/api/schedule/open-ends-kpi',
        'constraints': '/api/schedule/constraints-kpi'
    };
    return endpoints[metric];
}

function getChartEndpoint(metric) {
    const endpoints = {
        'leads': '/api/schedule/leads-chart-data',
        'lags': '/api/schedule/lags-chart-data',
        'excessive-lags': '/api/schedule/excessive-lags-chart-data',
        'fs': '/api/schedule/fs-chart-data',
        'non-fs': '/api/schedule/non-fs-chart-data',
        'open-ends': '/api/schedule/open-ends-chart-data',
        'constraints': '/api/schedule/constraints-chart-data'
    };
    return endpoints[metric];
}

function getHistoryEndpoint(metric) {
    const endpoints = {
        'leads': '/api/schedule/leads-percentage-history',
        'lags': '/api/schedule/lags-percentage-history',
        'excessive-lags': '/api/schedule/excessive-lags-line-chart',
        'fs': '/api/schedule/fs-line-chart',
        'non-fs': '/api/schedule/non-fs-line-chart',
        'open-ends': '/api/schedule/open-ends-line-chart',
        'constraints': '/api/schedule/constraints-line-chart'
    };
    
    return endpoints[metric] || endpoints['leads'];
}

function getTableEndpoint(metric) {
    const endpoints = {
        'leads': '/api/schedule/leads',
        'lags': '/api/schedule/lags',
        'excessive-lags': '/api/schedule/excessive-lags',
        'fs': '/api/schedule/fs',
        'non-fs': '/api/schedule/non-fs',
        'open-ends': '/api/schedule/open-ends',
        'constraints': '/api/schedule/constraints'
    };
    return endpoints[metric];
}

function updateKPISection(data, metric) {
    const kpiSection = document.getElementById('kpi-section');
    const kpiGrid = kpiSection.querySelector('.grid');
    kpiGrid.innerHTML = '';
    
    // Check if PR_FS1 is selected for FS metric AND if there's no data - show custom message
    const relationshipType = document.getElementById('relationshipTypeFilter')?.value;
    if (metric === 'fs' && relationshipType === 'PR_FS1' && (!data || Object.keys(data).length === 0 || data.Total_Relationship_Count === 0)) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center col-span-3';
        messageDiv.innerHTML = `
            <div class="text-yellow-800">
                <i class="fas fa-info-circle text-yellow-600 mr-2"></i>
                PR_FS1 relationship type is currently not available in the database. 
                Please select PR_FS to view FS+0d activities.
            </div>
        `;
        kpiGrid.appendChild(messageDiv);
        return;
    }
    
    const kpiCards = getKPICards(data, metric);
    kpiCards.forEach(card => {
        const cardElement = createKPICard(card);
        kpiGrid.appendChild(cardElement);
    });
}

function getKPICards(data, metric) {
    switch (metric) {
        case 'leads':
            return [
                { title: 'Leads Count', value: data.Leads_Count || 0 },
                { title: 'Remaining Relationships', value: data.Remaining_Relationship_Count || 0 },
                { title: 'Lead %', value: (data.Lead_Percentage || 0).toFixed(2) + '%' }
            ];
        case 'lags':
            return [
                { title: 'Lag Count', value: data.Lag_Count || 0 },
                { title: 'Remaining Relationships', value: data.Remaining_Relationship_Count || 0 },
                { title: 'Lag %', value: (data.Lag_Percentage || 0).toFixed(2) + '%' }
            ];
        case 'excessive-lags':
            return [
                { title: 'Lag Count', value: data.Lag_Count || 0 },
                { title: 'Remaining Relationships', value: data.Remaining_Relationship_Count || 0 },
                { title: 'Lag %', value: (data.Lag_Percentage || 0).toFixed(2) + '%' }
            ];
        case 'fs':
            return [
                { title: 'Total Relationships', value: data.Total_Relationship_Count || 0 },
                { title: 'Remaining Relationships', value: data.Remaining_Relationship_Count || 0 },
                { title: 'Lags', value: data.Lag_Count || 0 }
            ];
        case 'non-fs':
            return [
                { title: 'Total Relationships', value: data.Total_Relationship_Count || 0 },
                { title: 'Remaining Relationships', value: data.Remaining_Relationship_Count || 0 },
                { title: 'Lags', value: data.Lag_Count || 0 }
            ];
        case 'open-ends':
            return [
                { title: 'Open End Count', value: data.OpenEnd_Count || 0 },
                { title: 'Permissible Open Ends', value: data.KPIOpenEnds || 2 },
                { title: 'Open Ends %', value: (data.OpenEnds_Percentage || 0).toFixed(2) + '%' }
            ];
        case 'constraints':
            return [
                { title: 'Constraint Count', value: data.CO_Count || 0 },
                { title: 'Remaining Activities', value: data.Remaining_Activities || 0 },
                { title: 'Constraints %', value: (data.Constraints_Percentage || 0).toFixed(2) + '%' }
            ];
        default:
            return [];
    }
}

function createKPICard(card) {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-lg shadow p-3';
    div.innerHTML = `
        <div class="text-center">
            <h3 class="text-gray-500 text-xs font-medium mb-1">${card.title}</h3>
            <p class="text-lg font-semibold text-gray-800">${card.value}</p>
        </div>
    `;
    return div;
}

function updateChartSection(data, metric) {
    if (currentChart) {
        currentChart.destroy();
    }
    
    const chartContainer = document.querySelector('#chart-section .chart-container');
    if (!chartContainer) return;
    
    // Check if PR_FS1 is selected for FS metric - always show message for PR_FS1
    const relationshipType = document.getElementById('relationshipTypeFilter')?.value;
    if (metric === 'fs' && relationshipType === 'PR_FS1') {
        chartContainer.innerHTML = `
            <div class="flex items-center justify-center h-64 text-gray-500">
                <div class="text-center">
                    <svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                    <p class="text-lg font-medium">PR_FS1 data not available</p>
                    <p class="text-sm">Please select PR_FS to view chart data</p>
                </div>
            </div>
        `;
        return;
    }
    
    // Always ensure the chart container is properly reset with canvas
    chartContainer.innerHTML = '<canvas id="metric-chart"></canvas>';
    const canvas = document.getElementById('metric-chart');
    
    if (canvas) {
        // Make sure canvas is visible and properly positioned
        canvas.style.display = 'block';
        canvas.style.position = 'relative';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        
        const ctx = canvas.getContext('2d');
    currentChart = createChart(ctx, data, metric);
    }
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
    
    // Special handling for open-ends - donut chart for Activity Type distribution
    if (metric === 'open-ends') {
        return createOpenEndsChart(ctx, data, metric);
    }
    
    // Special handling for constraints - donut chart for HardOrSoftConstraint and ActivityType
    if (metric === 'constraints') {
        return createConstraintsChart(ctx, data, metric);
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

function createOpenEndsChart(ctx, data, metric) {
    const config = {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
                    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
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
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    };
    
    // Process open ends chart data (already aggregated by Activity Type)
    if (Array.isArray(data) && data.length > 0) {
        // Check if data is already aggregated (has ActivityType and count fields)
        if (data[0] && (data[0].ActivityType || data[0].Activity_Type) && (data[0].count !== undefined)) {
            // Data is already aggregated by backend
            config.data.labels = data.map(item => item.ActivityType || item.Activity_Type || 'Unknown');
            config.data.datasets[0].data = data.map(item => item.count || 0);
        } else {
            // Data needs to be grouped by Activity Type (for detailed records)
            const activityTypeGroups = {};
            data.forEach(item => {
                const activityType = item.ActivityType || item.Activity_Type || 'Unknown';
                activityTypeGroups[activityType] = (activityTypeGroups[activityType] || 0) + 1;
            });
            
            config.data.labels = Object.keys(activityTypeGroups);
            config.data.datasets[0].data = Object.values(activityTypeGroups);
        }
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

function createConstraintsChart(ctx, data, metric) {
    const config = {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
                    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
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
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    };
    
    // Process constraints chart data
    if (Array.isArray(data) && data.length > 0) {
        // Check if data has HardOrSoftConstraint and ActivityType fields (aggregated backend data)
        if (data[0].HardOrSoftConstraint !== undefined && data[0].ActivityType !== undefined) {
            // Group by HardOrSoftConstraint and ActivityType combination
            const constraintGroups = {};
            data.forEach(item => {
                const constraintType = item.HardOrSoftConstraint || 'Unknown';
                const activityType = item.ActivityType || 'Unknown';
                const key = `${constraintType} - ${activityType}`;
                const count = item.count || 0;
                constraintGroups[key] = (constraintGroups[key] || 0) + count;
            });
            
            config.data.labels = Object.keys(constraintGroups);
            config.data.datasets[0].data = Object.values(constraintGroups);
        } else {
            // Handle raw data - group by HardOrSoftConstraint
            const constraintGroups = {};
            data.forEach(item => {
                const constraintType = item.HardOrSoftConstraint || item.Hard_Or_Soft_Constraint || 'Unknown';
                constraintGroups[constraintType] = (constraintGroups[constraintType] || 0) + 1;
            });
            
            config.data.labels = Object.keys(constraintGroups);
            config.data.datasets[0].data = Object.values(constraintGroups);
        }
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
        // Check if PR_FS1 is selected for FS metric - show custom message
        const relationshipType = document.getElementById('relationshipTypeFilter')?.value;
        let message = 'No data available for the current filter selection';
        
        if (metric === 'fs' && relationshipType === 'PR_FS1') {
            message = 'PR_FS1 relationship type is currently not available in the database. Please select PR_FS to view FS+0d activities.';
        }
        
        tableBody.innerHTML = `<tr><td colspan="100%" class="text-center py-2 text-xs text-gray-500">${message}</td></tr>`;
        return;
    }
    
    // Create table headers
    const headerRow = document.createElement('tr');
    tableConfig.columns.forEach(column => {
        const th = document.createElement('th');
        th.className = 'px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
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
            td.className = 'px-2 py-1 text-xs text-gray-900';
            td.textContent = row[column.field] || '';
            tr.appendChild(td);
        });
        
        tableBody.appendChild(tr);
    });
    
    // Show total count if more than 50 rows
    if (data.length > 50) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="${tableConfig.columns.length}" class="px-2 py-1 text-xs text-gray-500 text-center">Showing 50 of ${data.length} records</td>`;
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
        },
        'open-ends': {
            columns: [
                { field: 'ActivityID', title: 'Activity ID' },
                { field: 'ActivityName', title: 'Activity Name' },
                { field: 'StartDate', title: 'Start Date' },
                { field: 'FinishDate', title: 'Finish Date' },
                { field: 'OriginalDuration', title: 'Original Duration' },
                { field: 'TotalFloatDays', title: 'Total Float Days' },
                { field: 'MissingPredecessor', title: 'Missing Predecessor' },
                { field: 'MissingSuccessor', title: 'Missing Successor' },
                { field: 'PrimaryConstraint', title: 'Primary Constraint' },
                { field: 'ActivityType', title: 'Activity Type' },
                { field: 'ActivityStatus', title: 'Activity Status' }
            ]
        },
        'constraints': {
            columns: [
                { field: 'ActivityID', title: 'Activity ID' },
                { field: 'ActivityName', title: 'Activity Name' },
                { field: 'StartDate', title: 'Start Date' },
                { field: 'FinishDate', title: 'Finish Date' },
                { field: 'OriginalDuration', title: 'Original Duration' },
                { field: 'TotalFloatDays', title: 'Total Float Days' },
                { field: 'PrimaryConstraint', title: 'Primary Constraint' },
                { field: 'HardOrSoftConstraint', title: 'Hard/Soft Constraint' },
                { field: 'ConstrainedStart', title: 'Constrained Start' },
                { field: 'ConstrainedFinish', title: 'Constrained Finish' },
                { field: 'ActivityType', title: 'Activity Type' },
                { field: 'ActivityStatus', title: 'Activity Status' }
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

function clearAllFilters() {
    document.getElementById('projectFilter').value = '';
    document.getElementById('relationshipTypeFilter').value = 'all';
    document.getElementById('drivingFilter').value = 'all';
    document.getElementById('freeFloatFilter').value = 'all';
    currentProjectId = '';
}

function updateActiveFiltersCount() {
    let activeCount = 0;
    
    // Count active filters
    if (currentProjectId) activeCount++;
    if (document.getElementById('relationshipTypeFilter')?.value !== 'all') activeCount++;
    if (document.getElementById('drivingFilter')?.value !== 'all') activeCount++;
    if (document.getElementById('freeFloatFilter')?.value !== 'all') activeCount++;
    
    // Update display
    const countElement = document.getElementById('activeFiltersCount');
    if (countElement) {
        if (activeCount === 0) {
            countElement.textContent = 'No active filters';
            countElement.className = 'text-sm text-gray-600';
        } else {
            countElement.textContent = `${activeCount} active filter${activeCount > 1 ? 's' : ''}`;
            countElement.className = 'text-sm text-blue-600 font-medium';
        }
    }
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

function showWorkInProgress(metric) {
    // Clear existing content and show work in progress message
    const kpiSection = document.getElementById('kpi-section');
    const kpiGrid = kpiSection.querySelector('.grid');
    kpiGrid.innerHTML = '';
    
    // Show work in progress message in KPI section
    const messageDiv = document.createElement('div');
    messageDiv.className = 'bg-blue-50 border border-blue-200 rounded-lg p-6 text-center col-span-3';
    messageDiv.innerHTML = `
        <div class="text-blue-800">
            <i class="fas fa-tools text-blue-600 mr-2 text-2xl"></i>
            <h3 class="text-lg font-semibold mb-2">Work in Progress</h3>
            <p class="text-sm">This metric is currently under development and will be available soon.</p>
        </div>
    `;
    kpiGrid.appendChild(messageDiv);
    
    // Clear chart section
    const chartContainer = document.querySelector('#chart-section .chart-container');
    if (chartContainer) {
        chartContainer.innerHTML = `
            <div class="flex items-center justify-center h-64 text-gray-500">
                <div class="text-center">
                    <i class="fas fa-chart-bar text-4xl text-gray-400 mb-4"></i>
                    <p class="text-lg font-medium">Chart Coming Soon</p>
                    <p class="text-sm">Visualization will be available once the metric is implemented</p>
                </div>
            </div>
        `;
    }
    
    // Clear history section
    const historyContainer = document.querySelector('#history-section .chart-container');
    if (historyContainer) {
        historyContainer.innerHTML = `
            <div class="flex items-center justify-center h-64 text-gray-500">
                <div class="text-center">
                    <i class="fas fa-chart-line text-4xl text-gray-400 mb-4"></i>
                    <p class="text-lg font-medium">History Coming Soon</p>
                    <p class="text-sm">Trend analysis will be available once the metric is implemented</p>
                </div>
            </div>
        `;
    }
    
    // Clear table section
    const tableSection = document.getElementById('table-section');
    const tableBody = document.getElementById('table-body');
    const tableHead = document.getElementById('table-head');
    
    if (tableHead) {
        tableHead.innerHTML = `
            <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
        `;
    }
    
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="text-gray-500">
                        <i class="fas fa-table text-2xl text-gray-400 mb-2"></i>
                        <p class="text-sm font-medium">Data Table Coming Soon</p>
                        <p class="text-xs">Detailed data will be available once the metric is implemented</p>
                    </div>
                </td>
            </tr>
        `;
    }
    
    // Destroy any existing charts
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
    
    if (currentHistoryChart) {
        currentHistoryChart.destroy();
        currentHistoryChart = null;
    }
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

async function loadHardSoftConstraints() {
    try {
        const queryParams = buildQueryParams();
        const response = await fetch(`${API_BASE}/api/hard-soft-constraints${queryParams}`);
        
        if (!response.ok) {
            throw new Error(`Failed to load hard/soft constraints: ${response.status}`);
        }
        
        const constraints = await response.json();
        
        const select = document.getElementById('drivingFilter');
        if (select) {
            // Clear existing options except 'All'
            select.innerHTML = '<option value="all">All Constraint Types</option>';
            
            // Add constraint type options
            constraints.forEach(constraint => {
                const option = document.createElement('option');
                option.value = constraint.name;
                option.textContent = constraint.name;
                select.appendChild(option);
            });
        }
        
        console.log('[Hard/Soft Constraints] Loaded:', constraints.length, 'constraint types');
    } catch (error) {
        console.error('[Hard/Soft Constraints] Error:', error);
    }
}

// Debug function to test all color classes
function testColorClasses() {
    const colors = ['purple', 'red', 'indigo', 'blue', 'green', 'orange', 'pink', 'yellow'];
    console.log('🎨 Testing color classes...');
    
    colors.forEach(color => {
        const testElement = document.createElement('div');
        testElement.classList.add(`border-${color}-500`);
        testElement.style.border = '2px solid';
        document.body.appendChild(testElement);
        
        const computedStyle = window.getComputedStyle(testElement);
        const borderColor = computedStyle.borderColor;
        
        console.log(`🎨 ${color}: ${borderColor}`);
        document.body.removeChild(testElement);
    });
}

// Test color classes when page is fully loaded
window.addEventListener('load', function() {
    setTimeout(testColorClasses, 1000);
});