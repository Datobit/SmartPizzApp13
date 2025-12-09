const Database = require('better-sqlite3');

try {
  const db = new Database('./smartpizzapp13-T3.db');
  
  console.log('=== WSZYSTKIE TABELE W BAZIE ===');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  tables.forEach(table => {
    console.log(`📋 ${table.name}`);
  });
  
  console.log('\n=== SPRAWDZANIE NAZW TABEL PODOBNYCH DO "zamówienia" ===');
  const similarTables = tables.filter(t => 
    t.name.toLowerCase().includes('zamow') || 
    t.name.toLowerCase().includes('order')
  );
  
  if (similarTables.length > 0) {
    similarTables.forEach(table => {
      console.log(`✅ Znaleziono: ${table.name}`);
      const columns = db.prepare(`PRAGMA table_info('${table.name}')`).all();
      console.log(`   Kolumny:`, columns.map(c => c.name).join(', '));
    });
  } else {
    console.log('❌ Nie znaleziono tabel z zamówieniami');
  }
  
  db.close();
} catch (error) {
  console.error('Błąd:', error.message);
}