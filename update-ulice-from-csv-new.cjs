const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Funkcja do parsowania CSV (obsługuje cudzysłowy i escapowane przecinki)
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Prosty parser CSV - dzielimy po przecinkach
    const values = line.split(',').map(v => v.trim());
    
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || null;
      });
      rows.push(row);
    } else {
      console.warn(`⚠️  Pominięto linię ${i+1}: nieprawidłowa liczba kolumn (${values.length} zamiast ${headers.length})`);
    }
  }
  
  return rows;
}

async function updateUlice() {
  let connection;
  
  try {
    console.log('🔄 Łączenie z bazą danych...');
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'Pepperoni13',
      database: 'SmartPizzApp13'
    });
    
    console.log('✅ Połączono z bazą danych');
    
    // Wczytaj plik CSV
    const csvPath = path.join(__dirname, 'csv-export', 'ulice_zaktualizowane.csv');
    console.log(`📂 Wczytywanie pliku: ${csvPath}`);
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCSV(csvContent);
    console.log(`📊 Wczytano ${rows.length} rekordów z CSV`);
    
    // Wyczyść tabelę ulice
    console.log('🗑️  Czyszczenie tabeli ulice...');
    await connection.execute('DELETE FROM ulice');
    console.log('✅ Tabela ulice wyczyszczona');
    
    // Wstaw dane z CSV
    console.log('📥 Wstawianie danych do tabeli ulice...');
    let inserted = 0;
    let errors = 0;
    
    for (const row of rows) {
      try {
        await connection.execute(
          `INSERT INTO ulice (id, miejscowosc, ulica, numer, x, y, id_dzielnica, dzielnica_nazwa) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id || null,
            row.miejscowosc || null,
            row.ulica || null,
            row.numer || null,
            row.x || null,
            row.y || null,
            row.id_dzielnica || null,
            row.dzielnica_nazwa || null
          ]
        );
        inserted++;
        
        if (inserted % 1000 === 0) {
          console.log(`   Wstawiono ${inserted}/${rows.length} rekordów...`);
        }
      } catch (err) {
        errors++;
        if (errors < 10) {
          console.error(`❌ Błąd przy wstawianiu rekordu ID ${row.id}:`, err.message);
        }
      }
    }
    
    console.log('✅ Zakończono wstawianie danych');
    console.log(`📊 Podsumowanie:`);
    console.log(`   - Wstawiono: ${inserted} rekordów`);
    console.log(`   - Błędy: ${errors}`);
    
    // Sprawdź liczbę rekordów w tabeli
    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM ulice');
    console.log(`📊 Liczba rekordów w tabeli ulice: ${countResult[0].count}`);
    
  } catch (error) {
    console.error('❌ Błąd:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Rozłączono z bazą danych');
    }
  }
}

// Uruchom funkcję
updateUlice()
  .then(() => {
    console.log('✅ Operacja zakończona pomyślnie');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Operacja nie powiodła się:', error);
    process.exit(1);
  });
