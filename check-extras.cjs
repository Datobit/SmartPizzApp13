const Database = require('better-sqlite3');
const path = require('path');

try {
  console.log("=== Sprawdzam pozycje extra ===");
  
  // Sprawdź bazę Prisma
  console.log("\n--- Baza Prisma ---");
  const prismaDb = new Database(path.join(__dirname, 'prisma', 'smartpizzapp13-T3.db'));
  
  try {
    const extras = prismaDb.prepare("SELECT * FROM pozycje_extra").all();
    console.log("Pozycje extra w bazie Prisma:", extras);
  } catch (e) {
    console.log("Błąd pobierania pozycji extra z bazy Prisma:", e.message);
  }
  
  prismaDb.close();
  
  // Sprawdź główną bazę
  console.log("\n--- Główna baza ---");
  const mainDb = new Database(path.join(__dirname, 'smartpizzapp13-T3.db'));
  
  try {
    const extras = mainDb.prepare("SELECT * FROM pozycje_extra").all();
    console.log("Pozycje extra w głównej bazie:", extras);
  } catch (e) {
    console.log("Błąd pobierania pozycji extra z głównej bazy:", e.message);
  }
  
  mainDb.close();
  
} catch (error) {
  console.error("Błąd:", error);
}