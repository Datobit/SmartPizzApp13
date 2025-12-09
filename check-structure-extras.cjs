const Database = require('better-sqlite3');
const path = require('path');

try {
  console.log("=== Sprawdzam strukturę tabel pozycje_extra ===");
  
  // Sprawdź bazę Prisma
  console.log("\n--- Baza Prisma ---");
  const prismaDb = new Database(path.join(__dirname, 'prisma', 'smartpizzapp13-T3.db'));
  
  try {
    const structure = prismaDb.prepare("PRAGMA table_info(pozycje_extra)").all();
    console.log("Struktura pozycje_extra w bazie Prisma:", structure);
  } catch (e) {
    console.log("Błąd:", e.message);
  }
  
  prismaDb.close();
  
  // Sprawdź główną bazę
  console.log("\n--- Główna baza ---");
  const mainDb = new Database(path.join(__dirname, 'smartpizzapp13-T3.db'));
  
  try {
    const structure = mainDb.prepare("PRAGMA table_info(pozycje_extra)").all();
    console.log("Struktura pozycje_extra w głównej bazie:", structure);
  } catch (e) {
    console.log("Błąd:", e.message);
  }
  
  mainDb.close();
  
} catch (error) {
  console.error("Błąd:", error);
}