import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./smartpizzapp13-T3.db');

db.serialize(() => {
  console.log(' Sprawdzam szczegóły tabeli Menu pizza:');
  
  // Struktura tabeli
  db.all("PRAGMA table_info(`Menu pizza`)", (err, columns) => {
    if (!err) {
      console.log('Kolumny:');
      columns.forEach(col => {
        console.log(`  - ${col.name}: ${col.type} (default: ${col.dflt_value})`);
      });
    }
  });
  
  // Przykładowe dane
  db.all("SELECT * FROM `Menu pizza` LIMIT 5", (err, rows) => {
    if (!err) {
      console.log('\nPierwsze 5 pizz:');
      rows.forEach((row, index) => {
        console.log(`${index + 1}:`, row);
      });
    }
    db.close();
  });
});