const Database = require('better-sqlite3');

try {
  const db = new Database('./smartpizzapp13-T3.db');
  
  console.log('=== STRUKTURA TABELI Zamówienia ===');
  const structure = db.prepare("PRAGMA table_info('Zamówienia')").all();
  structure.forEach(col => {
    console.log(`${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  console.log('\n=== PRZYKŁADOWE REKORDY ===');
  const sample = db.prepare("SELECT * FROM 'Zamówienia' LIMIT 2").all();
  console.log(sample);
  
  db.close();
} catch (error) {
  console.error('Błąd:', error.message);
}