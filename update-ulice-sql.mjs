import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'SmartPizzApp13'
  });

  try {
    console.log('🗑️  Usuwanie starych ulic z bazy...');
    const [deleteResult] = await connection.execute('DELETE FROM ulice');
    console.log(`✅ Usunięto ${deleteResult.affectedRows} rekordów`);

    console.log('\n🔧 Zmiana typu kolumn x i y na INT...');
    await connection.execute('ALTER TABLE ulice MODIFY COLUMN x INT NULL');
    await connection.execute('ALTER TABLE ulice MODIFY COLUMN y INT NULL');
    console.log('✅ Kolumny zmienione');

    console.log('\n📂 Wczytywanie danych z CSV...');
    const csvPath = path.join(__dirname, 'ULICE', 'SMARTPIZZAPP13_ULICE_fulll_final.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    const dataLines = lines.slice(1).filter(line => line.trim());
    console.log(`📊 Znaleziono ${dataLines.length} rekordów do wgrania`);
    
    let successCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < dataLines.length; i += batchSize) {
      const batch = dataLines.slice(i, i + batchSize);
      
      const values = batch.map(line => {
        const parts = line.split(';');
        return [
          parts[0]?.trim() || null,
          parts[1]?.trim() || null,
          parts[2]?.trim() || null,
          parts[3] ? parseInt(parts[3]) : null,
          parts[4] ? parseInt(parts[4]) : null,
          parts[5] ? parseInt(parts[5]) : null,
          parts[6]?.trim() || null
        ];
      }).filter(r => r[1] && r[2]); // Filtruj gdzie nie ma ulicy lub numeru
      
      if (values.length > 0) {
        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flatValues = values.flat();
        
        await connection.execute(
          `INSERT INTO ulice (miejscowosc, ulica, numer, x, y, id_dzielnica, dzielnica_nazwa) VALUES ${placeholders}`,
          flatValues
        );
        
        successCount += values.length;
        console.log(`✅ Wgrano partię ${Math.floor(i / batchSize) + 1}/${Math.ceil(dataLines.length / batchSize)} (${successCount} rekordów)`);
      }
    }
    
    console.log('\n📊 Podsumowanie:');
    console.log(`✅ Pomyślnie wgrano: ${successCount} rekordów`);
    
    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM ulice');
    console.log(`\n🏘️  Łącznie ulic w bazie: ${countResult[0].count}`);
    
  } catch (error) {
    console.error('❌ Wystąpił błąd:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
