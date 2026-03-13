const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Funkcja do konwersji danych na CSV
function convertToCSV(data, headers) {
  if (!data || data.length === 0) return '';
  
  const csvRows = [];
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (value instanceof Date) return `"${value.toISOString()}"`;
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      if (typeof value === 'string') return `"${String(value).replace(/"/g, '""')}"`;
      return `"${String(value)}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

async function exportZamowieniaTransakcje() {
  let connection;
  
  try {
    // Połącz z bazą danych
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Pepperoni13',
      database: 'SmartPizzApp13'
    });
    
    console.log('✅ Połączono z bazą danych MariaDB\n');
    
    // Utwórz folder na eksport z datą
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const exportDir = path.join(process.cwd(), `export-zamowienia-${timestamp}`);
    
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    console.log(`📁 Folder eksportu: ${exportDir}\n`);
    console.log('Eksportowanie danych...\n');
    
    // 1. KIEROWCY
    console.log('📦 Eksportowanie kierowców...');
    const [kierowcy] = await connection.execute('SELECT * FROM kierowcy ORDER BY id');
    if (kierowcy.length > 0) {
      const headers = Object.keys(kierowcy[0]);
      const csv = convertToCSV(kierowcy, headers);
      fs.writeFileSync(path.join(exportDir, 'kierowcy.csv'), csv, 'utf8');
      console.log(`   ✅ kierowcy.csv (${kierowcy.length} wierszy)`);
    } else {
      console.log('   ⚠️  Brak danych w tabeli kierowcy');
    }
    
    // 2. SESJE
    console.log('📦 Eksportowanie sesji...');
    const [sesje] = await connection.execute('SELECT * FROM sesje ORDER BY id');
    if (sesje.length > 0) {
      const headers = Object.keys(sesje[0]);
      const csv = convertToCSV(sesje, headers);
      fs.writeFileSync(path.join(exportDir, 'sesje.csv'), csv, 'utf8');
      console.log(`   ✅ sesje.csv (${sesje.length} wierszy)`);
    } else {
      console.log('   ⚠️  Brak danych w tabeli sesje');
    }
    
    // 3. TRANSAKCJE
    console.log('📦 Eksportowanie transakcji...');
    const [transakcje] = await connection.execute('SELECT * FROM transakcje ORDER BY id');
    if (transakcje.length > 0) {
      const headers = Object.keys(transakcje[0]);
      const csv = convertToCSV(transakcje, headers);
      fs.writeFileSync(path.join(exportDir, 'transakcje.csv'), csv, 'utf8');
      console.log(`   ✅ transakcje.csv (${transakcje.length} wierszy)`);
    } else {
      console.log('   ⚠️  Brak danych w tabeli transakcje');
    }
    
    // 4. ZAMÓWIENIA
    console.log('📦 Eksportowanie zamówień...');
    const [zamowienia] = await connection.execute('SELECT * FROM zamowienia ORDER BY id');
    if (zamowienia.length > 0) {
      const headers = Object.keys(zamowienia[0]);
      const csv = convertToCSV(zamowienia, headers);
      fs.writeFileSync(path.join(exportDir, 'zamowienia.csv'), csv, 'utf8');
      console.log(`   ✅ zamowienia.csv (${zamowienia.length} wierszy)`);
    } else {
      console.log('   ⚠️  Brak danych w tabeli zamowienia');
    }
    
    // Podsumowanie
    console.log('\n' + '='.repeat(60));
    console.log('✅ EKSPORT ZAKOŃCZONY POMYŚLNIE!');
    console.log('='.repeat(60));
    console.log(`\n📂 Wyeksportowane pliki znajdują się w:\n   ${exportDir}\n`);
    console.log('Wyeksportowane tabele:');
    console.log('  - kierowcy.csv');
    console.log('  - sesje.csv');
    console.log('  - transakcje.csv');
    console.log('  - zamowienia.csv');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ BŁĄD podczas eksportu:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Rozłączono z bazą danych');
    }
  }
}

// Uruchom eksport
exportZamowieniaTransakcje();
