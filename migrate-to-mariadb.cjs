/**
 * Skrypt migracji z SQLite do MariaDB
 * Eksportuje dane z SQLite i przygotowuje do importu do MariaDB
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const sqliteDbPath = path.join(__dirname, 'prisma', 'smartpizzapp13-T3.db');
const outputFile = path.join(__dirname, 'migration-data.sql');

const db = new sqlite3.Database(sqliteDbPath);

console.log('🔄 Rozpoczynam eksport danych z SQLite...\n');

// SQL dla MariaDB
let sqlOutput = `-- Migracja danych z SQLite do MariaDB
-- Data: ${new Date().toISOString()}

SET FOREIGN_KEY_CHECKS = 0;

`;

// Tabele do wyeksportowania w odpowiedniej kolejności (z uwzględnieniem kluczy obcych)
const tables = [
  'menu_pizza',
  'skladniki', 
  'relacja_skladniki',
  'napoje',
  'pozycje_extra',
  'ulice',
  'zamowienia'
];

let processedTables = 0;

tables.forEach((tableName) => {
  db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
    if (err) {
      console.error(`❌ Błąd przy eksporcie tabeli ${tableName}:`, err.message);
      processedTables++;
      checkCompletion();
      return;
    }

    if (rows.length === 0) {
      console.log(`⚠️  Tabela ${tableName} jest pusta`);
      processedTables++;
      checkCompletion();
      return;
    }

    console.log(`✅ Eksportowano ${rows.length} wierszy z tabeli ${tableName}`);

    // Wyczyść tabelę przed insertem
    sqlOutput += `\n-- Tabela: ${tableName}\n`;
    sqlOutput += `TRUNCATE TABLE \`${tableName}\`;\n`;

    // Generuj INSERT statements
    rows.forEach((row) => {
      const columns = Object.keys(row);
      const values = columns.map((col) => {
        const val = row[col];
        if (val === null) return 'NULL';
        if (typeof val === 'number') return val;
        // Escape single quotes dla MySQL
        return `'${String(val).replace(/'/g, "''")}'`;
      });

      sqlOutput += `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES (${values.join(', ')});\n`;
    });

    processedTables++;
    checkCompletion();
  });
});

function checkCompletion() {
  if (processedTables === tables.length) {
    sqlOutput += '\nSET FOREIGN_KEY_CHECKS = 1;\n';
    
    fs.writeFileSync(outputFile, sqlOutput, 'utf8');
    
    console.log('\n✅ Eksport zakończony pomyślnie!');
    console.log(`📄 Plik SQL zapisany jako: ${outputFile}`);
    console.log('\n📋 Kolejne kroki:');
    console.log('1. Upewnij się, że MariaDB jest uruchomiona');
    console.log('2. Utwórz bazę danych: CREATE DATABASE SmartPizzApp13;');
    console.log('3. Uruchom migrację Prisma: npx prisma db push');
    console.log('4. Zaimportuj dane: mysql -u root -p SmartPizzApp13 < migration-data.sql');
    
    db.close();
  }
}
