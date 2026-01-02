import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🗑️  Usuwanie starych ulic z bazy...');
    const deleteResult = await prisma.$executeRaw`DELETE FROM ulice`;
    console.log(`✅ Usunięto ${deleteResult} rekordów`);
    
    console.log('\n🔧 Zmiana typu kolumn x i y na INT...');
    await prisma.$executeRawUnsafe('ALTER TABLE ulice MODIFY COLUMN x INT NULL');
    await prisma.$executeRawUnsafe('ALTER TABLE ulice MODIFY COLUMN y INT NULL');
    console.log('✅ Kolumny zmienione');

    console.log('\n📂 Wczytywanie danych z CSV...');
    const csvPath = path.join(__dirname, 'ULICE', 'SMARTPIZZAPP13_ULICE_fulll_final.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    // Pomiń nagłówek
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    console.log(`📊 Znaleziono ${dataLines.length} rekordów do wgrania`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Wstawiaj w partiach po 100
    const batchSize = 100;
    for (let i = 0; i < dataLines.length; i += batchSize) {
      const batch = dataLines.slice(i, i + batchSize);
      
      const records = batch.map(line => {
        const parts = line.split(';');
        return {
          miejscowosc: parts[0]?.trim() || '',
          ulica: parts[1]?.trim() || '',
          numer: parts[2]?.trim() || '',
          x: parts[3] ? parseInt(parts[3]) : null,
          y: parts[4] ? parseInt(parts[4]) : null,
          id_dzielnica: parts[5] ? parseInt(parts[5]) : null,
          dzielnica_nazwa: parts[6]?.trim() || ''
        };
      }).filter(r => r.ulica && r.numer); // Filtruj puste rekordy
      
      try {
        await prisma.ulica.createMany({
          data: records,
          skipDuplicates: true
        });
        successCount += records.length;
        console.log(`✅ Wgrano partię ${Math.floor(i / batchSize) + 1}/${Math.ceil(dataLines.length / batchSize)} (${successCount} rekordów)`);
      } catch (error) {
        console.error(`❌ Błąd w partii ${Math.floor(i / batchSize) + 1}:`, error.message);
        errorCount += records.length;
      }
    }
    
    console.log('\n📊 Podsumowanie:');
    console.log(`✅ Pomyślnie wgrano: ${successCount} rekordów`);
    if (errorCount > 0) {
      console.log(`❌ Błędy: ${errorCount} rekordów`);
    }
    
    // Sprawdź ile jest teraz ulic w bazie
    const totalCount = await prisma.ulica.count();
    console.log(`\n🏘️  Łącznie ulic w bazie: ${totalCount}`);
    
  } catch (error) {
    console.error('❌ Wystąpił błąd:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
