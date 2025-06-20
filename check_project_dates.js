const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('C:/Users/kvsha/Desktop/New folder (3)/mydata.db');

console.log('=== Project Table Structure ===');

// Get table structure
db.all("PRAGMA table_info(Project)", (err, columns) => {
    if (err) {
        console.error('Error getting table structure:', err.message);
    } else {
        console.log('Columns in Project table:');
        columns.forEach(col => {
            console.log(`- ${col.name} (${col.type})`);
        });
    }
    
    // Get sample data focusing on date columns
    console.log('\n=== Sample Project Data with Dates ===');
    db.all("SELECT proj_id, proj_short_name, last_recalc_date FROM Project LIMIT 5", (err, rows) => {
        if (err) {
            console.error('Error getting sample data:', err.message);
        } else {
            console.log('Sample project data:');
            rows.forEach((row, index) => {
                console.log(`Row ${index + 1}:`, row);
            });
        }
        
        // Check date format
        console.log('\n=== Date Analysis ===');
        db.all("SELECT DISTINCT last_recalc_date FROM Project ORDER BY last_recalc_date", (err, dates) => {
            if (err) {
                console.error('Error getting dates:', err.message);
            } else {
                console.log('All unique last_recalc_date values:');
                dates.forEach(dateRow => {
                    console.log(`- ${dateRow.last_recalc_date}`);
                });
            }
            
            db.close();
        });
    });
}); 