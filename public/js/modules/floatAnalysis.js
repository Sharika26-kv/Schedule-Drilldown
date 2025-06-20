import { state } from './state.js';
import { displayNoDataMessage } from './utils.js';

// Create float histogram
export function createFloatHistogram(tasks) {
    if (!tasks || tasks.length === 0) {
        displayNoDataMessage('floatHistogram', 'No float data available for analysis.');
        return;
    }

    // Destroy existing chart if it exists
    if (state.floatHistogramInstance) {
        state.floatHistogramInstance.destroy();
    }

    const ctx = document.getElementById('floatHistogram');
    if (!ctx) {
        console.error('Float histogram canvas not found');
        return;
    }

    // Calculate float ranges
    const floatRanges = calculateFloatRanges(tasks);
    
    // Create the histogram
    state.floatHistogramInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: floatRanges.labels,
            datasets: [{
                label: 'Number of Tasks',
                data: floatRanges.data,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Task Float Distribution'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Tasks: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Tasks'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Float Range (days)'
                    }
                }
            }
        }
    });
}

// Calculate float ranges for histogram
function calculateFloatRanges(tasks) {
    const ranges = {
        '0': 0,      // Critical path
        '1-3': 0,    // Very tight
        '4-7': 0,    // Tight
        '8-14': 0,   // Moderate
        '15-30': 0,  // Comfortable
        '>30': 0     // Very comfortable
    };

    tasks.forEach(task => {
        const float = task.total_float || 0;
        if (float === 0) ranges['0']++;
        else if (float <= 3) ranges['1-3']++;
        else if (float <= 7) ranges['4-7']++;
        else if (float <= 14) ranges['8-14']++;
        else if (float <= 30) ranges['15-30']++;
        else ranges['>30']++;
    });

    return {
        labels: Object.keys(ranges),
        data: Object.values(ranges)
    };
}

// Analyze float distribution
export function analyzeFloatDistribution(tasks) {
    if (!tasks || tasks.length === 0) return null;

    const criticalTasks = tasks.filter(task => task.total_float === 0).length;
    const tightFloatTasks = tasks.filter(task => task.total_float > 0 && task.total_float <= 7).length;
    const moderateFloatTasks = tasks.filter(task => task.total_float > 7 && task.total_float <= 30).length;
    const highFloatTasks = tasks.filter(task => task.total_float > 30).length;

    return {
        criticalTasks,
        tightFloatTasks,
        moderateFloatTasks,
        highFloatTasks,
        totalTasks: tasks.length
    };
} 