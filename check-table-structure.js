import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./smartpizzapp13-T3.db');

db.serialize(() => {
  console.log('🔍 Sprawdzam indeksy i constrainty tabeli Zamówienia:');
  
  // Indeksy
  db.all("PRAGMA index_list(Zamówienia)", (err, indexes) => {
    if (!err) {
      console.log('Indeksy:', indexes);
    }
  });
  
  // SQL tworzenia tabeli
  db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='Zamówienia'", (err, result) => {
    if (!err && result.length > 0) {
      console.log('\nSQL tworzenia tabeli:');
      console.log(result[0].sql);
    }
    db.close();
  });
});