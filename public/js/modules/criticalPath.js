import { state, elements } from './state.js';
import { displayNoDataMessage } from './utils.js';

// Populate critical tasks table with sorting capabilities
export function populateCriticalTasksTable(criticalTasks) {
    if (!elements.criticalTasksTableBody) {
        console.error("[Critical Path Table] Table body element not found!");
        return;
    }

    const tableBody = elements.criticalTasksTableBody;
    tableBody.innerHTML = ""; // Clear existing content or loading message

    if (!criticalTasks || criticalTasks.length === 0) {
        displayNoDataMessage('criticalTasksTableBody', 'No critical tasks found for this project.', true);
        return;
    }
    


    // Helper to format dates
    const formatDateSimple = (dateStr) => {
        if (!dateStr) return "N/A";
        try {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
        } catch (e) { return "N/A"; }
    };

    criticalTasks.forEach(criticalTask => {
        const row = tableBody.insertRow();
        // Find corresponding full task details from Gantt data
        
        
        // Use data from criticalTask primarily, but enrich with ganttTask where needed
        const taskId = criticalTask.task_id || 'N/A';
        const taskName =  criticalTask.name || 'N/A';
        const startDate = (criticalTask.es !== undefined && criticalTask.es !== null) ? Math.round(criticalTask.es) : 'N/A';
        const endDate = (criticalTask.ef !== undefined && criticalTask.ef !== null) ? Math.round(criticalTask.ef) : 'N/A';
        const duration = criticalTask.duration !== undefined ? criticalTask.duration : 'N/A';
        const wbsPath = criticalTask.wbs_path || 'N/A (Not Found)';

        row.innerHTML = `
            <td class="px-3 py-2 whitespace-nowrap">${taskId}</td>
            <td class="px-3 py-2">${taskName}</td>
            <td class="px-3 py-2 whitespace-nowrap">${startDate}</td>
            <td class="px-3 py-2 whitespace-nowrap">${endDate}</td>
            <td class="px-3 py-2 text-right">${duration}</td>
            <td class="px-3 py-2">${wbsPath}</td> 
        `;
    });
}

// Filter critical tasks based on criteria
export function filterCriticalTasks(tasks, filters) {
    if (!tasks || !filters) return [];
    
    return tasks.filter(task => {
        // Apply date range filter
        if (filters.dateRangeFilter !== 'all') {
            const taskDate = new Date(task.start_date);
            const now = new Date();
            
            switch (filters.dateRangeFilter) {
                case 'next30':
                    const thirtyDaysFromNow = new Date(now.setDate(now.getDate() + 30));
                    if (taskDate > thirtyDaysFromNow) return false;
                    break;
                case 'next90':
                    const ninetyDaysFromNow = new Date(now.setDate(now.getDate() + 90));
                    if (taskDate > ninetyDaysFromNow) return false;
                    break;
                case 'custom':
                    if (filters.customDateStart && new Date(task.start_date) < new Date(filters.customDateStart)) return false;
                    if (filters.customDateEnd && new Date(task.start_date) > new Date(filters.customDateEnd)) return false;
                    break;
            }
        }
        
        // Apply status filter
        if (filters.statusFilter !== 'all') {
            if (filters.statusFilter === 'notComplete' && task.completed) return false;
            if (filters.statusFilter === 'complete' && !task.completed) return false;
        }
        
        // Apply WBS filter
        if (filters.wbsFilter !== 'all' && task.wbs_path) {
            if (!task.wbs_path.includes(filters.wbsFilter)) return false;
        }
        
        return true;
    }).slice(0, filters.maxTasks);
}

// Render a linear critical path timeline visualization
export function renderCriticalPathTimeline(criticalPath) {
    const containerId = 'criticalPathVisualization';
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!criticalPath || criticalPath.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center">No critical path data to visualize.</div>';
        return;
    }

    // Set up SVG dimensions
    const margin = { top: 40, right: 40, bottom: 60, left: 40 };
    const width = container.offsetWidth || 1200;
    const height = 220;
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // X scale: based on ES (or EF if ES missing)
    const minES = d3.min(criticalPath, d => d.es ?? d.ef ?? 0);
    const maxEF = d3.max(criticalPath, d => d.ef ?? d.es ?? 0);
    const xScale = d3.scaleLinear()
        .domain([minES, maxEF])
        .range([margin.left, width - margin.right]);

    // Node size scale: based on duration (min 12, max 36)
    const minDur = d3.min(criticalPath, d => d.duration ?? 0);
    const maxDur = d3.max(criticalPath, d => d.duration ?? 1);
    const rScale = d3.scaleSqrt()
        .domain([0, maxDur])
        .range([10, 32]);

    // Draw links (lines between nodes)
    svg.append('g')
        .selectAll('line')
        .data(d3.pairs(criticalPath))
        .enter()
        .append('line')
        .attr('x1', d => xScale(d[0].es ?? d[0].ef ?? 0))
        .attr('x2', d => xScale(d[1].es ?? d[1].ef ?? 0))
        .attr('y1', height / 2)
        .attr('y2', height / 2)
        .attr('stroke', '#b91c1c')
        .attr('stroke-width', 2);

    // Draw nodes (circles)
    svg.append('g')
        .selectAll('circle')
        .data(criticalPath)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.es ?? d.ef ?? 0))
        .attr('cy', height / 2)
        .attr('r', d => Math.max(rScale(d.duration ?? 0), 8))
        .attr('fill', '#ef4444')
        .attr('stroke', '#dc2626')
        .attr('stroke-width', 2)
        .append('title')
        .text(d => `Task: ${d.task_id}\nDuration: ${d.duration}`);

    // Draw node labels (task IDs)
    svg.append('g')
        .selectAll('text')
        .data(criticalPath)
        .enter()
        .append('text')
        .attr('x', d => xScale(d.es ?? d.ef ?? 0))
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#fff')
        .attr('pointer-events', 'none')
        .text(d => d.task_id);

    // Draw time axis
    const xAxis = d3.axisBottom(xScale)
        .ticks(8)
        .tickFormat(d3.format('d'));
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom + 20})`)
        .call(xAxis);
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height - 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('fill', '#374151')
        .text('Time (Hours, ES/EF)');
}

// Show loading indicator in critical path visualization
export function showCriticalPathLoading() {
    const container = document.getElementById('criticalPathVisualization');
    if (container) {
        container.innerHTML = '<div class="flex justify-center items-center h-40 text-gray-500">Loading Critical Path...</div>';
    }
}

// Show error message in critical path visualization
export function showCriticalPathError(message) {
    const container = document.getElementById('criticalPathVisualization');
    if (container) {
        container.innerHTML = `<div class="flex justify-center items-center h-40 text-red-500">${message}</div>`;
    }
} 