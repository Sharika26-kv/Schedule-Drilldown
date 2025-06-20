const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('C:/Users/kvsha/Desktop/New folder (3)/mydata.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    console.log('Connected to the SQLite database.');
});

// Check FinalActivityKPI table structure
db.get('SELECT * FROM FinalActivityKPI LIMIT 1', (err, row) => {
    if (err) {
        console.error('Error getting FinalActivityKPI data:', err.message);
    } else if (row) {
        console.log('FinalActivityKPI columns:');
        const columns = Object.keys(row);
        columns.forEach((col, index) => {
            console.log(`${index + 1}. ${col}`);
        });
        
        console.log('\nSample data:');
        console.log(row);
    } else {
        console.log('No data found in FinalActivityKPI table');
    }
    
    // Also check Project table structure for last_recalc_date
    db.get('SELECT * FROM Project LIMIT 1', (err, row) => {
        if (err) {
            console.error('Error getting Project data:', err.message);
        } else if (row) {
            console.log('\nProject table columns:');
            const columns = Object.keys(row);
            columns.forEach((col, index) => {
                console.log(`${index + 1}. ${col}`);
            });
            
            console.log('\nSample Project data:');
            console.log(row);
        } else {
            console.log('No data found in Project table');
        }
        
        db.close();
    });
}); 