import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('📋 Rozpoczynam wymianę danych w tabeli ulica...\n');

    // Krok 1: Usuwanie wszystkich danych z tabeli ulice
    console.log('🗑️  Usuwanie wszystkich danych z tabeli ulice...');
    const deleteResult = await prisma.$executeRaw`DELETE FROM ulice`;
    console.log(`✅ Usunięto ${deleteResult} rekordów\n`);

    // Krok 2: Reset auto-increment (opcjonalnie)
    console.log('🔄 Resetowanie auto-increment...');
    await prisma.$executeRawUnsafe('ALTER TABLE ulice AUTO_INCREMENT = 1');
    console.log('✅ Auto-increment zresetowany\n');

    // Krok 3: Wczytywanie danych z CSV
    console.log('📂 Wczytywanie danych z pliku ulica.csv...');
    const csvPath = '/home/pizzapp13/Downloads/ulica.csv';
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Plik ${csvPath} nie istnieje!`);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    // Pomiń nagłówek (pierwsza linia)
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    console.log(`📊 Znaleziono ${dataLines.length} rekordów do wgrania\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Wstawiaj w partiach po 100 dla wydajności
    const batchSize = 100;
    const totalBatches = Math.ceil(dataLines.length / batchSize);
    
    for (let i = 0; i < dataLines.length; i += batchSize) {
      const batch = dataLines.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      const records = batch.map(line => {
        // CSV używa przecinków jako separatora
        const parts = line.split(',');
        
        return {
          miejscowosc: parts[1]?.trim() || null,
          ulica: parts[2]?.trim() || null,
          numer: parts[3]?.trim() || null,
          x: parts[4] && parts[4].trim() ? parseInt(parts[4].trim()) : null,
          y: parts[5] && parts[5].trim() ? parseInt(parts[5].trim()) : null,
          id_dzielnica: parts[6] && parts[6].trim() ? parseInt(parts[6].trim()) : null,
          dzielnica_nazwa: parts[7]?.trim() || null
        };
      }).filter(r => r.ulica || r.numer); // Filtruj całkowicie puste rekordy
      
      try {
        if (records.length > 0) {
          await prisma.ulica.createMany({
            data: records,
            skipDuplicates: true
          });
          successCount += records.length;
          console.log(`✅ Wgrano partię ${batchNumber}/${totalBatches} (${successCount}/${dataLines.length} rekordów)`);
        }
      } catch (error) {
        console.error(`❌ Błąd w partii ${batchNumber}:`, error.message);
        errorCount += records.length;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 PODSUMOWANIE');
    console.log('='.repeat(50));
    console.log(`✅ Pomyślnie wgrano: ${successCount} rekordów`);
    if (errorCount > 0) {
      console.log(`❌ Błędy: ${errorCount} rekordów`);
    }
    
    // Sprawdź ile jest teraz ulic w bazie
    const totalCount = await prisma.ulica.count();
    console.log(`\n🏘️  Łącznie ulic w bazie: ${totalCount}`);
    
    // Wyświetl przykładowe rekordy
    console.log('\n📋 Przykładowe rekordy z bazy:');
    const samples = await prisma.ulica.findMany({
      take: 5,
      orderBy: { id: 'asc' }
    });
    
    samples.forEach(ulica => {
      console.log(`  - ${ulica.miejscowosc}, ${ulica.ulica} ${ulica.numer} (Dzielnica: ${ulica.dzielnica_nazwa})`);
    });
    
    console.log('\n✅ Wymiana danych zakończona pomyślnie!');
    
  } catch (error) {
    console.error('\n❌ Wystąpił błąd:', error);
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
