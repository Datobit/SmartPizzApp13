const Database = require('better-sqlite3');

try {
  const db = new Database('./smartpizzapp13-T3.db');
  
  console.log('=== DOKŁADNE NAZWY TABEL ===');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  
  tables.forEach((table, index) => {
    console.log(`${index + 1}. Nazwa: "${table.name}"`);
    console.log(`   Długość: ${table.name.length} znaków`);
    console.log(`   Hex: ${Buffer.from(table.name, 'utf8').toString('hex')}`);
    
    if (table.name.toLowerCase().includes('zamów') || table.name === 'Zamówienia') {
      console.log('    TO JEST TABELA ZAMÓWIEŃ!');
      
      // Test czy możemy do niej pisać
      try {
        const testQuery = `SELECT COUNT(*) as count FROM "${table.name}"`;
        const result = db.prepare(testQuery).get();
        console.log(`   [STATS] Liczba rekordów: ${result.count}`);
        
        // Test struktury
        const structure = db.prepare(`PRAGMA table_info("${table.name}")`).all();
        console.log('   [LISTA] Kolumny:');
        structure.forEach(col => {
          console.log(`      - ${col.name}: ${col.type}`);
        });
        
      } catch (queryError) {
        console.log(`    Błąd zapytania: ${queryError.message}`);
      }
    }
    console.log('');
  });
  
  db.close();
} catch (error) {
  console.error('Błąd:', error.message);
}