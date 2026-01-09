const Database = require('better-sqlite3');

try {
  const db = new Database('./smartpizzapp13-T3.db');
  
  console.log('=== TEST SKŁADANIA ZAMÓWIENIA ===');
  
  // Zliczamy obecne zamówienia
  const currentCount = db.prepare("SELECT COUNT(*) as count FROM 'Zamówienia'").get();
  console.log(`Obecna liczba zamówień: ${currentCount.count}`);
  
  // Test INSERT
  const testOrder = db.prepare(`
    INSERT INTO "Zamówienia" (
      adres, telefon, pizza, sosy, dodatki, cena, platnosc, godzina_otrzymania, sosy_ile, rozmiar
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = testOrder.run(
    'Test Street 123',
    123456789,
    1, // pizza ID
    2, // sosy
    JSON.stringify({ test: true }),
    45.50, // cena
    'gotowka',
    new Date().toLocaleString('pl-PL'),
    2, // sosy_ile
    'srednia'
  );
  
  console.log('INSERT result:', result);
  
  // Sprawdzamy czy zostało dodane
  const newCount = db.prepare("SELECT COUNT(*) as count FROM 'Zamówienia'").get();
  console.log(`Nowa liczba zamówień: ${newCount.count}`);
  
  // Pobieramy ostatnie zamówienie
  const lastOrder = db.prepare("SELECT * FROM 'Zamówienia' ORDER BY rowid DESC LIMIT 1").get();
  console.log('Ostatnie zamówienie:', lastOrder);
  
  db.close();
  console.log(' Test zakończony pomyślnie!');
} catch (error) {
  console.error(' Błąd podczas testu:', error.message);
}