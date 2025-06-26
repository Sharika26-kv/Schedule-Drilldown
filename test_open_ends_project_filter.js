const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = 'C:/Users/kvsha/Desktop/New folder (3)/mydata.db';

// Connect to database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('[Test] Error connecting to database:', err.message);
        process.exit(1);
    }
    console.log('[Test] Connected to SQLite database');
});

async function testProjectFiltering() {
    console.log('\n=== Testing Open Ends Project Filtering ===\n');
    
    // Test 1: Get all projects available
    console.log('1. Available Projects:');
    const projects = await new Promise((resolve, reject) => {
        db.all(`SELECT DISTINCT ProjectID FROM ActivityAnalysisView ORDER BY ProjectID`, [], (err, rows) => {
            if (err) {
                console.error('Error:', err);
                resolve([]);
            } else {
                resolve(rows);
            }
        });
    });
    console.log('Projects found:', projects.map(p => p.ProjectID));
    
    // Test 2: Check total Open Ends across all projects
    console.log('\n2. Total Open Ends (All Projects):');
    const totalOpenEnds = await new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM ActivityAnalysisView WHERE OpenEnds = 'Open End'`, [], (err, row) => {
            if (err) {
                console.error('Error:', err);
                resolve({ count: 0 });
            } else {
                resolve(row);
            }
        });
    });
    console.log('Total Open Ends:', totalOpenEnds.count);
    
    // Test 3: Check Open Ends by project
    console.log('\n3. Open Ends by Project:');
    for (const project of projects) {
        const projectOpenEnds = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(*) as count,
                    COUNT(DISTINCT ActivityType) as activity_types
                FROM ActivityAnalysisView 
                WHERE OpenEnds = 'Open End' AND ProjectID = ?
            `, [project.ProjectID], (err, row) => {
                if (err) {
                    console.error('Error:', err);
                    resolve({ count: 0, activity_types: 0 });
                } else {
                    resolve(row);
                }
            });
        });
        console.log(`  Project ${project.ProjectID}: ${projectOpenEnds.count} open ends, ${projectOpenEnds.activity_types} activity types`);
    }
    
    // Test 4: Test the actual KPI query with project filter
    console.log('\n4. Testing KPI Query with Project Filter:');
    for (const project of projects.slice(0, 2)) { // Test first 2 projects
        console.log(`\n  Testing Project ${project.ProjectID}:`);
        
        // This is the exact query from the endpoint
        const kpiResult = await new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    COUNT(CASE WHEN OpenEnds = 'Open End' AND ProjectID = ? THEN 1 END) as OpenEnd_Count,
                    COUNT(CASE WHEN ActivityStatus <> 'Complete' AND ProjectID = ? THEN 1 END) as Remaining_Activities
                FROM ActivityAnalysisView
                WHERE ProjectID = ?
            `;
            
            db.get(query, [project.ProjectID, project.ProjectID, project.ProjectID], (err, row) => {
                if (err) {
                    console.error('Error:', err);
                    resolve({ OpenEnd_Count: 0, Remaining_Activities: 0 });
                } else {
                    resolve(row);
                }
            });
        });
        
        const percentage = kpiResult.Remaining_Activities > 0 ? 
            (kpiResult.OpenEnd_Count / kpiResult.Remaining_Activities) * 100 : 0;
            
        console.log(`    Open Ends: ${kpiResult.OpenEnd_Count}`);
        console.log(`    Remaining Activities: ${kpiResult.Remaining_Activities}`);
        console.log(`    Percentage: ${percentage.toFixed(4)}%`);
    }
    
    // Test 5: Test Activity Types by project
    console.log('\n5. Activity Types by Project:');
    for (const project of projects.slice(0, 2)) {
        const activityTypes = await new Promise((resolve, reject) => {
            db.all(`
                SELECT DISTINCT ActivityType as name
                FROM ActivityAnalysisView
                WHERE ActivityType IS NOT NULL AND ActivityType != '' AND ProjectID = ?
                ORDER BY ActivityType
            `, [project.ProjectID], (err, rows) => {
                if (err) {
                    console.error('Error:', err);
                    resolve([]);
                } else {
                    resolve(rows);
                }
            });
        });
        console.log(`  Project ${project.ProjectID}: ${activityTypes.map(t => t.name).join(', ')}`);
    }
    
    // Test 6: Test Activity Statuses by project
    console.log('\n6. Activity Statuses by Project:');
    for (const project of projects.slice(0, 2)) {
        const activityStatuses = await new Promise((resolve, reject) => {
            db.all(`
                SELECT DISTINCT ActivityStatus as name
                FROM ActivityAnalysisView
                WHERE ActivityStatus IS NOT NULL AND ActivityStatus != '' AND ProjectID = ?
                ORDER BY ActivityStatus
            `, [project.ProjectID], (err, rows) => {
                if (err) {
                    console.error('Error:', err);
                    resolve([]);
                } else {
                    resolve(rows);
                }
            });
        });
        console.log(`  Project ${project.ProjectID}: ${activityStatuses.map(s => s.name).join(', ')}`);
    }
}

// Run the test
testProjectFiltering().then(() => {
    console.log('\n=== Test Complete ===');
    db.close();
}).catch(err => {
    console.error('Test failed:', err);
    db.close();
}); 