const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('C:/Users/kvsha/Desktop/New folder (3)/mydata.db');

console.log('=== FinalActivityKPIView Structure ===');

// Get view structure
db.all("PRAGMA table_info(FinalActivityKPIView)", (err, columns) => {
    if (err) {
        console.error('Error getting view structure:', err.message);
    } else {
        console.log('Columns in FinalActivityKPIView:');
        columns.forEach(col => {
            console.log(`- ${col.name} (${col.type})`);
        });
    }
    
    // Get sample data
    console.log('\n=== Sample Data ===');
    db.all("SELECT * FROM FinalActivityKPIView LIMIT 5", (err, rows) => {
        if (err) {
            console.error('Error getting sample data:', err.message);
        } else {
            console.log('Sample rows:');
            rows.forEach((row, index) => {
                console.log(`Row ${index + 1}:`, row);
            });
        }
        
        // Check for relationship percentage related columns
        console.log('\n=== Checking for Relationship Percentage Data ===');
        db.all("SELECT * FROM FinalActivityKPIView WHERE rowid <= 3", (err, rows) => {
            if (err) {
                console.error('Error:', err.message);
            } else {
                if (rows.length > 0) {
                    console.log('Available columns:', Object.keys(rows[0]));
                    
                    // Look for columns that might contain percentage data
                    const percentageColumns = Object.keys(rows[0]).filter(key => 
                        key.toLowerCase().includes('percent') || 
                        key.toLowerCase().includes('ratio') ||
                        key.toLowerCase().includes('relationship')
                    );
                    
                    if (percentageColumns.length > 0) {
                        console.log('Potential percentage columns:', percentageColumns);
                    } else {
                        console.log('No obvious percentage columns found');
                    }
                }
            }
            
            db.close();
        });
    });
}); 