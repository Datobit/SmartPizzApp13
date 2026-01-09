import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./smartpizzapp13-T3.db');

db.serialize(() => {
  console.log('[LISTA] Sprawdzam tabelę Zamówienia:');
  
  // Struktura tabeli
  db.all("PRAGMA table_info(Zamówienia)", (err, columns) => {
    if (!err) {
      console.log('Kolumny:');
      columns.forEach(col => {
        console.log(`  - ${col.name}: ${col.type}`);
      });
    }
  });
  
  // Przykładowe dane (jeśli są)
  db.all("SELECT * FROM Zamówienia LIMIT 3", (err, rows) => {
    if (!err) {
      console.log(`\nLiczba zamówień: ${rows.length}`);
      if (rows.length > 0) {
        console.log('Przykładowe zamówienia:');
        rows.forEach((row, index) => {
          console.log(`${index + 1}:`, row);
        });
      }
    }
    db.close();
  });
});