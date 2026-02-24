import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

// Funkcja do konwersji danych na CSV
function convertToCSV(data, headers) {
  if (!data || data.length === 0) return '';
  
  const csvRows = [];
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') {
        if (value instanceof Date) {
          return `"${value.toISOString()}"`;
        }
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

async function automatycznyBackup() {
  try {
    // Utwórz folder z datą backupu
    const dzisiaj = new Date();
    const dataString = dzisiaj.toISOString().split('T')[0]; // YYYY-MM-DD
    const backupDir = join(process.cwd(), 'csv-export', `backup-${dataString}`);
    
    mkdirSync(backupDir, { recursive: true });
    
    console.log('╔════════════════════════════════════════╗');
    console.log('║   AUTOMATYCZNY BACKUP BAZY DANYCH     ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`📅 Data: ${dataString}`);
    console.log(`📁 Folder: ${backupDir}\n`);
    
    let tabelExportowane = 0;
    let sumaWierszy = 0;
    
    // ============================================
    // 1. MENU I SKŁADNIKI
    // ============================================
    console.log('📋 Eksport menu i składników...');
    
    const pizzas = await prisma.pizza.findMany();
    if (pizzas.length > 0) {
      const csv = convertToCSV(pizzas, ['id', 'nazwa', 'cena_mala', 'cena_srednia', 'cena_duza']);
      writeFileSync(join(backupDir, 'menu_pizza.csv'), csv, 'utf8');
      console.log(`  ✅ menu_pizza.csv (${pizzas.length} wierszy)`);
      tabelExportowane++;
      sumaWierszy += pizzas.length;
    }
    
    const skladniki = await prisma.skladnik.findMany();
    if (skladniki.length > 0) {
      const csv = convertToCSV(skladniki, ['id', 'nazwa']);
      writeFileSync(join(backupDir, 'skladniki.csv'), csv, 'utf8');
      console.log(`  ✅ skladniki.csv (${skladniki.length} wierszy)`);
      tabelExportowane++;
      sumaWierszy += skladniki.length;
    }
    
    const pizzaSkladniki = await prisma.pizzaSkladnik.findMany();
    if (pizzaSkladniki.length > 0) {
      const csv = convertToCSV(pizzaSkladniki, ['id_pizza', 'id_skladnik']);
      writeFileSync(join(backupDir, 'pizza_skladnik.csv'), csv, 'utf8');
      console.log(`  ✅ pizza_skladnik.csv (${pizzaSkladniki.length} wierszy)`);
      tabelExportowane++;
      sumaWierszy += pizzaSkladniki.length;
    }
    
    const napoje = await prisma.napoj.findMany();
    if (napoje.length > 0) {
      const csv = convertToCSV(napoje, ['id', 'nazwa', 'cena']);
      writeFileSync(join(backupDir, 'napoje.csv'), csv, 'utf8');
      console.log(`  ✅ napoje.csv (${napoje.length} wierszy)`);
      tabelExportowane++;
      sumaWierszy += napoje.length;
    }
    
    const pozycjeExtra = await prisma.pozycjaExtra.findMany();
    if (pozycjeExtra.length > 0) {
      const csv = convertToCSV(pozycjeExtra, ['id', 'nazwa', 'cena']);
      writeFileSync(join(backupDir, 'pozycje_extra.csv'), csv, 'utf8');
      console.log(`  ✅ pozycje_extra.csv (${pozycjeExtra.length} wierszy)`);
      tabelExportowane++;
      sumaWierszy += pozycjeExtra.length;
    }
    
    // ============================================
    // 2. ADRESY I DZIELNICE
    // ============================================
    console.log('\n🗺️  Eksport adresów i dzielnic...');
    
    const dzielnice = await prisma.dzielnica.findMany();
    if (dzielnice.length > 0) {
      const csv = convertToCSV(dzielnice, ['id_dzielnica', 'nazwa_dzielnica', 'cena_dzielnica']);
      writeFileSync(join(backupDir, 'dzielnice.csv'), csv, 'utf8');
      console.log(`  ✅ dzielnice.csv (${dzielnice.length} wierszy)`);
      tabelExportowane++;
      sumaWierszy += dzielnice.length;
    }
    
    const ulice = await prisma.ulica.findMany();
    if (ulice.length > 0) {
      const csv = convertToCSV(ulice, ['id', 'ulica', 'numer', 'id_dzielnica', 'dzielnica_nazwa']);
      writeFileSync(join(backupDir, 'ulice.csv'), csv, 'utf8');
      console.log(`  ✅ ulice.csv (${ulice.length} wierszy)`);
      tabelExportowane++;
      sumaWierszy += ulice.length;
    }
    
    // ============================================
    // 3. KIEROWCY I SESJE
    // ============================================
    console.log('\n👥 Eksport kierowców i sesji...');
    
    const kierowcy = await prisma.kierowca.findMany();
    if (kierowcy.length > 0) {
      const csv = convertToCSV(kierowcy, ['id', 'nazwa']);
      writeFileSync(join(backupDir, 'kierowcy.csv'), csv, 'utf8');
      console.log(`  ✅ kierowcy.csv (${kierowcy.length} wierszy)`);
      tabelExportowane++;
      sumaWierszy += kierowcy.length;
    }
    
    const sesje = await prisma.sesja.findMany();
    if (sesje.length > 0) {
      const csv = convertToCSV(sesje, [
        'id', 
        'kierowca_id', 
        'data_otwarcia', 
        'data_zamkniecia', 
        'saldo_koncowe', 
        'status'
      ]);
      writeFileSync(join(backupDir, 'sesje.csv'), csv, 'utf8');
      console.log(`  ✅ sesje.csv (${sesje.length} wierszy)`);
      tabelExportowane++;
      sumaWierszy += sesje.length;
    }
    
    const transakcje = await prisma.transakcja.findMany();
    if (transakcje.length > 0) {
      const csv = convertToCSV(transakcje, [
        'id',
        'sesja_id',
        'typ',
        'kwota',
        'forma_platnosci',
        'opis',
        'data_utworzenia'
      ]);
      writeFileSync(join(backupDir, 'transakcje.csv'), csv, 'utf8');
      console.log(`  ✅ transakcje.csv (${transakcje.length} wierszy)`);
      tabelExportowane++;
      sumaWierszy += transakcje.length;
    }
    
    // ============================================
    // 4. ZAMÓWIENIA (NAJWAŻNIEJSZE!)
    // ============================================
    console.log('\n🍕 Eksport zamówień...');
    
    const zamowienia = await prisma.zamowienie.findMany({
      orderBy: {
        created_at: 'desc'
      }
    });
    if (zamowienia.length > 0) {
      const csv = convertToCSV(zamowienia, [
        'id',
        'telefon',
        'adres',
        'pizze',
        'sosy',
        'napoj',
        'pozycje_extra',
        'platnosc',
        'cena_calkowita',
        'created_at',
        'is_kupony',
        'typ_zamowienia',
        'skladniki',
        'sesja_id'
      ]);
      writeFileSync(join(backupDir, 'zamowienia.csv'), csv, 'utf8');
      console.log(`  ✅ zamowienia.csv (${zamowienia.length} wierszy)`);
      tabelExportowane++;
      sumaWierszy += zamowienia.length;
    }
    
    // ============================================
    // PODSUMOWANIE
    // ============================================
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║        BACKUP ZAKOŃCZONY POMYŚLNIE    ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`📊 Wyeksportowano ${tabelExportowane} tabel`);
    console.log(`📝 Łącznie ${sumaWierszy} wierszy danych`);
    console.log(`📁 Lokalizacja: ${backupDir}\n`);
    
    // Zapisz log backupu
    const logInfo = {
      data_backupu: dzisiaj.toISOString(),
      tabel_wyeksportowanych: tabelExportowane,
      suma_wierszy: sumaWierszy,
      lokalizacja: backupDir
    };
    writeFileSync(
      join(backupDir, '_backup_info.json'), 
      JSON.stringify(logInfo, null, 2), 
      'utf8'
    );
    
    return true;
    
  } catch (error) {
    console.error('\n❌ BŁĄD PODCZAS BACKUPU:', error);
    console.error('Szczegóły błędu:', error.message);
    
    // Zapisz log błędu
    const errorLog = {
      data: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    const errorLogPath = join(process.cwd(), 'csv-export', 'backup-error.log');
    writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2), 'utf8');
    
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Uruchom backup
automatycznyBackup().then(sukces => {
  process.exit(sukces ? 0 : 1);
});
