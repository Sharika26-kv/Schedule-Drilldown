import { state } from './state.js';
import { showGanttLoading, showGanttError, findEarliestStartDate, findLatestEndDate } from './utils.js';

// Initialize Gantt chart
export function initializeGanttChart() {
    const ganttContainer = document.getElementById('d3GanttChart');
    if (!ganttContainer) {
        console.error('Gantt chart container not found');
        return;
    }

    // Clear existing content
    ganttContainer.innerHTML = '';
    
    // Create SVG element
    const svg = d3.select(ganttContainer)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', '0 0 1000 600')
        .attr('preserveAspectRatio', 'xMidYMid meet');

    return svg;
}

// Render Gantt chart
export function renderGanttChart(taskData) {
    console.log(`[D3 Gantt] Rendering ${taskData.length} tasks...`);
    
    // Get container dimensions
    const ganttContainer = document.getElementById("d3GanttChart");
    if (!ganttContainer) {
        console.error("[D3 Gantt] Container not found!");
        return;
    }
    
    // Clear existing content
    ganttContainer.innerHTML = "";
    
    // Handle no data case
    if (!taskData || taskData.length === 0) {
        ganttContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64">
                <div class="text-gray-500 text-xl mb-2">
                    <i class="fas fa-search mr-2"></i>No results
                </div>
                <p class="text-gray-700">No tasks to display for the selected period.</p>
            </div>
        `;
        return;
    }
    
    // Process tasks to add expanded/collapsed states if not already present
    taskData.forEach(task => {
        if (task.is_wbs && task.expanded === undefined) {
            // Default to expanded for level 1, collapsed for levels 2-4
            task.expanded = task.wbs_level === 0;
        }
    });
    
    // The child task filtering is now handled within createTaskHierarchyWithAggregation
    // We don't need to manually filter here as the hierarchy is already built correctly
    const visibleTasks = taskData;
    
    console.log(`[D3 Gantt] Filtered to ${visibleTasks.length} visible tasks`);
    
    // Get the available height from the viewport or parent container
    const viewportHeight = window.innerHeight; 
    const margin = {top: 40, right: 20, bottom: 40, left: 280}; // Increased left margin for task names
    const width = ganttContainer.clientWidth - margin.left - margin.right;
    
    // Calculate the available height
    const availableHeight = viewportHeight * 0.75;
    
    // Adjust row height to match the image
    const rowHeight = 24; // Set fixed row height for consistent appearance
    const rowPadding = 0.15; // Reduced padding for tighter layout
    
    // Calculate total height needed
    const height = visibleTasks.length * rowHeight;
    
    console.log(`[D3 Gantt] Using row height: ${rowHeight.toFixed(2)}px with padding ${rowPadding.toFixed(2)}`);
    
    // Fixed font size for uniform appearance
    const fontSize = 12;
    
    // Create SVG element with the calculated dimensions
    const svg = d3.select("#d3GanttChart")
        .append("svg")
        .attr("width", ganttContainer.clientWidth)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Create defs for clipping
    const defs = svg.append("defs");
    defs.append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", width)
        .attr("height", height);
    
    // Add pattern for progress bar
    defs.append("pattern")
        .attr("id", "progressPattern")
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 4)
        .attr("height", 4)
        .attr("patternTransform", "rotate(45)")
        .append("rect")
        .attr("width", 2)
        .attr("height", 4)
        .attr("fill", "#4299E1");
    
    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .extent([[0, 0], [width, height]])
        .on("zoom", zoomed);
    
    // Add zoom rect
    const zoomRect = svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .call(zoom);
    
    // Create main group for chart elements
    const chart = svg.append("g")
        .attr("class", "chart-content")
        .attr("clip-path", "url(#clip)");
    
    // Find min and max dates for the time scale
    let minDate = d3.min(taskData, d => {
        const date = d.start_date ? new Date(d.start_date) : null;
        return date && !isNaN(date.getTime()) ? date : null;
    });
    
    let maxDate = d3.max(taskData, d => {
        const date = d.end_date ? new Date(d.end_date) : null;
        return date && !isNaN(date.getTime()) ? date : null;
    });
    
    // Add buffer to both ends
    if (minDate && maxDate) {
        const timeRange = maxDate - minDate;
        minDate = new Date(minDate.getTime() - timeRange * 0.05);
        maxDate = new Date(maxDate.getTime() + timeRange * 0.05);
    } else {
        // Fallback if dates are not valid
        minDate = new Date();
        maxDate = new Date(minDate.getTime() + 30 * 24 * 60 * 60 * 1000); // Add 30 days
    }
    
    // Create time scale
    const timeScale = d3.scaleTime()
        .domain([minDate, maxDate])
        .range([0, width]);
    
    // Create task scale (y-axis) with dynamic padding
    const taskScale = d3.scaleBand()
        .domain(visibleTasks.map(d => d.task_id))
        .range([0, height])
        .padding(rowPadding);
    
    // Create axes
    const xAxis = d3.axisTop(timeScale)
        .tickFormat(d3.timeFormat("%d %b"))
        .tickSize(-height); // Make grid lines extend full height
    
    // Add x-axis at the top with grid lines
    const xAxisGroup = svg.append("g")
        .attr("class", "gantt-axis gantt-axis-x")
        .attr("transform", `translate(0, 0)`)
        .call(xAxis);
    
    // Style grid lines
    xAxisGroup.selectAll(".tick line")
        .attr("stroke", "#e5e7eb")
        .attr("stroke-dasharray", "2,2");
    
    // Style axis labels
    xAxisGroup.selectAll("text")
        .style("text-anchor", "middle")
        .style("font-size", "10px")
        .style("font-weight", "normal")
        .style("fill", "#6B7280");
    
    // Add light horizontal grid lines
    chart.append("g")
        .attr("class", "gantt-grid")
        .selectAll("line")
        .data(visibleTasks)
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", d => taskScale(d.task_id) + taskScale.bandwidth())
        .attr("y2", d => taskScale(d.task_id) + taskScale.bandwidth())
        .attr("stroke", "#f3f4f6")
        .attr("stroke-width", 1);
    
    // Add alternating row background colors
    chart.selectAll(".row-background")
        .data(visibleTasks)
        .enter()
        .append("rect")
        .attr("class", "row-background")
        .attr("x", 0)
        .attr("y", d => taskScale(d.task_id))
        .attr("width", width)
        .attr("height", taskScale.bandwidth())
        .attr("fill", (d, i) => i % 2 === 0 ? "#ffffff" : "#f9fafb")
        .attr("rx", 0)
        .attr("ry", 0);
    
    // Add task bars
    chart.selectAll(".gantt-task-bar")
        .data(visibleTasks.filter(d => {
            // Filter out tasks without valid dates
            const startDate = d.start_date ? new Date(d.start_date) : null;
            const endDate = d.end_date ? new Date(d.end_date) : null;
            return startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime());
        }))
        .enter()
        .append("rect")
        .attr("class", d => {
            let classes = "gantt-task-bar";
            if (d.target_drtn_hr_cnt === 0) classes += " gantt-milestone";
            else if (d.is_wbs && d.is_level1) classes += " gantt-level1";
            else if (d.is_wbs && d.is_level2) classes += " gantt-level2";
            else if (d.is_wbs && d.is_level3) classes += " gantt-level3";
            else if (d.is_wbs && d.is_level4) classes += " gantt-level4";
            else if (d.driving_path_flag === 'Y') classes += " gantt-critical";
            else classes += " gantt-task";
            return classes;
        })
        .attr("x", d => timeScale(new Date(d.start_date)))
        .attr("y", d => taskScale(d.task_id) + taskScale.bandwidth() * 0.2) // Adjusted to center bars
        .attr("width", d => {
            const startDate = new Date(d.start_date);
            const endDate = new Date(d.end_date);
            return Math.max(timeScale(endDate) - timeScale(startDate), d.target_drtn_hr_cnt === 0 ? 8 : 2);
        })
        .attr("height", taskScale.bandwidth() * 0.6) // Thinner bars
        .attr("rx", 2) // Rounded corners
        .attr("ry", 2)
        .attr("fill", d => {
            if (d.is_wbs && d.is_level1) return "#2563EB"; // Dark blue for WBS level 1
            else if (d.is_wbs && d.is_level2) return "#3B82F6"; // Medium blue for level 2
            else if (d.is_wbs && d.is_level3) return "#60A5FA"; // Lighter blue for level 3
            else if (d.is_wbs && d.is_level4) return "#93C5FD"; // Even lighter blue for level 4
            else if (d.driving_path_flag === 'Y') return "#DC2626"; // Red for critical path
            else return "#4299E1"; // Standard blue for regular tasks
        })
        .attr("stroke", d => {
            if (d.is_wbs && d.is_level1) return "#1E40AF"; // Darker blue border
            else if (d.is_wbs && d.is_level2) return "#1D4ED8"; 
            else if (d.is_wbs && d.is_level3) return "#2563EB";
            else if (d.is_wbs && d.is_level4) return "#3B82F6";
            else if (d.driving_path_flag === 'Y') return "#B91C1C"; // Darker red border
            else return "#2563EB"; // Standard blue border
        })
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("stroke-width", 2);
        })
        .on("mouseout", function(event, d) {
            d3.select(this)
                .attr("stroke-width", 1);
        })
        .on("click", function(event, d) {
            // Toggle expansion state for expandable items
            if (d.is_wbs && (d.is_level2 || d.is_level3 || d.is_level4)) {
                // Toggle expanded state
                toggleWbsExpansion(d.task_id, !d.expanded);
            }
        });
    
    // Calculate indent based on WBS level for task labels
    const getIndent = (d) => {
        if (d.is_wbs && d.is_level1) return 10;
        if (d.is_wbs && d.is_level2) return 25;
        if (d.is_wbs && d.is_level3) return 40;
        if (d.is_wbs && d.is_level4) return 55;
        
        // For tasks, indent based on parent level
        if (d.parent_level4) return 70;
        if (d.parent_level3) return 55;
        if (d.parent_level2) return 40;
        if (d.parent_level1) return 25;  // Added indentation for tasks under level 1
        return 15;
    };
    
    // Create custom y-axis with task labels
    const customYAxis = svg.append("g")
        .attr("class", "custom-y-axis")
        .attr("transform", `translate(0, 0)`);
    
    // Row background for labels area
    customYAxis.selectAll(".label-row-bg")
        .data(visibleTasks)
        .enter()
        .append("rect")
        .attr("class", "label-row-bg")
        .attr("x", -margin.left)
        .attr("y", d => taskScale(d.task_id))
        .attr("width", margin.left)
        .attr("height", taskScale.bandwidth())
        .attr("fill", (d, i) => i % 2 === 0 ? "#ffffff" : "#f9fafb");
    
    // Add task name labels
    customYAxis.selectAll(".task-label")
        .data(visibleTasks)
        .enter()
        .append("text")
        .attr("class", d => {
            if (d.is_wbs) return "wbs-label";
            else if (d.driving_path_flag === 'Y') return "critical-task-label";
            else return "task-label";
        })
        .attr("x", d => -margin.left + getIndent(d))
        .attr("y", d => taskScale(d.task_id) + taskScale.bandwidth() / 2)
        .attr("dominant-baseline", "middle")
        .attr("text-anchor", "start")
        .attr("font-size", d => d.is_wbs ? "12px" : "11px")
        .attr("font-weight", d => d.is_wbs ? "bold" : "normal")
        .attr("fill", d => {
            if (d.is_wbs) return "#1E40AF";
            else if (d.driving_path_flag === 'Y') return "#DC2626";
            else return "#374151";
        })
        .text(d => {
            let text = d.task_name || '';
            if (d.is_wbs && d.task_count) {
                text = `${text}`;
            }
            const maxLength = 32;
            return text.length > maxLength ? text.substring(0, maxLength-2) + '...' : text;
        })
        .append("title") // Add full name as tooltip
        .text(d => d.task_name);
    
    // Add WBS expand/collapse buttons
    customYAxis.selectAll(".expand-btn")
        .data(visibleTasks.filter(d => d.is_wbs && (d.is_level2 || d.is_level3 || d.is_level4)))
        .enter()
        .append("circle")
        .attr("class", "expand-btn")
        .attr("cx", d => -margin.left + getIndent(d) - 12)
        .attr("cy", d => taskScale(d.task_id) + taskScale.bandwidth() / 2)
        .attr("r", 6)
        .attr("fill", "#f3f4f6")
        .attr("stroke", "#d1d5db")
        .attr("stroke-width", 1)
        .attr("cursor", "pointer")
        .on("click", function(event, d) {
            // Toggle WBS expansion
            event.stopPropagation();
            toggleWbsExpansion(d.task_id, !d.expanded);
        });
    
    // Add +/- symbols to buttons
    customYAxis.selectAll(".expand-btn-symbol")
        .data(visibleTasks.filter(d => d.is_wbs && (d.is_level2 || d.is_level3 || d.is_level4)))
        .enter()
        .append("text")
        .attr("class", "expand-btn-symbol")
        .attr("x", d => -margin.left + getIndent(d) - 12)
        .attr("y", d => taskScale(d.task_id) + taskScale.bandwidth() / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", "10px")
        .attr("fill", "#6B7280")
        .attr("pointer-events", "none")
        .text(d => d.expanded ? "−" : "+");
    
    // Add task IDs in a column
    customYAxis.selectAll(".task-id")
        .data(visibleTasks.filter(d => !d.is_wbs)) // Only for tasks, not WBS items
        .enter()
        .append("text")
        .attr("class", "task-id")
        .attr("x", -margin.left + 5) // Fixed position at the start of label area
        .attr("y", d => taskScale(d.task_id) + taskScale.bandwidth() / 2)
        .attr("dominant-baseline", "middle")
        .attr("text-anchor", "start")
        .attr("font-size", "9px")
        .attr("fill", "#6B7280")
        .text(d => {
            // Extract actual ID or code from task_id
            const idMatch = d.task_id ? d.task_id.match(/\d+/) : null;
            return idMatch ? idMatch[0] : '';
        });
    
    // Add today line
    const today = new Date();
    if (today >= minDate && today <= maxDate) {
        chart.append("line")
            .attr("class", "today-line")
            .attr("x1", timeScale(today))
            .attr("x2", timeScale(today))
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "#EF4444")
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "5,3");
            
        // Add "Today" label
        chart.append("text")
            .attr("x", timeScale(today))
            .attr("y", 15)
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("fill", "#EF4444")
            .attr("font-weight", "bold")
            .text("Today");
    }
    
    // Add small date labels at the end of bars for better readability
    chart.selectAll(".date-label")
        .data(visibleTasks.filter(d => {
            // Only add date labels to expanded WBS items and critical tasks
            return (d.is_wbs && d.expanded) || d.driving_path_flag === 'Y';
        }))
        .enter()
        .append("text")
        .attr("class", "date-label")
        .attr("x", d => {
            const endDate = new Date(d.end_date);
            const x = timeScale(endDate);
            return isNaN(x) ? 0 : x + 5;
        })
        .attr("y", d => taskScale(d.task_id) + taskScale.bandwidth() / 2)
        .attr("dominant-baseline", "middle")
        .attr("font-size", "9px")
        .attr("fill", d => d.driving_path_flag === 'Y' ? "#DC2626" : "#6B7280")
        .text(d => {
            const endDate = new Date(d.end_date);
            return endDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
        });
    
    // Add legend
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - 280}, -30)`);
    
    const legendItems = [
        { label: "WBS", color: "#3B82F6" },
        { label: "Task", color: "#4299E1" },
        { label: "Critical Path", color: "#DC2626" },
        { label: "Milestone", shape: "diamond", color: "#4338CA" }
    ];
    
    legendItems.forEach((item, i) => {
        const g = legend.append("g")
            .attr("transform", `translate(${i * 80}, 0)`);
        
        if (item.shape === "diamond") {
            g.append("polygon")
                .attr("points", "0,4 4,0 8,4 4,8")
                .attr("transform", "translate(-4, 0)")
                .attr("fill", item.color);
        } else {
            g.append("rect")
                .attr("width", 12)
                .attr("height", 6)
                .attr("rx", 2)
                .attr("ry", 2)
                .attr("fill", item.color);
        }
        
        g.append("text")
            .attr("x", 15)
            .attr("y", 4)
            .attr("font-size", "9px")
            .attr("dominant-baseline", "middle")
            .text(item.label);
    });
    
    // Zoom function
    function zoomed(event) {
        chart.attr("transform", event.transform);
        
        // Update the axes with the new transform
        svg.select(".gantt-axis-x")
          .call(xAxis.scale(event.transform.rescaleX(timeScale)));
    }
    
    // Set the container height
    const totalHeight = height + margin.top + margin.bottom;
    const svgNode = d3.select("#d3GanttChart svg").node();
    if (svgNode) {
        svgNode.setAttribute("height", totalHeight);
        ganttContainer.style.height = totalHeight + "px";
    }
}

// Create time scale for Gantt chart
function createTimeScale(tasks, width) {
    const startDate = findEarliestStartDate(tasks);
    const endDate = findLatestEndDate(tasks);
    
    return d3.scaleTime()
        .domain([startDate, endDate])
        .range([0, width]);
}

// Create task scale for Gantt chart
function createTaskScale(tasks, height) {
    return d3.scaleBand()
        .domain(tasks.map(d => d.task_id))
        .range([0, height])
        .padding(0.1);
}

// Create axes for Gantt chart
function createAxes(svg, xScale, yScale, margin, width, height) {
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add X axis
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale));

    // Add Y axis
    g.append('g')
        .call(d3.axisLeft(yScale));
}

// Create task bars for Gantt chart
function createTaskBars(svg, tasks, xScale, yScale, margin) {
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    g.selectAll('.task-bar')
        .data(tasks)
        .enter()
        .append('rect')
        .attr('class', 'task-bar')
        .attr('x', d => xScale(new Date(d.start_date)))
        .attr('y', d => yScale(d.task_id))
        .attr('width', d => {
            const start = new Date(d.start_date);
            const end = new Date(d.end_date);
            return xScale(end) - xScale(start);
        })
        .attr('height', yScale.bandwidth())
        .attr('fill', d => d.completed ? '#4CAF50' : '#2196F3')
        .attr('rx', 3)
        .attr('ry', 3)
        .append('title')
        .text(d => `${d.task_name}\nStart: ${d.start_date}\nEnd: ${d.end_date}`);
}

// Update Gantt chart with new data
export function updateGanttChart(newTasks) {
    if (!newTasks) return;
    renderGanttChart(newTasks);
}

// Filter Gantt chart data
export function filterGanttData(tasks, filters) {
    if (!tasks || !filters) return tasks;
    
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
    });
}

// Helper to extract unique WBS levels from tasks
function extractWbsLevels(tasks) {
    const wbsSet = new Set();
    tasks.forEach(task => {
        if (task.wbs_path) {
            const segments = task.wbs_path.split(' > ');
            if (segments.length > 0) {
                wbsSet.add(segments[0]); // Level 1 WBS
            }
        }
    });
    return Array.from(wbsSet).sort();
}

// Helper to filter tasks for the next N days, including "All" option
function filterTasksByNextNDays(tasks, days = 14) {
    // If days is "all" or 0, return all tasks without filtering
    if (days === 'all' || days === 0 || !days) {
        return tasks;
    }
    
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return tasks.filter(task => {
        if (!task.start_date && !task.end_date) return false;
        const start = task.start_date ? new Date(task.start_date) : null;
        const finish = task.end_date ? new Date(task.end_date) : null;
        // Show if task starts or ends within the window, or is ongoing
        return (
            (start && start <= end && start >= now) ||
            (finish && finish >= now && finish <= end) ||
            (start && finish && start <= now && finish >= now)
        );
    });
}

// Populate Lookahead Period dropdown with "All" option as default
function populateLookaheadFilter() {
    const lookaheadFilter = document.getElementById('lookaheadPeriod');
    if (!lookaheadFilter) return;
    
    // Clear existing options
    lookaheadFilter.innerHTML = '';
    
    // Add "All" option first (default)
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Tasks';
    lookaheadFilter.appendChild(allOption);
    
    // Add other period options
    const periods = [
        { value: '7', text: 'Next 7 Days' },
        { value: '14', text: 'Next 14 Days' },
        { value: '30', text: 'Next 30 Days' },
        { value: '90', text: 'Next 90 Days' }
    ];
    
    periods.forEach(period => {
        const option = document.createElement('option');
        option.value = period.value;
        option.textContent = period.text;
        lookaheadFilter.appendChild(option);
    });
}

// Load Gantt data for a given project and render the chart
export function loadGanttData(projectId) {
    if (!projectId) return;
    showGanttLoading(true);
    
    // Populate lookahead filter
    populateLookaheadFilter();
    
    fetch(`/api/hierarchical-gantt?projectId=${projectId}`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch Gantt data');
            return response.json();
        })
        .then(data => {
            // Step 1: Store the original data
            state.lastGanttData = [...data];
            
            // Step 2: Extract and populate WBS levels (Level 2)
            const wbsLevels = extractLevel2WbsItems(data);
            populateWbsFilterDropdown(wbsLevels);
            
            // Step 3: Build WBS hierarchy
            state.wbsHierarchy = createWBSHierarchy(data);
            
            // Step 4: Build hierarchy and render (showing all tasks by default)
            const hierarchicalTasks = createTaskHierarchyWithAggregation(data, state.wbsHierarchy, state.expandedState);
            
            // Step 5: Store and render
            state.ganttData = hierarchicalTasks;
            renderGanttChart(hierarchicalTasks);
        })
        .catch(error => {
            showGanttError('Failed to load Gantt data');
            console.error(error);
        })
        .finally(() => {
            showGanttLoading(false);
        });
}

// --- Hierarchical Gantt Chart Logic (ported from original schedule.js) ---

// Create WBS hierarchy from tasks
function createWBSHierarchy(data) {
    const wbsHierarchy = {};
    data.forEach(task => {
        if (task.wbs_path) {
            const segments = task.wbs_path.split(' > ');
            let currentPath = '';
            segments.forEach((segment, index) => {
                currentPath = currentPath ? currentPath + ' > ' + segment : segment;
                if (!wbsHierarchy[currentPath]) {
                    wbsHierarchy[currentPath] = {
                        level: index,
                        name: segment,
                        path: currentPath,
                        expanded: index < 2, // Expand top two levels by default
                        tasks: [],
                        is_wbs: true
                    };
                }
            });
        }
    });
    return wbsHierarchy;
}

// Create hierarchical task structure with aggregation
function createTaskHierarchyWithAggregation(data, wbsHierarchy, expandedState = {}) {
    // Maps to store WBS items at each level
    const wbsLevel1Items = new Map();
    const wbsLevel2Items = new Map();
    const wbsLevel3Items = new Map();
    const wbsLevel4Items = new Map();

    // Get the expansion state from global state, or initialize it
    if (!expandedState) expandedState = {};

    // Process WBS structure to identify all WBS levels
    Object.entries(wbsHierarchy).forEach(([path, wbs]) => {
        const segments = path.split(' > ');
        const level = segments.length;
        if (level === 1) {
            // Level 1 WBS
            const taskId = "wbs_" + path.replace(/ > /g, "_");
            wbsLevel1Items.set(path, {
                ...wbs,
                children: [],
                allTasks: [],
                tasks: [],
                expanded: expandedState[taskId] !== undefined ? expandedState[taskId] : true,
                task_id: taskId
            });
        } else if (level === 2) {
            // Level 2 WBS
            const parentPath = segments[0];
            const taskId = "wbs_" + path.replace(/ > /g, "_");
            wbsLevel2Items.set(path, {
                ...wbs,
                parentPath,
                children: [],
                tasks: [],
                hasCriticalTasks: false,
                startDate: null,
                endDate: null,
                expanded: expandedState[taskId] !== undefined ? expandedState[taskId] : false,
                task_id: taskId
            });
            if (wbsLevel1Items.has(parentPath)) {
                wbsLevel1Items.get(parentPath).children.push(path);
            }
        } else if (level === 3) {
            // Level 3 WBS
            const parentPath = segments[0] + ' > ' + segments[1];
            const taskId = "wbs_" + path.replace(/ > /g, "_");
            wbsLevel3Items.set(path, {
                ...wbs,
                parentPath,
                children: [],
                tasks: [],
                hasCriticalTasks: false,
                startDate: null,
                endDate: null,
                expanded: expandedState[taskId] !== undefined ? expandedState[taskId] : false,
                task_id: taskId
            });
            if (wbsLevel2Items.has(parentPath)) {
                wbsLevel2Items.get(parentPath).children.push(path);
            }
        } else if (level === 4) {
            // Level 4 WBS
            const parentPath = segments[0] + ' > ' + segments[1] + ' > ' + segments[2];
            const taskId = "wbs_" + path.replace(/ > /g, "_");
            wbsLevel4Items.set(path, {
                ...wbs,
                parentPath,
                tasks: [],
                hasCriticalTasks: false,
                startDate: null,
                endDate: null,
                expanded: expandedState[taskId] !== undefined ? expandedState[taskId] : false,
                task_id: taskId
            });
            if (wbsLevel3Items.has(parentPath)) {
                wbsLevel3Items.get(parentPath).children.push(path);
            }
        }
    });

    // Group tasks by their WBS paths
    const tasksByWbsPath = new Map();
    data.forEach(task => {
        if (!task.wbs_path) return;
        if (!tasksByWbsPath.has(task.wbs_path)) {
            tasksByWbsPath.set(task.wbs_path, []);
        }
        tasksByWbsPath.get(task.wbs_path).push(task);
    });

    // Group tasks by their WBS paths and update the task WBS objects
    data.forEach(task => {
        if (!task.wbs_path) return;
        const segments = task.wbs_path.split(' > ');
        // Add tasks to level 1 WBS
        if (segments.length >= 1) {
            const level1Path = segments[0];
            if (wbsLevel1Items.has(level1Path)) {
                wbsLevel1Items.get(level1Path).allTasks.push(task);
            }
        }
        // Add tasks to appropriate level WBS based on path length
        if (segments.length === 1) {
            const level1Path = segments[0];
            if (wbsLevel1Items.has(level1Path)) {
                wbsLevel1Items.get(level1Path).tasks.push(task);
            }
        } else if (segments.length === 2) {
            const level2Path = segments[0] + ' > ' + segments[1];
            if (wbsLevel2Items.has(level2Path)) {
                const level2 = wbsLevel2Items.get(level2Path);
                level2.tasks.push(task);
                if (task.driving_path_flag === 'Y') {
                    level2.hasCriticalTasks = true;
                }
                if (task.start_date) {
                    const taskStartDate = new Date(task.start_date);
                    if (!level2.startDate || taskStartDate < level2.startDate) {
                        level2.startDate = taskStartDate;
                    }
                }
                if (task.end_date) {
                    const taskEndDate = new Date(task.end_date);
                    if (!level2.endDate || taskEndDate > level2.endDate) {
                        level2.endDate = taskEndDate;
                    }
                }
            }
        } else if (segments.length === 3) {
            const level3Path = segments[0] + ' > ' + segments[1] + ' > ' + segments[2];
            if (wbsLevel3Items.has(level3Path)) {
                const level3 = wbsLevel3Items.get(level3Path);
                level3.tasks.push(task);
                if (task.driving_path_flag === 'Y') {
                    level3.hasCriticalTasks = true;
                }
                if (task.start_date) {
                    const taskStartDate = new Date(task.start_date);
                    if (!level3.startDate || taskStartDate < level3.startDate) {
                        level3.startDate = taskStartDate;
                    }
                }
                if (task.end_date) {
                    const taskEndDate = new Date(task.end_date);
                    if (!level3.endDate || taskEndDate > level3.endDate) {
                        level3.endDate = taskEndDate;
                    }
                }
            }
        } else if (segments.length === 4) {
            const level4Path = segments[0] + ' > ' + segments[1] + ' > ' + segments[2] + ' > ' + segments[3];
            if (wbsLevel4Items.has(level4Path)) {
                const level4 = wbsLevel4Items.get(level4Path);
                level4.tasks.push(task);
                if (task.driving_path_flag === 'Y') {
                    level4.hasCriticalTasks = true;
                }
                if (task.start_date) {
                    const taskStartDate = new Date(task.start_date);
                    if (!level4.startDate || taskStartDate < level4.startDate) {
                        level4.startDate = taskStartDate;
                    }
                }
                if (task.end_date) {
                    const taskEndDate = new Date(task.end_date);
                    if (!level4.endDate || taskEndDate > level4.endDate) {
                        level4.endDate = taskEndDate;
                    }
                }
            }
        }
    });

    // Create a flat list for the final task hierarchy
    const hierarchicalTasks = [];
    wbsLevel1Items.forEach((wbs, path) => {
        hierarchicalTasks.push({
            task_id: "wbs_" + path.replace(/ > /g, "_"),
            task_name: wbs.name,
            wbs_path: path,
            wbs_level: 0,
            is_wbs: true,
            is_level1: true,
            expanded: wbs.expanded,
            start_date: wbs.startDate,
            end_date: wbs.endDate,
            child_paths: wbs.children,
            sort_key: path
        });
        if (wbs.expanded) {
            const tasksUnderWbs = tasksByWbsPath.get(path) || [];
            tasksUnderWbs.forEach(task => {
                hierarchicalTasks.push({
                    ...task,
                    is_wbs: false,
                    parent_level1: path,
                    sort_key: path + ">task_" + task.task_id
                });
            });
            const childPaths = wbs.children || [];
            childPaths.forEach(childPath => {
                if (wbsLevel2Items.has(childPath)) {
                    const wbs2 = wbsLevel2Items.get(childPath);
                    hierarchicalTasks.push({
                        task_id: "wbs_" + childPath.replace(/ > /g, "_"),
                        task_name: wbs2.name,
                        wbs_path: childPath,
                        wbs_level: 1,
                        is_wbs: true,
                        is_level2: true,
                        is_aggregated: true,
                        has_critical_tasks: wbs2.hasCriticalTasks,
                        expanded: wbs2.expanded,
                        task_count: wbs2.tasks.length,
                        start_date: wbs2.startDate,
                        end_date: wbs2.endDate,
                        aggregated_tasks: wbs2.tasks,
                        parent_path: wbs2.parentPath,
                        child_paths: wbs2.children,
                        sort_key: childPath
                    });
                    if (wbs2.expanded) {
                        const tasksUnderLevel2 = tasksByWbsPath.get(childPath) || [];
                        tasksUnderLevel2.forEach(task => {
                            hierarchicalTasks.push({
                                ...task,
                                is_wbs: false,
                                parent_level2: childPath,
                                sort_key: childPath + ">task_" + task.task_id
                            });
                        });
                        const level3ChildPaths = wbs2.children || [];
                        level3ChildPaths.forEach(level3Path => {
                            if (wbsLevel3Items.has(level3Path)) {
                                const wbs3 = wbsLevel3Items.get(level3Path);
                                hierarchicalTasks.push({
                                    task_id: "wbs_" + level3Path.replace(/ > /g, "_"),
                                    task_name: wbs3.name,
                                    wbs_path: level3Path,
                                    wbs_level: 2,
                                    is_wbs: true,
                                    is_level3: true,
                                    is_aggregated: true,
                                    has_critical_tasks: wbs3.hasCriticalTasks,
                                    expanded: wbs3.expanded,
                                    task_count: wbs3.tasks.length,
                                    start_date: wbs3.startDate,
                                    end_date: wbs3.endDate,
                                    aggregated_tasks: wbs3.tasks,
                                    parent_path: wbs3.parentPath,
                                    child_paths: wbs3.children,
                                    sort_key: level3Path
                                });
                                if (wbs3.expanded) {
                                    const tasksUnderLevel3 = tasksByWbsPath.get(level3Path) || [];
                                    tasksUnderLevel3.forEach(task => {
                                        hierarchicalTasks.push({
                                            ...task,
                                            is_wbs: false,
                                            parent_level3: level3Path,
                                            sort_key: level3Path + ">task_" + task.task_id
                                        });
                                    });
                                    const level4ChildPaths = wbs3.children || [];
                                    level4ChildPaths.forEach(level4Path => {
                                        if (wbsLevel4Items.has(level4Path)) {
                                            const wbs4 = wbsLevel4Items.get(level4Path);
                                            hierarchicalTasks.push({
                                                task_id: "wbs_" + level4Path.replace(/ > /g, "_"),
                                                task_name: wbs4.name,
                                                wbs_path: level4Path,
                                                wbs_level: 3,
                                                is_wbs: true,
                                                is_level4: true,
                                                is_aggregated: true,
                                                has_critical_tasks: wbs4.hasCriticalTasks,
                                                expanded: wbs4.expanded,
                                                task_count: wbs4.tasks.length,
                                                start_date: wbs4.startDate,
                                                end_date: wbs4.endDate,
                                                aggregated_tasks: wbs4.tasks,
                                                parent_path: wbs4.parentPath,
                                                sort_key: level4Path
                                            });
                                            if (wbs4.expanded) {
                                                const tasksUnderLevel4 = tasksByWbsPath.get(level4Path) || [];
                                                tasksUnderLevel4.forEach(task => {
                                                    hierarchicalTasks.push({
                                                        ...task,
                                                        is_wbs: false,
                                                        parent_level4: level4Path,
                                                        sort_key: level4Path + ">task_" + task.task_id
                                                    });
                                                });
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            });
        }
    });
    hierarchicalTasks.sort((a, b) => {
        if (!a.sort_key) return -1;
        if (!b.sort_key) return 1;
        return a.sort_key.localeCompare(b.sort_key);
    });
    return hierarchicalTasks;
}

// Toggle expansion of a WBS item and re-render
export function toggleWbsExpansion(taskId, newExpandedState) {
    console.log(`[D3 Gantt] Toggling WBS expansion: ${taskId}, new state: ${newExpandedState}`);
    
    // Get the expansion state from global state
    if (!state.expandedState) {
        state.expandedState = {};
    }
    
    // Update the expansion state
    state.expandedState[taskId] = newExpandedState;
    console.log('[D3 Gantt] Updated expanded states:', state.expandedState);
    
    if (state.lastGanttData && state.wbsHierarchy) {
        console.log('[D3 Gantt] Reprocessing data with updated expansion state');
        
        // Create a new processed data structure with the updated expansion state
        const hierarchicalTasks = createTaskHierarchyWithAggregation(state.lastGanttData, state.wbsHierarchy, state.expandedState);
        
        // Update the state
        state.ganttData = hierarchicalTasks;
        
        // Re-render the chart
        renderGanttChart(hierarchicalTasks);
    } else {
        console.error('[D3 Gantt] Cannot toggle expansion: missing original data or WBS hierarchy');
    }
}

// --- WBS Filter: Show Level 2 WBS Items ---
function extractLevel2WbsItems(tasks) {
    const wbsSet = new Set();
    tasks.forEach(task => {
        if (task.wbs_path) {
            const segments = task.wbs_path.split(' > ');
            if (segments.length >= 2) {
                wbsSet.add(segments[1]); // Level 2 WBS
            }
        }
    });
    return Array.from(wbsSet).sort();
}

function populateWbsFilterDropdown(wbsLevels) {
    const wbsFilter = document.getElementById('wbsLevelFilter');
    if (!wbsFilter) return;
    wbsFilter.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Tasks';
    wbsFilter.appendChild(allOption);
    wbsLevels.forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level;
        wbsFilter.appendChild(option);
    });
}

// ... rest of your helpers and filtering logic ... 