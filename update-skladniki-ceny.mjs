import mysql from 'mysql2/promise';

const skladnikiData = [
  { id: 1, nazwa: 'sos', cena_srednia: 0, cena_duza: 0 },
  { id: 2, nazwa: 'ser', cena_srednia: 0, cena_duza: 0 },
  { id: 3, nazwa: 'zioła', cena_srednia: 0, cena_duza: 0 },
  { id: 4, nazwa: 'pieczarki', cena_srednia: 3, cena_duza: 4 },
  { id: 5, nazwa: 'cebula', cena_srednia: 1, cena_duza: 2 },
  { id: 6, nazwa: 'papryka', cena_srednia: 3, cena_duza: 4 },
  { id: 7, nazwa: 'pieprz', cena_srednia: 1, cena_duza: 2 },
  { id: 8, nazwa: 'szynka', cena_srednia: 4, cena_duza: 6 },
  { id: 9, nazwa: 'tuńczyk', cena_srednia: 4, cena_duza: 6 },
  { id: 10, nazwa: 'majonez', cena_srednia: 2, cena_duza: 2 },
  { id: 11, nazwa: 'oliwki', cena_srednia: 3, cena_duza: 4 },
  { id: 12, nazwa: 'salami', cena_srednia: 4, cena_duza: 6 },
  { id: 13, nazwa: 'ananas', cena_srednia: 3, cena_duza: 4 },
  { id: 14, nazwa: 'brzoskwinie', cena_srednia: 3, cena_duza: 4 },
  { id: 15, nazwa: 'boczek', cena_srednia: 4, cena_duza: 6 },
  { id: 16, nazwa: 'groszek', cena_srednia: 3, cena_duza: 4 },
  { id: 17, nazwa: 'pomidor', cena_srednia: 3, cena_duza: 4 },
  { id: 18, nazwa: 'krewetki', cena_srednia: 4, cena_duza: 6 },
  { id: 19, nazwa: 'czosnek', cena_srednia: 1, cena_duza: 2 },
  { id: 20, nazwa: 'kukurydza', cena_srednia: 3, cena_duza: 4 },
  { id: 21, nazwa: 'kapary', cena_srednia: 3, cena_duza: 4 },
  { id: 22, nazwa: 'tabasco', cena_srednia: 1, cena_duza: 2 },
  { id: 23, nazwa: 'kiełbasa', cena_srednia: 4, cena_duza: 6 },
  { id: 24, nazwa: 'szparagi', cena_srednia: 3, cena_duza: 4 },
  { id: 25, nazwa: 'szpinak', cena_srednia: 3, cena_duza: 4 },
  { id: 26, nazwa: 'brokuły', cena_srednia: 3, cena_duza: 4 },
  { id: 27, nazwa: 'curry', cena_srednia: 1, cena_duza: 2 },
  { id: 28, nazwa: 'bazylia', cena_srednia: 3, cena_duza: 4 },
  { id: 29, nazwa: 'kabanosy', cena_srednia: 4, cena_duza: 6 },
  { id: 30, nazwa: 'jalapeno', cena_srednia: 3, cena_duza: 4 },
  { id: 31, nazwa: 'fasola', cena_srednia: 3, cena_duza: 4 },
  { id: 32, nazwa: 'kurczak', cena_srednia: 3, cena_duza: 6 },
  { id: 33, nazwa: 'małże', cena_srednia: 4, cena_duza: 6 },
  { id: 34, nazwa: 'chili', cena_srednia: 1, cena_duza: 2 },
  { id: 35, nazwa: 'kebab', cena_srednia: 4.5, cena_duza: 5.5 },
  { id: 36, nazwa: 'serek górski', cena_srednia: 5, cena_duza: 8 },
  { id: 37, nazwa: 'ogórek konserwowy', cena_srednia: 3, cena_duza: 4 },
  { id: 38, nazwa: 'szczypiorek', cena_srednia: 3, cena_duza: 4 },
  { id: 39, nazwa: 'oregano', cena_srednia: 1, cena_duza: 2 },
  { id: 40, nazwa: 'pomidorki koktajlowe', cena_srednia: 3, cena_duza: 4 },
  { id: 41, nazwa: 'szynka długodojrzewająca', cena_srednia: 4, cena_duza: 6 },
  { id: 42, nazwa: 'ser grana padano', cena_srednia: 4, cena_duza: 8 },
  { id: 43, nazwa: 'rukola', cena_srednia: 3, cena_duza: 4 }
];

async function updateSkladniki() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Pepperoni13',
      database: 'SmartPizzApp13'
    });

    console.log('Połączono z bazą danych');

    // Sprawdź czy kolumny już istnieją
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM skladniki LIKE 'cena_srednia'"
    );

    if (columns.length === 0) {
      console.log('Dodawanie kolumn cena_srednia i cena_duza...');
      
      await connection.execute(
        'ALTER TABLE skladniki ADD COLUMN cena_srednia DECIMAL(10,2) DEFAULT 0 AFTER nazwa'
      );
      
      await connection.execute(
        'ALTER TABLE skladniki ADD COLUMN cena_duza DECIMAL(10,2) DEFAULT 0 AFTER cena_srednia'
      );
      
      console.log('Kolumny dodane');
    } else {
      console.log('Kolumny już istnieją, pomijam tworzenie');
    }

    // Aktualizuj ceny dla każdego składnika
    console.log('Aktualizacja cen składników...');
    
    for (const skladnik of skladnikiData) {
      await connection.execute(
        'UPDATE skladniki SET cena_srednia = ?, cena_duza = ? WHERE id = ?',
        [skladnik.cena_srednia, skladnik.cena_duza, skladnik.id]
      );
    }

    console.log(`Zaktualizowano ${skladnikiData.length} składników`);

    // Pokaż wynik
    const [result] = await connection.execute(
      'SELECT id, nazwa, cena_srednia, cena_duza FROM skladniki ORDER BY id'
    );
    
    console.log('\nAktualne ceny składników:');
    console.table(result);

    await connection.end();
    console.log('\nMigracja zakończona pomyślnie!');
  } catch (error) {
    console.error('Błąd:', error);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

updateSkladniki();
