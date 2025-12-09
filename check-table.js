const Database = require('better-sqlite3');
const path = require('path');

try {
  // Sprawdź główną bazę
  console.log("=== Główna baza ===");
  const mainDb = new Database(path.join(__dirname, 'smartpizzapp13-T3.db'));
  
  try {
    const mainInfo = mainDb.prepare("PRAGMA table_info(zamowienia)").all();
    console.log("Struktura tabeli zamowienia w głównej bazie:", mainInfo);
  } catch (e) {
    console.log("Brak tabeli zamowienia w głównej bazie");
  }
  
  try {
    const oldInfo = mainDb.prepare("PRAGMA table_info([Zamówienia])").all();
    console.log("Struktura tabeli Zamówienia w głównej bazie:", oldInfo);
  } catch (e) {
    console.log("Brak tabeli Zamówienia w głównej bazie");
  }
  
  mainDb.close();
  
  // Sprawdź bazę Prisma
  console.log("\n=== Baza Prisma ===");
  const prismaDb = new Database(path.join(__dirname, 'prisma', 'smartpizzapp13-T3.db'));
  
  try {
    const prismaInfo = prismaDb.prepare("PRAGMA table_info(zamowienia)").all();
    console.log("Struktura tabeli zamowienia w bazie Prisma:", prismaInfo);
  } catch (e) {
    console.log("Brak tabeli zamowienia w bazie Prisma");
  }
  
  prismaDb.close();
  
} catch (error) {
  console.error("Błąd:", error);
}