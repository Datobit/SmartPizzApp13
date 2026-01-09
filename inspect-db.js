import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./smartpizzapp13-T3.db');

db.serialize(() => {
  console.log('[SZUKAM] Sprawdzam strukturę bazy danych...');
  
  // Lista wszystkich tabel
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('Błąd:', err);
      return;
    }
    
    console.log('[STATS] Znalezione tabele:');
    tables.forEach(table => {
      console.log(`- ${table.name}`);
    });
    
    // Dla każdej tabeli sprawdź strukturę i dane
    tables.forEach(table => {
      console.log(`\n[SZUKAM] Sprawdzam tabelę: ${table.name}`);
      
      // Struktura tabeli
      db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
        if (!err) {
          console.log('Kolumny:');
          columns.forEach(col => {
            console.log(`  - ${col.name}: ${col.type}`);
          });
        }
      });
      
      // Liczba rekordów
      db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, result) => {
        if (!err) {
          console.log(`Liczba rekordów: ${result.count}`);
          
          // Pokaż pierwsze 3 rekordy jako przykład
          if (result.count > 0) {
            db.all(`SELECT * FROM ${table.name} LIMIT 3`, (err, rows) => {
              if (!err && rows.length > 0) {
                console.log('Przykładowe dane:');
                rows.forEach((row, index) => {
                  console.log(`  ${index + 1}:`, row);
                });
              }
            });
          }
        }
      });
    });
    
    db.close();
  });
});