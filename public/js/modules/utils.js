// Utility functions for the schedule application

// Format date to YYYY-MM-DD
export function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
}

// Find earliest start date from tasks
export function findEarliestStartDate(tasks) {
    if (!tasks || tasks.length === 0) return null;
    return new Date(Math.min(...tasks.map(task => new Date(task.start_date))));
}

// Find latest end date from tasks
export function findLatestEndDate(tasks) {
    if (!tasks || tasks.length === 0) return null;
    return new Date(Math.max(...tasks.map(task => new Date(task.end_date))));
}

// Display no data message
export function displayNoDataMessage(elementId, message, isTable = false) {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (isTable) {
        element.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500">${message}</td></tr>`;
    } else {
        element.innerHTML = `<div class="text-center py-4 text-gray-500">${message}</div>`;
    }
}

// Show loading state
export function showGanttLoading(show) {
    const loadingElement = document.getElementById('ganttLoading');
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
}

// Show error message
export function showGanttError(message) {
    const errorElement = document.getElementById('ganttError');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// AWP level helper functions
export function getAWPLevelGeneric(code, mapping) {
    if (!code) return 'Unknown';
    const level = code.split('.')[0];
    return mapping[level] || level;
}

// Project name extraction
export function getProjectName(taskCode) {
    if (!taskCode) return 'Unknown';
    const parts = taskCode.split('.');
    return parts[0] || 'Unknown';
}

// Process task code
export function processTaskCode(taskCode) {
    if (!taskCode) return { project: 'Unknown', wbs: 'Unknown' };
    const parts = taskCode.split('.');
    return {
        project: parts[0] || 'Unknown',
        wbs: parts.slice(1).join('.') || 'Unknown'
    };
} 