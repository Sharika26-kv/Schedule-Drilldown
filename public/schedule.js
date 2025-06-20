// Import modules
import { loadProjects } from './js/modules/state.js';
import { state, elements, initializeElements, updatePageTitle, setLoadingState } from './js/modules/state.js';
import { formatDate, displayNoDataMessage, showGanttLoading, showGanttError } from './js/modules/utils.js';
import { populateCriticalTasksTable, filterCriticalTasks, renderCriticalPathTimeline, showCriticalPathLoading, showCriticalPathError } from './js/modules/criticalPath.js';
import { createFloatHistogram, analyzeFloatDistribution } from './js/modules/floatAnalysis.js';
import { renderGanttChart, updateGanttChart, filterGanttData, loadGanttData } from './js/modules/gantt.js';
import { initializeTabs, showTab } from './js/modules/tabHandler.js';
import { AWP_LEVEL1_MAPPING, AWP_LEVEL2_MAPPING, AWP_LEVEL3_MAPPING, AWP_LEVEL4_MAPPING, AWP_LEVEL5_MAPPING, AWP_LEVEL6_MAPPING } from './config/awpMappings.js';

// Helper to filter only the critical path from CPM results
function getCriticalPathOnly(cpmResults) {
    return (cpmResults || []).filter(task => task.isCritical);
}

// Sequentially load Gantt and CPM data for a project
async function onProjectSelected(projectId) {
    showGanttLoading(true);
    showCriticalPathLoading();
    await loadGanttData(projectId); // Gantt first
    await fetchAndShowCriticalPath(projectId); // Then CPM
    showGanttLoading(false);
}

// Fetch CPM data for a project
async function fetchAndShowCriticalPath(projectId) {
    if (!projectId) return;
    showCriticalPathLoading();
    try {
        const response = await fetch(`/api/cpm/${projectId}`);
        const result = await response.json();
        if (result.success && result.data) {
            state.cpmResults = result.data;
            const criticalPath = getCriticalPathOnly(result.data);
            populateCriticalTasksTable(criticalPath);
            renderCriticalPathTimeline(criticalPath);
        } else {
            populateCriticalTasksTable([]);
            showCriticalPathError('No critical path data found.');
        }
    } catch (err) {
        console.error('Failed to fetch CPM data:', err);
        populateCriticalTasksTable([]);
        showCriticalPathError('Failed to load critical path data.');
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    updatePageTitle();
    setupEventListeners();
    loadProjects();
    initializeTabs(); // Initialize tab functionality
});

// Setup event listeners
function setupEventListeners() {
    const projectFilter = document.getElementById('projectFilter');
    if (projectFilter) {
        projectFilter.addEventListener('change', (e) => {
            const projectId = e.target.value;
            if (projectId) {
                state.currentProject = projectId;
                onProjectSelected(projectId);
            }
        });
    }
}

// Export functions that need to be accessed globally
window.updateGanttChart = updateGanttChart;
window.populateCriticalTasksTable = populateCriticalTasksTable;
window.createFloatHistogram = createFloatHistogram;
window.analyzeFloatDistribution = analyzeFloatDistribution;
window.filterGanttData = filterGanttData;
window.filterCriticalTasks = filterCriticalTasks;
window.setLoadingState = setLoadingState;
window.updatePageTitle = updatePageTitle;
window.fetchAndShowCriticalPath = fetchAndShowCriticalPath;

// Export state for debugging
window.state = state;