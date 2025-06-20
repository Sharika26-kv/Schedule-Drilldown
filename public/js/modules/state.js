// State management for the schedule application
export const state = {
    currentProject: localStorage.getItem('selectedProjectId') || null,
    scheduleActivities: [],
    cpmResults: [],
    allCriticalTasks: [], // Store all critical tasks for pagination/filtering
    activeTab: 'gantt', // Default active tab
    floatHistogramInstance: null,
    lastGanttData: null, // Store the last loaded Gantt data
    wbsHierarchy: null, // Store WBS hierarchy for reference
    expandedState: {}, // Store expansion state of WBS items
    cpmFilters: {
        dateRangeFilter: 'all',
        statusFilter: 'notComplete',
        customDateStart: null,
        customDateEnd: null,
        wbsFilter: 'all',
        maxTasks: 300,
        applyFilters: true
    },
    isLoadingProject: null // Added loading flag
};

// Elements cache
export const elements = {};

// Initialize elements when DOM is loaded
export function initializeElements() {
    elements.pageTitle = document.querySelector('h1');
    elements.criticalTasksTableBody = document.getElementById('criticalTasksTableBody');
    // Add other element initializations as needed
}

// Update page title
export function updatePageTitle() {
    if (elements.pageTitle) {
        if (state.currentProject) {
            elements.pageTitle.textContent = `Schedule Analytics (Project: ${state.currentProject})`;
        } else {
            elements.pageTitle.textContent = 'Schedule Analytics (No Project Selected)';
        }
    }
    
    // Also update the document title
    const projectName = state.currentProject || 'No Project Selected';
    document.title = `Schedule | ${projectName}`;
}

// Set loading state
export function setLoadingState(isLoading) {
    state.isLoadingProject = isLoading;
    // Add actual UI manipulation here if needed (e.g., show/hide spinner)
}

// Export loadProjects for use in schedule.js
export function loadProjects() {
    // Fetch projects from the API and populate the dropdown
    fetch('/api/projects')
        .then(response => response.json())
        .then(projects => {
            const projectFilter = document.getElementById('projectFilter');
            if (projectFilter) {
                // Clear existing options
                projectFilter.innerHTML = '';
                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Select a project...';
                projectFilter.appendChild(defaultOption);
                // Add project options
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.id || project.project_id;
                    option.textContent = project.name || project.project_name || option.value;
                    projectFilter.appendChild(option);
                });
            }
        })
        .catch(error => {
            console.error('Error loading projects:', error);
        });
}

// Set active tab
export function setActiveTab(tabId) {
    state.activeTab = tabId;
    // You could also save this to localStorage if needed
    // localStorage.setItem('activeTab', tabId);
}

// Get active tab
export function getActiveTab() {
    return state.activeTab;
} 