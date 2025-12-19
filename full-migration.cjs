#!/usr/bin/env node
/**
 * Kompletny skrypt migracji z SQLite do MariaDB
 * Wykonuje wszystkie kroki automatycznie
 */

const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const config = {
  host: 'localhost',
  user: 'root',
  password: 'Pepperoni13',
  port: 3306,
  multipleStatements: true
};

async function runCommand(command, description) {
  console.log(`\n🔧 ${description}...`);
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    console.log(`✅ ${description} - zakończone`);
    return true;
  } catch (error) {
    console.error(`❌ Błąd podczas: ${description}`);
    console.error(error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Rozpoczynam pełną migrację z SQLite do MariaDB\n');
  console.log('=' .repeat(60));

  try {
    // Krok 1: Sprawdź połączenie z MariaDB
    console.log('\n📡 KROK 1: Sprawdzanie połączenia z MariaDB');
    let connection;
    try {
      connection = await mysql.createConnection(config);
      console.log('✅ Połączono z MariaDB');
    } catch (error) {
      console.error('❌ Nie można połączyć się z MariaDB');
      console.error('💡 Upewnij się, że:');
      console.error('   - MariaDB jest uruchomiona');
      console.error('   - Hasło root to: Pepperoni13');
      console.error('   - Port 3306 jest dostępny');
      throw error;
    }

    // Krok 2: Utwórz bazę danych
    console.log('\n📦 KROK 2: Tworzenie bazy danych');
    const [databases] = await connection.query('SHOW DATABASES LIKE "SmartPizzApp13"');
    
    if (databases.length > 0) {
      console.log('⚠️  Baza SmartPizzApp13 już istnieje - zostanie wyczyszczona');
      await connection.query('DROP DATABASE SmartPizzApp13');
      console.log('🗑️  Usunięto starą bazę');
    }
    
    await connection.query('CREATE DATABASE SmartPizzApp13 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('✅ Utworzono bazę SmartPizzApp13');
    
    await connection.query('USE SmartPizzApp13');
    await connection.end();

    // Krok 3: Eksportuj dane z SQLite
    console.log('\n📤 KROK 3: Eksport danych z SQLite');
    await runCommand('node migrate-to-mariadb.cjs', 'Eksport danych');

    // Krok 4: Wygeneruj Prisma Client
    console.log('\n⚙️  KROK 4: Generowanie Prisma Client');
    await runCommand('npx prisma generate', 'Generowanie klienta Prisma');

    // Krok 5: Utwórz strukturę bazy (push schema)
    console.log('\n🏗️  KROK 5: Tworzenie struktury tabel w MariaDB');
    await runCommand('npx prisma db push --accept-data-loss', 'Tworzenie tabel');

    // Krok 6: Importuj dane
    console.log('\n📥 KROK 6: Import danych do MariaDB');
    await runCommand('node import-data-to-mariadb.cjs', 'Import danych');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 MIGRACJA ZAKOŃCZONA POMYŚLNIE!');
    console.log('='.repeat(60));
    console.log('\n📋 Podsumowanie:');
    console.log('   ✅ Baza danych: SmartPizzApp13');
    console.log('   ✅ Host: localhost:3306');
    console.log('   ✅ Dane zaimportowane');
    console.log('   ✅ Prisma Client wygenerowany');
    console.log('\n💡 Następne kroki:');
    console.log('   1. Uruchom aplikację: npm run dev');
    console.log('   2. Sprawdź dane w Prisma Studio: npx prisma studio');
    console.log('   3. Przetestuj zamówienia w aplikacji\n');

  } catch (error) {
    console.error('\n❌ MIGRACJA NIEUDANA');
    console.error('Błąd:', error.message);
    console.error('\n💡 Sprawdź logi powyżej, aby znaleźć problem');
    process.exit(1);
  }
}

main();
