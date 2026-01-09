const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrateUliceData() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Pepperoni13',
      database: 'SmartPizzApp13'
    });

    console.log(' Połączono z bazą danych');

    // 1. Usuń starą tabelę ulice
    console.log('\n Usuwanie starej tabeli ulice...');
    await connection.execute('DROP TABLE IF EXISTS ulice');
    console.log(' Usunięto tabelę ulice');

    // 2. Usuń i utwórz tabelę dzielnice
    console.log('\n Usuwanie i tworzenie tabeli dzielnice...');
    await connection.execute('DROP TABLE IF EXISTS dzielnice');
    await connection.execute(`
      CREATE TABLE dzielnice (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        cena_dzielnica DOUBLE NOT NULL
      )
    `);
    console.log(' Utworzono tabelę dzielnice');

    // 3. Wstaw dane do tabeli dzielnice
    console.log('\n Wstawianie danych do tabeli dzielnice...');
    await connection.execute(`
      INSERT INTO dzielnice (id, cena_dzielnica) VALUES
      (1, 0),
      (2, 5),
      (3, 7),
      (4, 10)
    `);
    console.log(' Dodano 4 dzielnice');

    // 4. Utwórz nową tabelę ulice
    console.log('\n Tworzenie nowej tabeli ulice...');
    await connection.execute(`
      CREATE TABLE ulice (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        miejscowosc TEXT,
        ulica TEXT,
        numer TEXT,
        x TEXT,
        y TEXT,
        id_dzielnica INT,
        dzielnica_nazwa TEXT,
        FOREIGN KEY (id_dzielnica) REFERENCES dzielnice(id)
      )
    `);
    console.log(' Utworzono nową tabelę ulice');

    // 5. Wczytaj dane z CSV
    console.log('\n Wczytywanie danych z CSV...');
    const csvPath = path.join(__dirname, 'ULICE', 'SMARTPIZZAPP13_ULICE_FULL.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    // Pomiń nagłówek
    let count = 0;
    const batchSize = 1000;
    let batch = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(';');
      if (parts.length < 7) continue;

      const [miejscowosc, ulica, numer, x, y, id_dzielnica, dzielnica_nazwa] = parts;
      
      batch.push([
        miejscowosc,
        ulica,
        numer,
        x,
        y,
        parseInt(id_dzielnica) || null,
        dzielnica_nazwa
      ]);

      if (batch.length >= batchSize) {
        await connection.query(
          'INSERT INTO ulice (miejscowosc, ulica, numer, x, y, id_dzielnica, dzielnica_nazwa) VALUES ?',
          [batch]
        );
        count += batch.length;
        console.log(`   Zaimportowano ${count} rekordów...`);
        batch = [];
      }
    }

    // Wstaw pozostałe rekordy
    if (batch.length > 0) {
      await connection.query(
        'INSERT INTO ulice (miejscowosc, ulica, numer, x, y, id_dzielnica, dzielnica_nazwa) VALUES ?',
        [batch]
      );
      count += batch.length;
    }

    console.log(` Zaimportowano łącznie ${count} rekordów`);

    // 6. Wyświetl statystyki
    const [stats] = await connection.execute(`
      SELECT 
        d.id,
        d.cena_dzielnica,
        COUNT(u.id) as liczba_ulic
      FROM dzielnice d
      LEFT JOIN ulice u ON u.id_dzielnica = d.id
      GROUP BY d.id, d.cena_dzielnica
      ORDER BY d.id
    `);

    console.log('\n[STATS] Statystyki:');
    stats.forEach(row => {
      console.log(`   Dzielnica ${row.id} (${row.cena_dzielnica} PLN): ${row.liczba_ulic} ulic`);
    });

    await connection.end();
    console.log('\n Migracja zakończona pomyślnie!');

  } catch (error) {
    console.error(' Błąd:', error);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

migrateUliceData();
