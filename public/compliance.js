// --- AWP Mapping Data ---
const AWP_LEVEL1_MAPPING = { 
    'Admin': ['Admin'],
    'Colo01': ['Colo01', 'COLO1', 'Colo1'],
    'Colo02': ['Colo02', 'COLO2', 'Colo2'],
    'Colo03': ['Colo03', 'COLO3', 'Colo3'],
    'Colo04': ['Colo04', 'COLO4', 'Colo4'],
    'Colo05': ['Colo05', 'COLO5', 'Colo5']
};

const AWP_LEVEL2_MAPPING = { 
    'WT': ['Weather Tight', 'WT'],
    'L1': ['Commissioning Level 1 Red Tag', 'L1'],
    'L2': ['Commissioning Level 2 Yellow Tag', 'L2'],
    'L3': ['Commissioning Level 3 Green Tag', 'L3'],
    'L4': ['Commissioning Level 4 Blue Tag', 'L4'],
    'L5': ['Commissioning Level 5', 'System Test White Tag', 'L5'],
    'SC': ['Substantial Completion', 'SC']
};

const AWP_LEVEL3_MAPPING = { 
    'OA': ['Outside Area', 'OA'],
    'BD': ['Main Building', 'BD'],
    'CB': ['Central Utility Building', 'CB'],
    'CP': ['Central Utility Plant', 'CP'],
    'SS': ['Substation', 'SS'],
    'GN': ['Generator Yard', 'GN'],
    'FT': ['Fuel Tank Area', 'FT'],
    'WTA': ['Water Treatment Area', 'WTA']
};

const AWP_LEVEL4_MAPPING = { 
    'UG': ['Underground', 'UG'],
    'F1': ['First Level', 'F1'],
    'F2': ['Second Level', 'F2'],
    'F3': ['Third Level', 'F3'],
    'F4': ['Fourth Level', 'F4'],
    'F5': ['Fifth Level', 'F5'],
    'F6': ['Sixth Level', 'F6']
};

const AWP_LEVEL5_MAPPING = { 
    'CIV': ['Civil', 'CIV'],
    'STR': ['Structural', 'STR'],
    'ARC': ['Architecture', 'ARC'],
    'ELE': ['Electrical', 'ELE'],
    'MEC': ['Mechanical', 'MEC'],
    'PLB': ['Plumbing', 'PLB'],
    'TEL': ['Telecomm', 'TEL'],
    'FPR': ['Fire Protection', 'FPR'],
    'FAL': ['Fire Alarm', 'FAL'],
    'BAS': ['Building Automation', 'BAS'],
    'SEC': ['Security', 'SEC'],
    'LAN': ['Landscape', 'LAN'],
    'CXM': ['Commissioning', 'CXM']
};

const AWP_LEVEL6_MAPPING = { 
    'FDW': ['Foundation', 'FDW'],
    'SOG': ['Slab on Grade', 'SOG'],
    'EEP': ['Exterior Equipment', 'EEP'],
    'UDU': ['Underground Duct', 'UDU'],
    'UWU': ['Underground Wire', 'UWU'],
    'MSC': ['Miscellaneous', 'MSC'],
    'ENV': ['Envelope', 'ENV'],
    'EES': ['Exterior Equipment Support', 'EES'],
    'EFN': ['Exterior Finish', 'EFN'],
    'IFN': ['Interior Finish', 'IFN'],
    'ACT': ['Acoustical', 'ACT'],
    'HAC': ['Hot Aisle Containment', 'HAC'],
    'USI': ['Under Slab', 'USI'],
    'RGH': ['Rough-In', 'RGH'],
    'CTM': ['Cable Tray Main', 'CTM'],
    'CTD': ['Cable Tray Distribution', 'CTD'],
    'CPL': ['Cable Pulling', 'CPL'],
    'CTR': ['Cable Termination', 'CTR'],
    'ACC': ['Air Cooled Condenser', 'ACC'],
    'BTM': ['Basket Tray', 'BTM'],
    'DAS': ['Digital Antenna', 'DAS'],
    'NPF': ['Non-production Facility', 'NPF'],
    'PRF': ['Production Facility', 'PRF'],
    'INS': ['Installation', 'INS'],
    'L1R': ['Level 1 - Red Tag', 'L1R'],
    'L2I': ['Level 2 - Mechanical', 'L2I'],
    'L2P': ['Level 2 - Power', 'L2P'],
    'L2C': ['Level 2 - Controls', 'L2C'],
    'L2Y': ['Level 2 - Yellow Tag', 'L2Y'],
    'L3S': ['Level 3 - Safety', 'L3S'],
    'L3L': ['Level 3 - Load', 'L3L'],
    'L3B': ['Level 3 - Balance', 'L3B'],
    'L3E': ['Level 3 - Electrical', 'L3E'],
    'L3V': ['Level 3 - Verification', 'L3V'],
    'L3G': ['Level 3 - Green Tag', 'L3G'],
    'L4B': ['Level 4 - Blue Tag', 'L4B'],
    'L5W': ['Level 5 - White Tag', 'L5W']
};

// --- AWP Helper Functions ---

// Helper function to parse hierarchy path
function parseHierarchyPath(path) {
    if (!path) return null;
    
    // First try to split by '>'
    let segments = path.split('>').map(s => s.trim());
    
    // If we have a single segment, try splitting by '.'
    if (segments.length === 1) {
        segments = path.split('.').map(s => s.trim());
    }
    
    // For each segment, also split by '-' to handle hyphenated values
    segments = segments.flatMap(segment => {
        if (segment.includes('-')) {
            return segment.split('-').map(s => s.trim());
        }
        return segment;
    });
    
    return segments;
}

// Modified AWP level helper function
function getAWPLevelGeneric(code, mapping, activityData) {
    if (!code) return 'Unmapped';
    
    // First try to get from hierarchy path
    if (activityData && activityData.hierarchy_path) {
        const segments = parseHierarchyPath(activityData.hierarchy_path);
        if (segments && segments.length > 0) {
            // Check each segment against the mapping
            for (const [level, patterns] of Object.entries(mapping)) {
                if (!Array.isArray(patterns)) continue;
                
                for (const pattern of patterns) {
                    const upperPattern = String(pattern).toUpperCase();
                    if (segments.some(segment => segment.toUpperCase() === upperPattern)) {
                        return level;
                    }
                }
            }
        }
    }
    
    // If not found in hierarchy path, try actv_code_name
    if (activityData && activityData.actv_code_name) {
        const upperName = String(activityData.actv_code_name).toUpperCase();
        for (const [level, patterns] of Object.entries(mapping)) {
            if (!Array.isArray(patterns)) continue;
            for (const pattern of patterns) {
                const upperPattern = String(pattern).toUpperCase();
                if (upperName.includes(upperPattern)) {
                    return level;
                }
            }
        }
    }
    
    // If not found in actv_code_name, try short_name
    if (activityData && activityData.short_name) {
        const upperName = String(activityData.short_name).toUpperCase();
        for (const [level, patterns] of Object.entries(mapping)) {
            if (!Array.isArray(patterns)) continue;
            for (const pattern of patterns) {
                const upperPattern = String(pattern).toUpperCase();
                if (upperName === upperPattern) {
                    return level;
                }
            }
        }
    }
    
    // If not found in short_name, try task_name
    if (activityData && activityData.task_name) {
        const upperName = String(activityData.task_name).toUpperCase();
        for (const [level, patterns] of Object.entries(mapping)) {
            if (!Array.isArray(patterns)) continue;
            for (const pattern of patterns) {
                const upperPattern = String(pattern).toUpperCase();
                if (upperName.includes(upperPattern)) {
                    return level;
                }
            }
        }
    }
    
    // If still not found, try the original code
    const upperCode = String(code).toUpperCase();
    const segments = upperCode.split('-');
    
    for (const [level, patterns] of Object.entries(mapping)) {
        if (!Array.isArray(patterns)) continue;
        for (const pattern of patterns) {
            const upperPattern = String(pattern).toUpperCase();
            if (segments.some(segment => segment === upperPattern)) {
                return level;
            }
        }
    }
    
    return 'Unmapped';
}

// Update the level getter functions to pass activityData
function getAWPLevel1(code, activityData) { return getAWPLevelGeneric(code, AWP_LEVEL1_MAPPING, activityData); }
function getAWPLevel2(code, activityData) { return getAWPLevelGeneric(code, AWP_LEVEL2_MAPPING, activityData); }
function getAWPLevel3(code, activityData) { return getAWPLevelGeneric(code, AWP_LEVEL3_MAPPING, activityData); }
function getAWPLevel4(code, activityData) { return getAWPLevelGeneric(code, AWP_LEVEL4_MAPPING, activityData); }
function getAWPLevel5(code, activityData) { return getAWPLevelGeneric(code, AWP_LEVEL5_MAPPING, activityData); }
function getAWPLevel6(code, activityData) { return getAWPLevelGeneric(code, AWP_LEVEL6_MAPPING, activityData); }

function getProjectName(taskCode) {
    if (!taskCode) return 'Unmapped';
    const code = String(taskCode);
    
    // Updated regex with word boundaries to ensure we only match complete project codes
    // This will match patterns like "ABC12" or "XYZ5" but not "COLO1" in "COLO1-C2-GENROJ-9000"
    const projectNameRegex = /\b([a-zA-Z]{3})(\d{1,2})\b/;
    
    const match = code.match(projectNameRegex);
    if (match) {
        const letters = match[1].toUpperCase();
        let digits = match[2];
        if (digits.length === 1) digits = '0' + digits;
        return letters + digits;
    }
    return 'Unmapped';
}

// Helper function to validate project code format
function validateProjectCode(code) {
    if (!code) return 'PRJXX';
    
    // Check if code matches PRJXX format (3 letters followed by 2 digits)
    const projectRegex = /^[A-Z]{3}\d{2}$/;
    if (projectRegex.test(code.toUpperCase())) {
        return code.toUpperCase();
    }
    
    return 'PRJXX';
}

function processTaskCode(taskCode, activityData) {
    // Get project from activityData if available, otherwise from taskCode
    let proj = activityData && activityData.proj_short_name ? 
        activityData.proj_short_name : 
        (taskCode ? taskCode.split('-')[0] : 'PRJXX');
    
    // Validate and format project code
    proj = validateProjectCode(proj);
    
    const area = getAWPLevel1(taskCode, activityData);
    const divms = getAWPLevel2(taskCode, activityData);
    const cwb = 'CWB'; // Constant
    const areaCode = getAWPLevel3(taskCode, activityData);
    const floor = getAWPLevel4(taskCode, activityData);
    const discipline = getAWPLevel5(taskCode, activityData);
    const block = getAWPLevel6(taskCode, activityData);
    
    return {
        Project: proj,
        Area: area,
        DivMS: divms,
        CWB: cwb,
        AreaCode: areaCode,
        Floor: floor,
        Discipline: discipline,
        Block: block
    };
}

// --- NEW: AWP Helper Functions for Task Names (Substring Matching - Option A) ---

/**
 * Attempts to find an AWP level from a free-text name by checking
 * if any of the patterns (including descriptive text) are present
 * as substrings within the name. Case-insensitive.
 * WARNING: Prone to ambiguity and false positives.
 *
 * @param {string | null | undefined} name The task name string.
 * @param {object} mapping The AWP mapping object (e.g., AWP_LEVEL5_MAPPING).
 * @returns {string} The mapped level or 'Unmapped'.
 */
function getAWPLevelFromNameGeneric_SubString(name, mapping) {
    if (!name) return 'Unmapped';

    const upperName = String(name).toUpperCase();

    for (const [level, patterns] of Object.entries(mapping)) {
        if (!Array.isArray(patterns)) continue;

        for (const pattern of patterns) {
            // Check if the pattern string itself exists within the name
            const upperPattern = String(pattern).toUpperCase();
            // Simple substring check - prone to errors like 'CIV' in 'CIVILIAN'
            if (upperName.includes(upperPattern)) {
                // Found a match (could be ambiguous if multiple patterns match)
                // console.log(`Name match found: '${upperName}' includes '${upperPattern}' -> Level ${level}`); // Debugging
                return level;
            }
        }
    }

    return 'Unmapped';
}

// --- NEW: Wrappers for Substring Name Matching ---
function getAWPLevel1FromName_SubString(name) { return getAWPLevelFromNameGeneric_SubString(name, AWP_LEVEL1_MAPPING); }
function getAWPLevel2FromName_SubString(name) { return getAWPLevelFromNameGeneric_SubString(name, AWP_LEVEL2_MAPPING); }
function getAWPLevel3FromName_SubString(name) { return getAWPLevelFromNameGeneric_SubString(name, AWP_LEVEL3_MAPPING); }
function getAWPLevel4FromName_SubString(name) { return getAWPLevelFromNameGeneric_SubString(name, AWP_LEVEL4_MAPPING); }
function getAWPLevel5FromName_SubString(name) { return getAWPLevelFromNameGeneric_SubString(name, AWP_LEVEL5_MAPPING); }
function getAWPLevel6FromName_SubString(name) { return getAWPLevelFromNameGeneric_SubString(name, AWP_LEVEL6_MAPPING); }

// Test function to verify mapping behavior (will be removed in production)
// function testAWPMapping() {
//     console.log("Testing AWP mapping with exact segment matching:");
//     
//     // Test cases for Floor level (Level 4)
//     console.log("Floor level tests:");
//     console.log("IAD13-AD-TEL-EUG-20 => Floor:", getAWPLevel4("IAD13-AD-TEL-EUG-20")); // Should be "Unmapped", not "UG"
//     console.log("IAD13-AD-TEL-UG-20 => Floor:", getAWPLevel4("IAD13-AD-TEL-UG-20")); // Should be "UG"
//     console.log("IAD13-F1-TEL => Floor:", getAWPLevel4("IAD13-F1-TEL")); // Should be "F1"
//     
//     // Test cases for Discipline level (Level 5)
//     console.log("Discipline level tests:");
//     console.log("IAD13-AD-DCIV-20 => Discipline:", getAWPLevel5("IAD13-AD-DCIV-20")); // Should be "Unmapped", not "CIV"
//     console.log("IAD13-AD-CIV-20 => Discipline:", getAWPLevel5("IAD13-AD-CIV-20")); // Should be "CIV"
//     
//     // Test cases for Area level (Level 1)
//     console.log("Area level tests:");
//     console.log("COLO1-TEST => Area:", getAWPLevel1("COLO1-TEST")); // Should be "Colo01"
//     console.log("TESTCOLO1 => Area:", getAWPLevel1("TESTCOLO1")); // Should be "Unmapped"
// }

document.addEventListener('DOMContentLoaded', function() {
    // State for the compliance page
    const state = {
        complianceData: [],
        currentTableData: [], // Added: Data with AWP properties
        currentProject: localStorage.getItem('selectedProjectId') || null,
        projectId: localStorage.getItem('selectedProjectId') || null,
        projects: [],
        filterText: '', // For search functionality
        currentPage: 1, // For pagination
        rowsPerPage: 15, // For pagination
        currentRegex: null, // Store the current valid regex object
        validationPerformed: false, // Flag to track if validation has been done
        awpValidationPerformed: false, // Added: Flag for AWP validation
        // Added state for filters
        selectedStatus: 'all', 
        selectedValidation: 'all',
        selectedArea: '', // Added: Filter for Area
        selectedDivMS: '', // Added: Filter for DivMS
        selectedDiscipline: '' // Added: Filter for Discipline
    };

    // DOM elements specific to compliance page
    const elements = {
        activityTableBody: document.getElementById('activityTableBody'),
        projectFilter: document.getElementById('projectFilter'), // Assumed from shared header
        currentProjectIdDisplay: document.getElementById('currentProjectId'), // Assumed from shared header
        refreshProjectBtn: document.getElementById('refreshProjectBtn'), // Assumed from shared header
        searchInput: document.getElementById('complianceSearchInput'),
        filterBtn: document.getElementById('complianceFilterBtn'),
        itemsShowing: document.getElementById('complianceItemsShowing'),
        totalItems: document.getElementById('complianceTotalItems'),
        regexInput: document.getElementById('regexInput'),
        validateRegexBtn: document.getElementById('validateRegexBtn'),
        validateAWPButton: document.getElementById('validateAWPButton'), // Added: AWP validation button
        regexErrorMsg: document.getElementById('regexErrorMsg'),
        validationCountsDiv: document.getElementById('validationCounts'),
        passCountSpan: document.getElementById('passCount'),
        failCountSpan: document.getElementById('failCount'),
        // Filter dropdowns
        statusFilter: document.getElementById('statusFilter'),
        validationFilter: document.getElementById('validationFilter'),
        // Added AWP filter dropdowns
        areaFilter: document.getElementById('areaFilter'),
        divmsFilter: document.getElementById('divmsFilter'),
        disciplineFilter: document.getElementById('disciplineFilter')
    };

    // Initialize the compliance page
    initializeCompliancePage();

    // --- Event Listeners ---
    if (elements.projectFilter) {
        elements.projectFilter.addEventListener('change', function() {
            state.currentProject = this.value;
            state.projectId = this.value;
            localStorage.setItem('selectedProjectId', state.currentProject);
            state.validationPerformed = false; // Reset validation on project change
            state.awpValidationPerformed = false; // Reset AWP validation flag
            state.currentRegex = null;
            if(elements.regexInput) elements.regexInput.value = ''; // Clear regex input
            if(elements.regexErrorMsg) elements.regexErrorMsg.classList.add('hidden');
            if(elements.validationCountsDiv) elements.validationCountsDiv.classList.add('hidden'); // Hide counts
            updateProjectInfoDisplay();
            resetAWPFilters(); // Reset AWP filters when project changes
            loadComplianceData();
        });
    }

    if (elements.refreshProjectBtn) {
        elements.refreshProjectBtn.addEventListener('click', function() {
            state.currentProject = elements.projectFilter.value;
            state.projectId = elements.projectFilter.value;
            localStorage.setItem('selectedProjectId', state.currentProject);
            state.validationPerformed = false; // Reset validation
            state.awpValidationPerformed = false; // Reset AWP validation flag
            state.currentRegex = null;
            if(elements.regexInput) elements.regexInput.value = '';
            if(elements.regexErrorMsg) elements.regexErrorMsg.classList.add('hidden');
            if(elements.validationCountsDiv) elements.validationCountsDiv.classList.add('hidden'); // Hide counts
            resetAWPFilters(); // Reset AWP filters when reloading project
            loadComplianceData();
        });
    }

    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', function() {
            state.filterText = this.value.toLowerCase();
            // Render immediately on input change for better user experience
            renderComplianceTable(); 
        });
    }
    
    // Updated Filter Apply Button Listener
    if (elements.filterBtn) {
         elements.filterBtn.addEventListener('click', function() {
             // Update state from all filter inputs before rendering
             state.selectedStatus = elements.statusFilter ? elements.statusFilter.value : 'all';
             state.selectedValidation = elements.validationFilter ? elements.validationFilter.value : 'all';
             state.selectedArea = elements.areaFilter ? elements.areaFilter.value : '';
             state.selectedDivMS = elements.divmsFilter ? elements.divmsFilter.value : '';
             state.selectedDiscipline = elements.disciplineFilter ? elements.disciplineFilter.value : '';
             state.filterText = elements.searchInput ? elements.searchInput.value.toLowerCase() : '';
             renderComplianceTable(); 
         });
    }

    // Optional: Add listeners to dropdowns to filter immediately on change
     if (elements.statusFilter) {
         elements.statusFilter.addEventListener('change', function() {
             state.selectedStatus = this.value;
             renderComplianceTable();
         });
     }
     if (elements.validationFilter) {
         elements.validationFilter.addEventListener('change', function() {
             state.selectedValidation = this.value;
             renderComplianceTable();
         });
     }
     
     // Add AWP filter dropdown event listeners
     if (elements.areaFilter) {
         elements.areaFilter.addEventListener('change', function() {
             state.selectedArea = this.value;
             renderComplianceTable();
         });
     }
     if (elements.divmsFilter) {
         elements.divmsFilter.addEventListener('change', function() {
             state.selectedDivMS = this.value;
             renderComplianceTable();
         });
     }
     if (elements.disciplineFilter) {
         elements.disciplineFilter.addEventListener('change', function() {
             state.selectedDiscipline = this.value;
             renderComplianceTable();
         });
     }

    // Updated: Regex Validation Button Listener
    if (elements.validateRegexBtn) {
        elements.validateRegexBtn.addEventListener('click', function() {
            const examplePattern = elements.regexInput.value;
            
            elements.regexErrorMsg.classList.add('hidden');
            if(elements.validationCountsDiv) elements.validationCountsDiv.classList.add('hidden'); // Hide counts initially
            state.currentRegex = null;
            state.validationPerformed = false;

            if (!examplePattern) {
                 renderComplianceTable(); // Re-render to clear validation styles
                return;
            }

            try {
                state.currentRegex = generateRegexFromExample(examplePattern);

                if (state.currentRegex) {
                     state.validationPerformed = true; 
                     console.log("Validating with generated regex:", state.currentRegex);
                     // Show counts div after successful validation attempt
                     if(elements.validationCountsDiv) elements.validationCountsDiv.classList.remove('hidden'); 
                } else {
                    // Handle cases where generation failed (e.g., empty input passed somehow)
                     console.warn("Regex generation failed from example:", examplePattern);
                     elements.regexErrorMsg.textContent = `Could not generate a pattern from the example.`;
                     elements.regexErrorMsg.classList.remove('hidden');
                     if(elements.validationCountsDiv) elements.validationCountsDiv.classList.add('hidden'); // Hide counts on generation failure
                }
                renderComplianceTable(); // Re-render with new validation state
            } catch (e) {
                 // This catch block is less likely now, but kept as safety
                console.error("Error during regex generation/validation:", e);
                state.validationPerformed = false;
                state.currentRegex = null;
                elements.regexErrorMsg.textContent = `Error: ${e.message}`;
                elements.regexErrorMsg.classList.remove('hidden');
                if(elements.validationCountsDiv) elements.validationCountsDiv.classList.add('hidden'); // Hide counts on error
                renderComplianceTable();
            }
        });
    }

    // Added: Validate AWP Button Listener
    if (elements.validateAWPButton) {
        elements.validateAWPButton.addEventListener('click', validateAWPHandler);
    }

    // --- Data Loading Functions ---

    // Function to load projects (Adapted from schedule.js to handle mapping)
    function loadProjects() {
        return fetch('/api/database/projects')
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch projects');
                return response.json();
            })
            .then(data => {
                 if (!Array.isArray(data)) throw new Error("Project data is not an array");
                 
                 // Map backend data structure (proj_id, proj_name) to frontend (id, name)
                 // Also filter out any projects with null/undefined id
                 const projects = data.map(p => ({
                     id: p.proj_id,
                     name: p.proj_name || `Project ${p.proj_id}` // Provide fallback name
                 })).filter(p => p.id != null);
                 
                 state.projects = projects; // Store the mapped projects
                 console.log("[Project Load] Mapped projects:", projects.slice(0, 5));

                const storedProjectId = localStorage.getItem('selectedProjectId');
                const currentProjectIsValid = projects.some(p => p.id.toString() === storedProjectId);
                
                let projectToSelect = null;
                if (storedProjectId && currentProjectIsValid) {
                    projectToSelect = storedProjectId;
                } else if (projects.length > 0) {
                    projectToSelect = projects[0].id;
                } else {
                    projectToSelect = null; 
                }

                state.currentProject = projectToSelect;
                state.projectId = projectToSelect; // Keep projectId state consistent
                if (state.currentProject) {
                    localStorage.setItem('selectedProjectId', state.currentProject);
                } else {
                    localStorage.removeItem('selectedProjectId');
                }
                
                populateProjectFilter(); // Call with no args, uses state.projects
            })
            .catch(error => {
                console.error('Error fetching projects:', error);
                state.projects = []; // Clear projects on error
                state.currentProject = null;
                state.projectId = null;
                populateProjectFilter(); // Update filter to show error/empty state
                 alert("Could not load project list.");
                throw error; // Re-throw for initializeCompliancePage catch block
            });
    }

    // Function to populate project filter (Adapted from schedule.js)
    function populateProjectFilter() {
        if (!elements.projectFilter) return;
        elements.projectFilter.innerHTML = '';
        // Use state.projects which has the mapped {id, name} structure
        if (state.projects.length === 0) {
            const option = document.createElement('option');
            option.textContent = "No projects available";
            option.disabled = true;
            elements.projectFilter.appendChild(option);
            elements.projectFilter.disabled = true;
             if(elements.refreshProjectBtn) elements.refreshProjectBtn.disabled = true;
        } else {
            state.projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id; // Use mapped id
                option.textContent = `${project.name} (ID: ${project.id})`; // Use mapped name and id
                elements.projectFilter.appendChild(option);
            });
            if (state.currentProject) {
                elements.projectFilter.value = state.currentProject;
            }
            elements.projectFilter.disabled = false;
            if(elements.refreshProjectBtn) elements.refreshProjectBtn.disabled = false;
        }
        updateProjectInfoDisplay();
    }

    // Update displayed project info 
    function updateProjectInfoDisplay() {
        if (elements.currentProjectIdDisplay) {
            // Use state.currentProject which holds the selected ID
            elements.currentProjectIdDisplay.textContent = state.currentProject || 'N/A';
        }
    }

    // Load Compliance Data (fetches TASK table for the project)
    function loadComplianceData() {
        if (!state.currentProject) {
            console.warn("No project selected for compliance data.");
            state.complianceData = [];
            state.currentTableData = []; // Added: Clear processed data too
            renderComplianceTable(); // Render empty table
            return;
        }
        console.log(`Loading compliance data for project: ${state.currentProject}`);
        setLoadingState(true);
        // Fetch TASK data - adjust endpoint/params if needed for compliance specifically
        fetch(`/api/database/table/TASK?proj_id=${state.currentProject}`, {
            cache: 'no-cache' // Add cache control header
        })
            .then(response => {
                if (!response.ok) {
                    // Log status for debugging non-2xx responses
                    console.error(`Fetch failed with status: ${response.status} ${response.statusText} for proj_id=${state.currentProject}`); 
                    throw new Error('Failed to fetch compliance task data');
                }
                return response.json();
            })
            .then(data => {
                console.log("Compliance data received (raw):", data);
                // Add initial validation status (null = not validated yet)
                state.complianceData = data.map(item => ({ ...item, validationStatus: null })); 
                // Initialize currentTableData with raw data
                state.currentTableData = JSON.parse(JSON.stringify(state.complianceData));
                state.awpValidationPerformed = false; // Reset AWP validation flag
                console.log("Compliance data processed (state.complianceData):", state.complianceData.slice(0, 5)); // Log first 5 items
                state.currentPage = 1; // Reset page on new data
                state.validationPerformed = false; // Reset validation state on new data load
                state.currentRegex = null;
                renderComplianceTable();
                setLoadingState(false);
            })
            .catch(error => {
                console.error('Error loading compliance data:', error);
                state.complianceData = [];
                state.currentTableData = [];
                renderComplianceTable(); // Render empty table with error message
                setLoadingState(false);
                alert(`Failed to load compliance activities: ${error.message}`);
            });
    }

    // --- Added: AWP Functions ---

    // Process task codes and extract AWP information
    function validateAWPHandler() {
        if (!state.complianceData || state.complianceData.length === 0) {
            console.warn("No compliance data loaded to perform AWP validation.");
            alert("Please load project data first.");
            return;
        }
        
        console.log("Performing AWP Validation with Fallback from Task Name...");
        setLoadingState(true); // Indicate processing
        
        try {
            let firstValidProject = null;

            // 1. Process data using Task Code, with fallback to Task Name
            state.currentTableData = state.complianceData.map(item => {
                const taskCode = item.TASK_CODE || item.task_code || null;
                const taskName = item.TASK_NAME || item.task_name || null;
                
                // Initial results from Task Code
                let awpResults = processTaskCode(taskCode, item);
                
                // Capture the first valid project name encountered (from code)
                if (!firstValidProject && awpResults.Project !== 'Unmapped') {
                    firstValidProject = awpResults.Project;
                }

                // Fallback logic for each AWP field using Task Name (if available)
                if (taskName) {
                    if (awpResults.Area === 'Unmapped') {
                        const fallbackArea = getAWPLevel1FromName_SubString(taskName);
                        if (fallbackArea !== 'Unmapped') awpResults.Area = fallbackArea;
                    }
                    if (awpResults.DivMS === 'Unmapped') {
                        const fallbackDivMS = getAWPLevel2FromName_SubString(taskName);
                        if (fallbackDivMS !== 'Unmapped') awpResults.DivMS = fallbackDivMS;
                    }
                    if (awpResults.AreaCode === 'Unmapped') {
                        const fallbackAreaCode = getAWPLevel3FromName_SubString(taskName);
                        if (fallbackAreaCode !== 'Unmapped') awpResults.AreaCode = fallbackAreaCode;
                    }
                    if (awpResults.Floor === 'Unmapped') {
                        const fallbackFloor = getAWPLevel4FromName_SubString(taskName);
                        if (fallbackFloor !== 'Unmapped') awpResults.Floor = fallbackFloor;
                    }
                    if (awpResults.Discipline === 'Unmapped') {
                        const fallbackDiscipline = getAWPLevel5FromName_SubString(taskName);
                        if (fallbackDiscipline !== 'Unmapped') awpResults.Discipline = fallbackDiscipline;
                    }
                    if (awpResults.Block === 'Unmapped') {
                        const fallbackBlock = getAWPLevel6FromName_SubString(taskName);
                        if (fallbackBlock !== 'Unmapped') awpResults.Block = fallbackBlock;
                    }
                }
                
                // Merge original item properties with potentially updated AWP results
                return { ...item, ...awpResults };
            });

            // 2. Fill Project gaps if a valid project name was found (from code)
            if (firstValidProject) {
                console.log(`Inferred project name for this dataset: ${firstValidProject}`);
                state.currentTableData.forEach(item => {
                    if (item.Project === 'Unmapped') {
                        item.Project = firstValidProject;
                    }
                });
            } else {
                console.warn("Could not infer a project name for this dataset. Some projects might remain 'Unmapped'.");
            }

            // 3. Generate Suggested Code String
            state.currentTableData.forEach(item => {
                const proj = item.Project === 'Unmapped' ? '***' : item.Project;
                const area = item.Area === 'Unmapped' ? '***' : item.Area;
                const divms = item.DivMS === 'Unmapped' ? '***' : item.DivMS;
                const cwb = item.CWB; // Always CWB
                const areaCode = item.AreaCode === 'Unmapped' ? '***' : item.AreaCode;
                const floor = item.Floor === 'Unmapped' ? '***' : item.Floor;
                const disc = item.Discipline === 'Unmapped' ? '***' : item.Discipline;
                const block = item.Block === 'Unmapped' ? '***' : item.Block;
                
                item.suggestedCode = `${proj}-${area}-${divms}-${cwb}-${areaCode}-${floor}-${disc}-${block}`;
            });
            
            state.awpValidationPerformed = true;
            console.log("AWP Validation complete (with fallback and suggested code generation).");

            // Add debug log to check if hierarchy_path exists after processing
            console.log("First item after AWP validation:", state.currentTableData[0]);
            console.log("Does first item have hierarchy_path?", state.currentTableData[0] && state.currentTableData[0].hierarchy_path ? "YES" : "NO");

            // Populate AWP filter dropdowns
            populateFilterOptions();
            
            // Re-render the table with the AWP data and suggested code
            renderComplianceTable();

            // Show the export button after validation
            const exportButton = document.getElementById('exportDataButton');
            if (exportButton) {
                exportButton.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Error during AWP validation:", error);
            alert("An error occurred during AWP validation. Check console for details.");
            state.awpValidationPerformed = false;
        } finally {
            setLoadingState(false);
        }
    }

    // Populate AWP filter dropdowns with unique values
    function populateFilterOptions() {
        // Only populate if AWP validation has been performed and data exists
        if (!state.awpValidationPerformed || !state.currentTableData || state.currentTableData.length === 0) {
            console.log("Skipping filter population: AWP not validated or no data.");
            return;
        }

        console.log("Populating AWP filter options...");
        
        // Helper to get unique, sorted, non-empty values
        const getUniqueValues = (key) => {
            return [...new Set(state.currentTableData.map(item => item[key]).filter(Boolean))]
                .sort((a, b) => String(a).localeCompare(String(b))); // Sort alphabetically
        };

        const uniqueAreas = getUniqueValues('Area');
        const uniqueDivMS = getUniqueValues('DivMS');
        const uniqueDisciplines = getUniqueValues('Discipline');

        // Helper to update a specific dropdown
        const updateOptions = (selectElement, options, currentSelection, allLabel) => {
            if (!selectElement) {
                console.warn(`Filter element not found`);
                return;
            }
            // Keep the default "All" option with the specific label
            selectElement.innerHTML = `<option value="">${allLabel}</option>`; 
            
            options.forEach(optionValue => {
                const option = document.createElement('option');
                option.value = optionValue;
                option.textContent = optionValue; 
                selectElement.appendChild(option);
            });

            // Restore previous selection if it still exists, otherwise default to "All"
            if (options.includes(currentSelection)) {
                selectElement.value = currentSelection;
            } else {
                selectElement.value = ""; // Default to 'All'
                // Update state if selection was reset
                if (selectElement === elements.areaFilter) state.selectedArea = '';
                if (selectElement === elements.divmsFilter) state.selectedDivMS = '';
                if (selectElement === elements.disciplineFilter) state.selectedDiscipline = '';
            }
            
            selectElement.disabled = options.length === 0; // Disable if no options besides "All"
        };

        updateOptions(elements.areaFilter, uniqueAreas, state.selectedArea, "All Areas");
        updateOptions(elements.divmsFilter, uniqueDivMS, state.selectedDivMS, "All Milestones");
        updateOptions(elements.disciplineFilter, uniqueDisciplines, state.selectedDiscipline, "All Disciplines");
        
        console.log("AWP filter options populated.");
    }

    // Reset AWP Filters
    function resetAWPFilters() {
        const resetSelect = (selectElement, allLabel) => {
            if (selectElement) {
                selectElement.innerHTML = `<option value="">${allLabel}</option>`;
                selectElement.value = "";
                selectElement.disabled = true;
            }
        };
        
        resetSelect(elements.areaFilter, "All Areas");
        resetSelect(elements.divmsFilter, "All Milestones");
        resetSelect(elements.disciplineFilter, "All Disciplines");
        
        state.selectedArea = '';
        state.selectedDivMS = '';
        state.selectedDiscipline = '';
    }

    // --- Helper Function: Generate Regex from Example ---
    function generateRegexFromExample(example) {
        if (!example) return null;

        let regexString = '^'; // Start anchor
        let currentCharType = null;
        let count = 0;

        function appendPattern() {
            if (count > 0) {
                if (currentCharType === 'alpha') {
                    regexString += `[a-zA-Z]{${count}}`;
                } else if (currentCharType === 'digit') {
                    regexString += `\\d{${count}}`; // Use double backslash for literal \d
                }
                count = 0;
            }
        }

        function escapeRegexChar(char) {
            return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        for (let i = 0; i < example.length; i++) {
            const char = example[i];
            let type = null;

            if (/[a-zA-Z]/.test(char)) {
                type = 'alpha';
            } else if (/\d/.test(char)) {
                type = 'digit';
            } else {
                type = 'other';
            }

            if (type === 'other') {
                appendPattern(); 
                regexString += escapeRegexChar(char);
                currentCharType = null;
            } else {
                if (type !== currentCharType) {
                    appendPattern(); 
                    currentCharType = type;
                }
                count++;
            }
        }

        appendPattern(); 
        // regexString += '$'; // End anchor - REMOVED to allow matching prefixes

        console.log("Generated Regex String:", regexString);
        try {
             return new RegExp(regexString);
        } catch (e) {
            console.error("Error creating regex from generated string:", e);
            return null; // Return null if generated string is somehow invalid
        }
    }

    // --- Added: Regenerate Suggested Code for a specific row --- 
    function regenerateSuggestedCodeForRow(rowIndex) {
        const item = state.currentTableData[rowIndex];
        if (!item) return;

        const proj = item.Project === 'Unmapped' ? '***' : item.Project;
        const area = item.Area === 'Unmapped' ? '***' : item.Area;
        const divms = item.DivMS === 'Unmapped' ? '***' : item.DivMS;
        const cwb = item.CWB; // Always CWB
        const areaCode = item.AreaCode === 'Unmapped' ? '***' : item.AreaCode;
        const floor = item.Floor === 'Unmapped' ? '***' : item.Floor;
        const disc = item.Discipline === 'Unmapped' ? '***' : item.Discipline;
        const block = item.Block === 'Unmapped' ? '***' : item.Block;
        
        item.suggestedCode = `${proj}-${area}-${divms}-${cwb}-${areaCode}-${floor}-${disc}-${block}`;
    }

    // --- Rendering Functions ---
    function renderComplianceTable() {
        if (!elements.activityTableBody) return;
        
        setLoadingState(true);
        elements.activityTableBody.innerHTML = ''; // Clear existing rows

        // Determine which data set to use based on AWP validation state
        let processedData = state.awpValidationPerformed ? [...state.currentTableData] : [...state.complianceData];
        let passCount = 0;
        let failCount = 0;

        // Apply Status Filter
        if (state.selectedStatus !== 'all') {
            processedData = processedData.filter(item => (item.STATUS_CODE || item.status_code) === state.selectedStatus);
        }

        // Apply Validation Filter
        if (state.selectedValidation !== 'all') {
            // Note: item.validationStatus is null if validation hasn't been performed
            const targetStatus = state.selectedValidation === 'not_validated' ? null : state.selectedValidation;
             processedData = processedData.filter(item => item.validationStatus === targetStatus);
        }

        // Apply AWP Filters (only if AWP validation has been performed)
        if (state.awpValidationPerformed) {
            if (state.selectedArea) {
                processedData = processedData.filter(item => item.Area === state.selectedArea);
            }
            if (state.selectedDivMS) {
                processedData = processedData.filter(item => item.DivMS === state.selectedDivMS);
            }
            if (state.selectedDiscipline) {
                processedData = processedData.filter(item => item.Discipline === state.selectedDiscipline);
            }
        }

        // Apply search filter (after other filters)
        if (state.filterText) {
            processedData = processedData.filter(item => {
                const searchFields = [
                    String(item.WBS_ID || item.wbs_id || ''),
                    String(item.TASK_NAME || item.task_name || ''),
                    String(item.TASK_CODE || item.task_code || ''),
                    String(item.STATUS_CODE || item.status_code || '')
                ];
                
                // Add AWP fields to search if AWP validation has been performed
                if (state.awpValidationPerformed) {
                    searchFields.push(
                        String(item.Project || ''),
                        String(item.Area || ''),
                        String(item.DivMS || ''),
                        String(item.AreaCode || ''),
                        String(item.Floor || ''),
                        String(item.Discipline || ''),
                        String(item.Block || '')
                    );
                }
                
                // Search across all fields
                return searchFields.some(field => field.toLowerCase().includes(state.filterText.toLowerCase()));
            });
        }

        // Apply regex validation (and counting) to the filtered data
        let validationLogic = (taskCode) => true; 
        
        if (state.validationPerformed && state.currentRegex instanceof RegExp) {
             validationLogic = (taskCode) => state.currentRegex.test(taskCode);
        } else if (!state.validationPerformed) {
             processedData.forEach(item => { item.validationStatus = null; });
        }
            
        passCount = 0;
        failCount = 0;
        // Apply validation logic and count passes/fails on the filtered data
        if (state.validationPerformed) {
            processedData.forEach(item => {
                const taskCode = String(item.TASK_CODE || item.task_code || '');
                
                if (state.currentRegex) {
                    const isValid = validationLogic(taskCode);
                    // Update validation status for the item
                    item.validationStatus = isValid ? 'pass' : 'fail'; 
                    if (isValid) passCount++;
                    else failCount++;
                } else {
                    item.validationStatus = null;
                }
            });

            // Sort the filtered data by validation status (fails first)
            processedData.sort((a, b) => {
                const statusA = a.validationStatus === 'fail' ? -1 : (a.validationStatus === 'pass' ? 1 : 0);
                const statusB = b.validationStatus === 'fail' ? -1 : (b.validationStatus === 'pass' ? 1 : 0);
                return statusA - statusB; 
            });
             
            // Update count displays
            if(elements.passCountSpan) elements.passCountSpan.textContent = passCount;
            if(elements.failCountSpan) elements.failCountSpan.textContent = failCount;
        } else {
            // Reset counts if validation isn't active
            if(elements.passCountSpan) elements.passCountSpan.textContent = '-';
            if(elements.failCountSpan) elements.failCountSpan.textContent = '-';
        }

        const totalFilteredItems = processedData.length;
        
        // Apply row limit (top 100)
        const paginatedData = processedData.slice(0, 100);

        // Update counts display
        if (elements.itemsShowing) elements.itemsShowing.textContent = paginatedData.length;
        if (elements.totalItems) elements.totalItems.textContent = totalFilteredItems;
        
        if (paginatedData.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 11; // Updated colspan for the new table structure (11 columns)
            cell.textContent = state.filterText ? 'No activities match your filter.' : 'No activities found for this project.';
            cell.className = 'px-6 py-4 text-center text-gray-500';
            row.appendChild(cell);
            elements.activityTableBody.appendChild(row);
        } else {
            console.log("Table input data:", processedData);
            paginatedData.forEach((item, rowIndex) => {
                try {
                    const row = document.createElement('tr');
                    row.className = 'hover:bg-gray-50';
                    row.dataset.rowIndex = rowIndex; 

                    if (item.validationStatus === 'pass') {
                        row.classList.add('regex-pass');
                    } else if (item.validationStatus === 'fail') {
                        row.classList.add('regex-fail');
                    }

                    const taskCode = item.TASK_CODE || item.task_code || '-';
                    const taskName = item.TASK_NAME || item.task_name || '-';
                    // Suggested code is now generated dynamically when needed

                    // --- Modified createCellDropdown ---
                    function createCellDropdown(value, options, fieldName, cellIndex) {
                        const cell = document.createElement('td');
                        // Apply left shift padding for columns after Task Name
                        const paddingClass = cellIndex > 1 ? 'pl-2 pr-6 py-4' : 'px-6 py-4'; 
                        cell.className = `${paddingClass} whitespace-nowrap text-sm text-gray-500`;
                        
                        // Always create dropdown if options exist (except for CWB maybe?)
                        // For Project, options is empty, so it will just display text.
                        if (options && options.length > 0) { 
                            const select = document.createElement('select');
                            select.className = 'text-sm border border-gray-300 rounded px-2 py-1 w-full';
                            select.dataset.rowIndex = rowIndex;
                            select.dataset.field = fieldName;

                            // Add the current value as the first, selected option, even if 'Unmapped'
                            // Or add a placeholder if value is falsy/Unmapped? Let's keep Unmapped selectable
                            let currentOptionExists = false;
                            const currentVal = value || 'Unmapped'; // Use 'Unmapped' if value is null/undefined

                            options.forEach(opt => {
                                const option = document.createElement('option');
                                option.value = opt;
                                option.textContent = opt;
                                if (opt === currentVal) {
                                    option.selected = true;
                                    currentOptionExists = true;
                                }
                                select.appendChild(option);
                            });

                            // If the current value wasn't in the standard options, add it and select it
                            // This handles cases where a value might exist but isn't a standard key
                            if (!currentOptionExists && value && value !== 'Unmapped') { 
                                const currentOpt = document.createElement('option');
                                currentOpt.value = value;
                                currentOpt.textContent = value + " (Current)"; // Indicate it was the original value
                                currentOpt.selected = true;
                                select.insertBefore(currentOpt, select.firstChild); // Add at the beginning
                            }
                            
                            // Add 'Unmapped' as an option if it wasn't the current value
                            if (currentVal !== 'Unmapped') {
                                 const unmappedOption = document.createElement('option');
                                 unmappedOption.value = 'Unmapped';
                                 unmappedOption.textContent = 'Unmapped';
                                 select.appendChild(unmappedOption);
                            }
                            
                            // Add change event listener
                            select.addEventListener('change', function() {
                                const newValue = this.value;
                                const rowIdx = parseInt(this.dataset.rowIndex);
                                const field = this.dataset.field;

                                if (!isNaN(rowIdx) && field && state.currentTableData[rowIdx]) {
                                    // Update the value in the state data
                                    state.currentTableData[rowIdx][field] = newValue;
                                    console.log(`Updated ${field} for row ${rowIdx} to ${newValue}`);

                                    // Regenerate the suggested code for this row in the state
                                    regenerateSuggestedCodeForRow(rowIdx);

                                    // Find the corresponding cell in the DOM for suggested code (assuming it's cell index 2)
                                    const suggestedCodeCell = row.cells[2]; // Index 2 is Suggested Code
                                    if (suggestedCodeCell) {
                                        suggestedCodeCell.textContent = state.currentTableData[rowIdx].suggestedCode;
                                    }
                                }
                            });
                            
                            cell.appendChild(select);
                        } else {
                            // Regular cell with text value (like Project, CWB)
                            cell.textContent = value;
                        }
                        
                        return cell;
                    }
                    
                    const areaOptions = Object.keys(AWP_LEVEL1_MAPPING);
                    const divMSOptions = Object.keys(AWP_LEVEL2_MAPPING);
                    const areaCodeOptions = Object.keys(AWP_LEVEL3_MAPPING);
                    const floorOptions = Object.keys(AWP_LEVEL4_MAPPING);
                    const disciplineOptions = Object.keys(AWP_LEVEL5_MAPPING);
                    const blockOptions = Object.keys(AWP_LEVEL6_MAPPING);

                    // Regenerate suggested code initially for display
                    regenerateSuggestedCodeForRow(rowIndex);
                    const initialSuggestedCode = item.suggestedCode || '-';

                    // DEBUG: Log the item to see its properties
                    console.log("Rendering row, hierarchy_path value =", item.hierarchy_path);
                    
                    // Create cells
                    const cells = [
                        document.createElement('td'), // Task Code
                        document.createElement('td'), // Task Name
                        document.createElement('td'), // Suggested Code
                        createCellDropdown(item.Project || '', [], 'Project', 3),
                        createCellDropdown(item.Area || 'Unmapped', areaOptions, 'Area', 4),
                        createCellDropdown(item.DivMS || 'Unmapped', divMSOptions, 'DivMS', 5),
                        createCellDropdown(item.CWB || 'CWB', [], 'CWB', 6), // No options for CWB
                        createCellDropdown(item.AreaCode || 'Unmapped', areaCodeOptions, 'AreaCode', 7),
                        createCellDropdown(item.Floor || 'Unmapped', floorOptions, 'Floor', 8),
                        createCellDropdown(item.Discipline || 'Unmapped', disciplineOptions, 'Discipline', 9),
                        createCellDropdown(item.Block || 'Unmapped', blockOptions, 'Block', 10)
                    ];
                    
                    // Set Task Code cell content
                    cells[0].className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium';
                    cells[0].textContent = taskCode;
                    
                    // Set Task Name cell content
                    cells[1].className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-700'; 
                    cells[1].textContent = taskName;

                    // Set Suggested Code cell content initially
                    cells[2].className = 'pl-2 pr-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono'; 
                    cells[2].textContent = initialSuggestedCode;
                    
                    // Append all cells to the row
                    cells.forEach(cell => row.appendChild(cell));
                    
                    // Add hierarchy path cell separately (ensuring it's always added)
                    const hierarchyCell = document.createElement('td');
                    hierarchyCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
                    hierarchyCell.textContent = item.hierarchy_path || '-'; 
                    row.appendChild(hierarchyCell);
                    
                    elements.activityTableBody.appendChild(row);
                } catch (error) {
                    console.error("Error rendering table row for item:", item, error);
                }
            });
        }
        setLoadingState(false);
    }
    
    function setLoadingState(isLoading) {
        const tableBody = elements.activityTableBody;
        if (!tableBody) return;

        if (isLoading) {
            tableBody.innerHTML = `<tr><td colspan="11" class="px-6 py-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Loading data...</td></tr>`; // Updated colspan
            if(elements.itemsShowing) elements.itemsShowing.textContent = 0;
            if(elements.totalItems) elements.totalItems.textContent = 0;
        } 
    }

    // --- Initialization ---
    function initializeCompliancePage() {
        console.log("Initializing Compliance Page");
        loadProjects()
            .then(() => {
                loadComplianceData();
            })
            .catch(error => {
                console.error("Initialization failed for Compliance page:", error);
                // Handle initialization error (e.g., show message to user)
            });
    }

    // Function to export data to CSV
    function exportToCSV() {
        // Get the table body
        const tableBody = document.getElementById('activityTableBody');
        if (!tableBody) {
            console.error('Table body not found');
            return;
        }

        // Get all rows from the table
        const rows = tableBody.getElementsByTagName('tr');
        if (rows.length === 0) {
            console.error('No data to export');
            return;
        }

        // Prepare CSV content
        let csvContent = 'Task Code,Task Name,Suggested Code,Project\n';

        // Process each row (limit to 100 records)
        const maxRecords = Math.min(rows.length, 100);
        for (let i = 0; i < maxRecords; i++) {
            const row = rows[i];
            const cells = row.getElementsByTagName('td');
            
            // Skip if row doesn't have enough cells
            if (cells.length < 4) continue;

            // Get the required columns
            const taskCode = cells[0].textContent.trim();
            const taskName = cells[1].textContent.trim();
            const suggestedCode = cells[2].textContent.trim();
            const project = cells[3].textContent.trim();

            // Escape fields that might contain commas
            const escapedTaskName = `"${taskName.replace(/"/g, '""')}"`;
            
            // Add row to CSV
            csvContent += `${taskCode},${escapedTaskName},${suggestedCode},${project}\n`;
        }

        // Create blob and download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `compliance_export_${timestamp}.csv`;
        
        // Set up download
        if (navigator.msSaveBlob) { // For IE
            navigator.msSaveBlob(blob, filename);
        } else {
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // Add event listener for export button
    const exportButton = document.getElementById('exportDataButton');
    if (exportButton) {
        exportButton.addEventListener('click', exportToCSV);
    }
}); 