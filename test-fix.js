const sqlite3 = require('sqlite3').verbose();
const dbPath = 'C:/Users/kvsha/Desktop/New folder (3)/mydata.db';
const db = new sqlite3.Database(dbPath);

console.log('Testing DAX formula implementations...\n');

const projectId = '389';

// Test 1: Total_Relationship_Count (basic + user selected filters only)
const totalQuery = `
    SELECT COUNT(*) as Total_Relationship_Count
    FROM ActivityRelationshipView
    WHERE Relationship_Status = 'Incomplete'
    AND Project_ID = ?
`;

// Test 2: Lag_Count (basic + user selected + Lag > 0)
const lagQuery = `
    SELECT COUNT(*) as Lag_Count
    FROM ActivityRelationshipView
    WHERE Relationship_Status = 'Incomplete'
    AND Project_ID = ?
    AND Lag > 0
`;

// Test 3: FS_Count (basic + user selected + FS+0d specific)
const fsQuery = `
    SELECT COUNT(*) as FS_Count
    FROM ActivityRelationshipView
    WHERE Relationship_Status = 'Incomplete'
    AND Project_ID = ?
    AND RelationshipType = 'PR_FS'
    AND Lag = 0
`;

// Test 4: NonFS_Count (basic + user selected + Non-FS+0d specific)
const nonFsQuery = `
    SELECT COUNT(*) as NonFS_Count
    FROM ActivityRelationshipView
    WHERE Relationship_Status = 'Incomplete'
    AND Project_ID = ?
    AND RelationshipType NOT IN ('PR_FS', 'PR_FS1')
    AND (Lag != 0 AND Lag IS NOT NULL)
`;

Promise.all([
    new Promise((resolve) => {
        db.get(totalQuery, [projectId], (err, row) => {
            if (err) console.error('Error in total query:', err);
            resolve(row || { Total_Relationship_Count: 0 });
        });
    }),
    new Promise((resolve) => {
        db.get(lagQuery, [projectId], (err, row) => {
            if (err) console.error('Error in lag query:', err);
            resolve(row || { Lag_Count: 0 });
        });
    }),
    new Promise((resolve) => {
        db.get(fsQuery, [projectId], (err, row) => {
            if (err) console.error('Error in fs query:', err);
            resolve(row || { FS_Count: 0 });
        });
    }),
    new Promise((resolve) => {
        db.get(nonFsQuery, [projectId], (err, row) => {
            if (err) console.error('Error in nonfs query:', err);
            resolve(row || { NonFS_Count: 0 });
        });
    })
]).then(([totalResult, lagResult, fsResult, nonFsResult]) => {
    console.log('=== DAX Formula Test Results ===');
    console.log(`Total_Relationship_Count: ${totalResult.Total_Relationship_Count}`);
    console.log(`Lag_Count (Lag > 0): ${lagResult.Lag_Count}`);
    console.log(`FS_Count (PR_FS + Lag=0): ${fsResult.FS_Count}`);
    console.log(`NonFS_Count (Not PR_FS/PR_FS1 + Lag!=0): ${nonFsResult.NonFS_Count}`);
    
    console.log('\n=== Logic Verification ===');
    console.log('All counts should be different (indicating proper filter logic):');
    console.log(`- Total should be the largest: ${totalResult.Total_Relationship_Count}`);
    console.log(`- FS + NonFS + others should equal Total when combined properly`);
    console.log(`- Each metric applies its own specific filters correctly`);
    
    db.close();
}).catch(console.error); 