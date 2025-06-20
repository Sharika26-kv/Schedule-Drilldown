// tabHandler.js - Handles tab switching functionality
import { state, setActiveTab as updateStateActiveTab } from './state.js';
import { populateCriticalTasksTable, renderCriticalPathTimeline } from './criticalPath.js';
import { createFloatHistogram, analyzeFloatDistribution } from './floatAnalysis.js';

/**
 * Initializes the tab functionality
 */
export function initializeTabs() {
    // Get tab buttons
    const ganttTabBtn = document.getElementById('ganttTabBtn');
    const criticalPathTabBtn = document.getElementById('criticalPathTabBtn');
    const floatAnalysisTabBtn = document.getElementById('floatAnalysisTabBtn');
    
    // Get tab panels
    const ganttTabPanel = document.getElementById('ganttTabPanel');
    const criticalPathTabPanel = document.getElementById('criticalPathTabPanel');
    const floatAnalysisTabPanel = document.getElementById('floatAnalysisTabPanel');
    
    // Add click event listeners to tab buttons
    if (ganttTabBtn) {
        ganttTabBtn.addEventListener('click', () => {
            showTab('ganttTabPanel');
            setActiveTab(ganttTabBtn);
            updateStateActiveTab('gantt');
        });
    }
    
    if (criticalPathTabBtn) {
        criticalPathTabBtn.addEventListener('click', () => {
            showTab('criticalPathTabPanel');
            setActiveTab(criticalPathTabBtn);
            updateStateActiveTab('criticalPath');
            
            // Filter only critical tasks before passing to visualization
            const criticalTasks = (state.cpmResults || []).filter(task => task.isCritical);
            populateCriticalTasksTable(criticalTasks);
            renderCriticalPathTimeline(criticalTasks);

            // Populate WBS filter dropdown
            const cpWbsFilter = document.getElementById('cpWbsLevelFilter');
            if (cpWbsFilter && state.wbsHierarchy) {
                cpWbsFilter.innerHTML = '<option value="all">All Tasks</option>';
                
                // Get unique WBS Level 2 names from critical tasks
                const wbsLevel2Set = new Set();
                criticalTasks.forEach(task => {
                    if (task.wbs_path) {
                        const segments = task.wbs_path.split(' > ');
                        if (segments.length >= 2) {
                            wbsLevel2Set.add(segments[1]); // Level 2 WBS
                        }
                    }
                });

                // Add WBS Level 2 options to dropdown
                Array.from(wbsLevel2Set).sort().forEach(wbsLevel2 => {
                    const option = document.createElement('option');
                    option.value = wbsLevel2;
                    option.textContent = wbsLevel2;
                    cpWbsFilter.appendChild(option);
                });

                // Add event listener to filter table and visual
                cpWbsFilter.onchange = function() {
                    const selected = cpWbsFilter.value;
                    let filteredTasks = criticalTasks;
                    if (selected !== 'all') {
                        filteredTasks = criticalTasks.filter(task => {
                            if (task.wbs_path) {
                                const segments = task.wbs_path.split(' > ');
                                return segments[1] === selected;
                            }
                            return false;
                        });
                    }
                    populateCriticalTasksTable(filteredTasks);
                    renderCriticalPathTimeline(filteredTasks);
                };
            }
        });
    }
    
    if (floatAnalysisTabBtn) {
        floatAnalysisTabBtn.addEventListener('click', () => {
            showTab('floatAnalysisTabPanel');
            setActiveTab(floatAnalysisTabBtn);
            updateStateActiveTab('floatAnalysis');
            
            // Load float analysis data if a project is selected
            if (state.currentProject && state.lastGanttData) {
                createFloatHistogram(state.lastGanttData);
                analyzeFloatDistribution(state.lastGanttData);
            }
        });
    }
    
    // Initialize with the active tab from state
    initializeActiveTab();
}

/**
 * Initializes the active tab based on the current state
 */
function initializeActiveTab() {
    // Get the current active tab from state
    const activeTab = state.activeTab;
    
    // Set the active tab based on state
    switch (activeTab) {
        case 'criticalPath':
            showTab('criticalPathTabPanel');
            setActiveTab(document.getElementById('criticalPathTabBtn'));
            break;
        case 'floatAnalysis':
            showTab('floatAnalysisTabPanel');
            setActiveTab(document.getElementById('floatAnalysisTabBtn'));
            break;
        case 'gantt':
        default:
            showTab('ganttTabPanel');
            setActiveTab(document.getElementById('ganttTabBtn'));
            break;
    }
}

/**
 * Shows the specified tab panel and hides others
 * @param {string} tabPanelId - The ID of the tab panel to show
 */
export function showTab(tabPanelId) {
    // Hide all tab panels
    document.getElementById('ganttTabPanel').style.display = 'none';
    document.getElementById('criticalPathTabPanel').style.display = 'none';
    document.getElementById('floatAnalysisTabPanel').style.display = 'none';
    
    // Show the selected tab panel
    document.getElementById(tabPanelId).style.display = 'block';
}

/**
 * Sets the active tab button style
 * @param {HTMLElement} activeTabBtn - The active tab button element
 */
function setActiveTab(activeTabBtn) {
    // Remove active class from all tab buttons
    const allTabButtons = document.querySelectorAll('.tab-button');
    allTabButtons.forEach(btn => {
        btn.classList.remove('border-blue-600', 'text-blue-600');
        btn.classList.add('text-gray-500');
    });
    
    // Add active class to the clicked tab button
    activeTabBtn.classList.remove('text-gray-500');
    activeTabBtn.classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
} 