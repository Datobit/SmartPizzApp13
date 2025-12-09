const Database = require('better-sqlite3');
const path = require('path');

try {
  const prismaDb = new Database(path.join(__dirname, 'prisma', 'smartpizzapp13-T3.db'));
  const mainDb = new Database(path.join(__dirname, 'smartpizzapp13-T3.db'));
  
  // Pobierz dane z głównej bazy
  const extrasMain = mainDb.prepare("SELECT * FROM pozycje_extra").all();
  console.log("Dane z głównej bazy:", extrasMain);
  
  // Konwertuj i dodaj do bazy Prisma
  for (const extra of extrasMain) {
    // Znajdź dostępną cenę (pierwszą niepustą)
    let cena = 0;
    if (extra.cena_maly && extra.cena_maly !== '') cena = extra.cena_maly;
    else if (extra.cena_sredni && extra.cena_sredni !== '') cena = extra.cena_sredni;
    else if (extra.cena_duzy && extra.cena_duzy !== '') cena = extra.cena_duzy;
    
    console.log(`Dodaję: ${extra.nazwa} - ${cena} PLN`);
    
    prismaDb.prepare("INSERT INTO pozycje_extra (nazwa, cena) VALUES (?, ?)").run(
      extra.nazwa,
      cena
    );
  }
  
  // Sprawdź wynik
  const result = prismaDb.prepare("SELECT * FROM pozycje_extra").all();
  console.log("Pozycje extra w bazie Prisma po dodaniu:", result);
  
  prismaDb.close();
  mainDb.close();
  
} catch (error) {
  console.error("Błąd:", error);
}