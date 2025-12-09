const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'smartpizzapp13-T3.db');
console.log('Ścieżka do bazy danych:', dbPath);

try {
  const db = new Database(dbPath);
  
  console.log('\n=== LISTA TABEL ===');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  tables.forEach(table => {
    console.log(`- ${table.name}`);
  });

  console.log('\n=== STRUKTURA TABELI Zamówienia ===');
  try {
    const structure = db.prepare("PRAGMA table_info('Zamówienia')").all();
    console.log('Kolumny tabeli "Zamówienia":');
    structure.forEach(col => {
      console.log(`  ${col.name}: ${col.type} (null: ${col.notnull ? 'NO' : 'YES'})`);
    });
    
    console.log('\n=== LICZBA REKORDÓW W TABELI Zamówienia ===');
    const count = db.prepare('SELECT COUNT(*) as count FROM "Zamówienia"').get();
    console.log(`Liczba zamówień: ${count.count}`);
    
    if (count.count > 0) {
      console.log('\n=== OSTATNIE 5 ZAMÓWIEŃ ===');
      const orders = db.prepare('SELECT * FROM "Zamówienia" ORDER BY id DESC LIMIT 5').all();
      orders.forEach((order, i) => {
        console.log(`${i + 1}. ID: ${order.id}, Tel: ${order.telefon}, Adres: ${order.adres}`);
      });
    }
  } catch (err) {
    console.error('Błąd przy sprawdzaniu tabeli Zamówienia:', err.message);
  }

  db.close();
} catch (error) {
  console.error('Błąd połączenia z bazą:', error.message);
}