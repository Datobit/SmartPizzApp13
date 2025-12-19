/**
 * Skrypt importu danych do MariaDB
 * Importuje dane wyeksportowane ze SQLite
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const config = {
  host: 'localhost',
  user: 'root',
  password: 'Pepperoni13',
  database: 'SmartPizzApp13',
  port: 3306,
  multipleStatements: true
};

async function importData() {
  let connection;
  
  try {
    console.log('🔌 Łączenie z MariaDB...');
    connection = await mysql.createConnection(config);
    console.log('✅ Połączono z bazą SmartPizzApp13\n');

    // Wczytaj plik SQL
    const sqlFile = path.join(__dirname, 'migration-data.sql');
    
    if (!fs.existsSync(sqlFile)) {
      throw new Error('Nie znaleziono pliku migration-data.sql. Uruchom najpierw migrate-to-mariadb.cjs');
    }

    console.log('📄 Wczytuję dane z migration-data.sql...');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('📥 Importuję dane do MariaDB...');
    await connection.query(sqlContent);

    console.log('✅ Import zakończony pomyślnie!\n');

    // Sprawdź ile danych zaimportowano
    const tables = ['menu_pizza', 'skladniki', 'relacja_skladniki', 'napoje', 'pozycje_extra', 'ulice', 'zamowienia'];
    
    console.log('📊 Podsumowanie:');
    for (const table of tables) {
      const [rows] = await connection.query(`SELECT COUNT(*) as count FROM \`${table}\``);
      console.log(`   ${table}: ${rows[0].count} rekordów`);
    }

    await connection.end();
    console.log('\n✅ Migracja zakończona pomyślnie!');
    console.log('💡 Możesz teraz uruchomić aplikację: npm run dev');
    
  } catch (error) {
    console.error('❌ Błąd:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

importData();
