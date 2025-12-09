const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'smartpizzapp13-T3.db');
console.log('=== DOKŁADNA STRUKTURA TABELI Zamówienia ===');

try {
  const db = new Database(dbPath);
  
  const structure = db.prepare("PRAGMA table_info('Zamówienia')").all();
  console.log('Kolumny tabeli "Zamówienia":');
  structure.forEach((col, i) => {
    console.log(`  ${i}: ${col.name} (${col.type}) - PRIMARY KEY: ${col.pk ? 'YES' : 'NO'}, NOT NULL: ${col.notnull ? 'YES' : 'NO'}, DEFAULT: ${col.dflt_value || 'NULL'}`);
  });

  console.log('\n=== PRZYKŁADOWE ZAMÓWIENIA ===');
  const orders = db.prepare('SELECT * FROM "Zamówienia" LIMIT 3').all();
  orders.forEach((order, i) => {
    console.log(`${i + 1}. ${JSON.stringify(order, null, 2)}`);
  });

  db.close();
} catch (error) {
  console.error('Błąd:', error.message);
}