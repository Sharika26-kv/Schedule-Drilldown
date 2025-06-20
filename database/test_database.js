const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = 'C:/Users/kvsha/Desktop/New folder (3)/mydata.db';

console.log('Testing database connection...');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    console.log('✅ Database connected successfully');
    
    // Test if ActivityRelationshipView exists
    db.all("SELECT name FROM sqlite_master WHERE type='table' OR type='view'", [], (err, rows) => {
        if (err) {
            console.error('Error fetching tables/views:', err.message);
            return;
        }
        
        console.log('\n📋 Available tables and views:');
        rows.forEach((row) => {
            console.log('  -', row.name);
        });
        
        // Test ActivityRelationshipView
        console.log('\n🔍 Testing ActivityRelationshipView...');
        db.all("SELECT * FROM ActivityRelationshipView LIMIT 5", [], (err, rows) => {
            if (err) {
                console.error('❌ Error querying ActivityRelationshipView:', err.message);
            } else {
                console.log('✅ ActivityRelationshipView works! Found', rows.length, 'sample rows');
                if (rows.length > 0) {
                    console.log('📊 Sample columns:', Object.keys(rows[0]));
                }
            }
            
            // Test FinalKPI view
            console.log('\n🔍 Testing FinalKPI view...');
            db.all("SELECT * FROM FinalKPI LIMIT 3", [], (err, rows) => {
                if (err) {
                    console.error('❌ Error querying FinalKPI:', err.message);
                } else {
                    console.log('✅ FinalKPI works! Found', rows.length, 'sample rows');
                    if (rows.length > 0) {
                        console.log('📊 Sample columns:', Object.keys(rows[0]));
                    }
                }
                
                // Test leads query like in the API
                console.log('\n🧪 Testing leads query...');
                const testQuery = `
                    SELECT 
                        COUNT(CASE WHEN Lag < 0 AND Relationship_Status = 'Incomplete' THEN 1 END) as leads_count,
                        COUNT(CASE WHEN Relationship_Status = 'Incomplete' THEN 1 END) as remaining_count
                    FROM ActivityRelationshipView
                `;
                
                db.get(testQuery, [], (err, row) => {
                    if (err) {
                        console.error('❌ Error in leads test query:', err.message);
                    } else {
                        console.log('✅ Leads query works!');
                        console.log('   📈 Leads count:', row.leads_count);
                        console.log('   📈 Remaining count:', row.remaining_count);
                    }
                    
                    db.close();
                });
            });
        });
    });
}); 