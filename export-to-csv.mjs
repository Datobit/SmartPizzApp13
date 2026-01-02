import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
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
      if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

async function exportAllTables() {
  try {
    // Utwórz folder na eksport
    const exportDir = join(process.cwd(), 'csv-export');
    mkdirSync(exportDir, { recursive: true });
    
    console.log('Eksportowanie danych do CSV...\n');
    
    // Pizza
    const pizzas = await prisma.pizza.findMany();
    if (pizzas.length > 0) {
      const csv = convertToCSV(pizzas, ['id', 'nazwa', 'cena_mala', 'cena_srednia', 'cena_duza']);
      writeFileSync(join(exportDir, 'menu_pizza.csv'), csv, 'utf8');
      console.log(`✅ menu_pizza.csv (${pizzas.length} wierszy)`);
    }
    
    // Składniki
    const skladniki = await prisma.skladnik.findMany();
    if (skladniki.length > 0) {
      const csv = convertToCSV(skladniki, ['id', 'nazwa']);
      writeFileSync(join(exportDir, 'skladniki.csv'), csv, 'utf8');
      console.log(`✅ skladniki.csv (${skladniki.length} wierszy)`);
    }
    
    // Pizza-Składnik
    const pizzaSkladniki = await prisma.pizzaSkladnik.findMany();
    if (pizzaSkladniki.length > 0) {
      const csv = convertToCSV(pizzaSkladniki, ['id_pizza', 'id_skladnik']);
      writeFileSync(join(exportDir, 'pizza_skladnik.csv'), csv, 'utf8');
      console.log(`✅ pizza_skladnik.csv (${pizzaSkladniki.length} wierszy)`);
    }
    
    // Napoje
    const napoje = await prisma.napoj.findMany();
    if (napoje.length > 0) {
      const csv = convertToCSV(napoje, ['id', 'nazwa', 'cena']);
      writeFileSync(join(exportDir, 'napoje.csv'), csv, 'utf8');
      console.log(`✅ napoje.csv (${napoje.length} wierszy)`);
    }
    
    // Pozycje Extra
    const pozycjeExtra = await prisma.pozycjaExtra.findMany();
    if (pozycjeExtra.length > 0) {
      const csv = convertToCSV(pozycjeExtra, ['id', 'nazwa', 'cena']);
      writeFileSync(join(exportDir, 'pozycje_extra.csv'), csv, 'utf8');
      console.log(`✅ pozycje_extra.csv (${pozycjeExtra.length} wierszy)`);
    }
    
    // Dzielnice
    const dzielnice = await prisma.dzielnica.findMany();
    if (dzielnice.length > 0) {
      const csv = convertToCSV(dzielnice, ['id_dzielnica', 'nazwa_dzielnica', 'cena_dzielnica']);
      writeFileSync(join(exportDir, 'dzielnice.csv'), csv, 'utf8');
      console.log(`✅ dzielnice.csv (${dzielnice.length} wierszy)`);
    }
    
    // Ulice
    const ulice = await prisma.ulica.findMany();
    if (ulice.length > 0) {
      const csv = convertToCSV(ulice, ['id', 'ulica', 'numer', 'id_dzielnica', 'dzielnica_nazwa']);
      writeFileSync(join(exportDir, 'ulica.csv'), csv, 'utf8');
      console.log(`✅ ulica.csv (${ulice.length} wierszy)`);
    }
    
    console.log(`\n✅ Eksport zakończony! Pliki zapisane w: ${exportDir}`);
    
  } catch (error) {
    console.error('❌ Błąd podczas eksportu:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportAllTables();
