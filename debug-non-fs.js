const sqlite3 = require('sqlite3').verbose();

const dbPath = 'C:/Users/kvsha/Desktop/New folder (3)/mydata.db';
const db = new sqlite3.Database(dbPath);

console.log('Checking database structure...\n');

// First, let's see what tables exist
db.all("SELECT name FROM sqlite_master WHERE type='table' OR type='view'", (err, tables) => {
    if (err) {
        console.error('Error getting tables:', err);
        return;
    }
    
    console.log('Available tables and views:', tables.map(t => t.name));
    
    // Check if ActivityRelationshipView exists
    const hasActivityView = tables.some(t => t.name === 'ActivityRelationshipView');
    
    if (hasActivityView) {
        console.log('\n✅ ActivityRelationshipView found! Testing Non-FS+0d queries...\n');
        
        const projectId = '389';
        
        // Test 1: Basic Non-FS+0d count
        const basicQuery = `
            SELECT COUNT(*) as count
            FROM ActivityRelationshipView
            WHERE Relationship_Status = 'Incomplete'
            AND Project_ID = ?
            AND RelationshipType NOT IN ('PR_FS', 'PR_FS1')
            AND (Lag != 0 AND Lag IS NOT NULL)
        `;
        
        db.get(basicQuery, [projectId], (err, row) => {
            if (err) {
                console.error('Error in basic query:', err);
            } else {
                console.log('Basic Non-FS+0d count:', row.count);
            }
            
            // Test 2: Check relationship types
            const typesQuery = `
                SELECT RelationshipType, COUNT(*) as count
                FROM ActivityRelationshipView
                WHERE Relationship_Status = 'Incomplete'
                AND Project_ID = ?
                GROUP BY RelationshipType
                ORDER BY count DESC
            `;
            
            db.all(typesQuery, [projectId], (err, rows) => {
                if (err) {
                    console.error('Error in types query:', err);
                } else {
                    console.log('\nRelationship types in project 389:', rows);
                }
                
                // Test 3: Sample data
                const sampleQuery = `
                    SELECT RelationshipType, Lag, Relationship_Status, Project_ID
                    FROM ActivityRelationshipView
                    WHERE Relationship_Status = 'Incomplete'
                    AND Project_ID = ?
                    LIMIT 10
                `;
                
                db.all(sampleQuery, [projectId], (err, rows) => {
                    if (err) {
                        console.error('Error in sample query:', err);
                    } else {
                        console.log('\nSample data from project 389:', rows);
                    }
                    
                    db.close();
                });
            });
        });
    } else {
        console.log('❌ ActivityRelationshipView not found!');
        db.close();
    }
}); 