/**
 * Skrypt inicjalizacji bazy MariaDB
 * Tworzy bazę danych i importuje dane
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const config = {
  host: 'localhost',
  user: 'root',
  password: 'Pepperoni13',
  port: 3306,
  multipleStatements: true
};

async function initializeDatabase() {
  let connection;
  
  try {
    console.log('[CONNECT] Łączenie z MariaDB...');
    connection = await mysql.createConnection(config);
    console.log(' Połączono z MariaDB\n');

    // Sprawdź czy baza istnieje
    const [databases] = await connection.query('SHOW DATABASES LIKE "SmartPizzApp13"');
    
    if (databases.length > 0) {
      console.log('  Baza danych SmartPizzApp13 już istnieje');
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      // W tym przypadku po prostu kontynuujemy
      console.log(' Kontynuowanie z istniejącą bazą...\n');
    } else {
      console.log(' Tworzenie bazy danych SmartPizzApp13...');
      await connection.query('CREATE DATABASE SmartPizzApp13 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
      console.log(' Baza danych utworzona\n');
    }

    // Przełącz się na bazę
    await connection.query('USE SmartPizzApp13');

    console.log('[LISTA] Struktura bazy zostanie utworzona przez Prisma');
    console.log('[TIP] Uruchom: npx prisma db push');
    console.log('[TIP] Następnie: node import-data-to-mariadb.cjs');

    await connection.end();
    console.log('\n Inicjalizacja zakończona pomyślnie!');
    
  } catch (error) {
    console.error(' Błąd:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

initializeDatabase();
