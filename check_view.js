const sqlite3 = require('sqlite3').verbose();

const dbPath = 'C:/Users/kvsha/Desktop/New folder (3)/mydata.db';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        return;
    }
    console.log('Connected to SQLite database.');
});

// Check if ActivityAnalysisView exists
db.get("SELECT name FROM sqlite_master WHERE type='view' AND name='ActivityAnalysisView'", (err, row) => {
    if (err) {
        console.error('Error checking for ActivityAnalysisView:', err.message);
        db.close();
        return;
    }
    
    if (row) {
        console.log('✅ ActivityAnalysisView EXISTS in the database');
        
        // Get the view definition
        db.get("SELECT sql FROM sqlite_master WHERE type='view' AND name='ActivityAnalysisView'", (err, viewRow) => {
            if (err) {
                console.error('Error getting view definition:', err.message);
            } else {
                console.log('\n📋 View Definition:');
                console.log(viewRow.sql);
            }
            
            // Show columns
            db.all("PRAGMA table_info(ActivityAnalysisView)", (err, columns) => {
                if (err) {
                    console.error('Error getting columns:', err.message);
                } else {
                    console.log('\n📊 View Columns:');
                    columns.forEach(col => console.log(`- ${col.name} (${col.type})`));
                }
                
                // Show sample data
                db.all("SELECT * FROM ActivityAnalysisView LIMIT 5", (err, rows) => {
                    if (err) {
                        console.error('Error getting sample data:', err.message);
                    } else {
                        console.log('\n📊 Sample Data (first 5 rows):');
                        console.table(rows);
                    }
                    db.close();
                });
            });
        });
    } else {
        console.log('❌ ActivityAnalysisView does NOT exist in the database');
        
        // List available views
        db.all("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name", (err, rows) => {
            if (err) {
                console.error('Error listing views:', err.message);
            } else {
                console.log('\n📋 Available Views:');
                if (rows.length === 0) {
                    console.log('No views found in the database');
                } else {
                    rows.forEach(row => console.log(`- ${row.name}`));
                }
            }
            
            // Also list tables that might be similar
            db.all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%Activity%' ORDER BY name", (err, tables) => {
                if (err) {
                    console.error('Error listing activity tables:', err.message);
                } else {
                    console.log('\n📋 Available Activity-related Tables:');
                    if (tables.length === 0) {
                        console.log('No activity-related tables found');
                    } else {
                        tables.forEach(table => console.log(`- ${table.name}`));
                    }
                }
                db.close();
            });
        });
    }
}); 