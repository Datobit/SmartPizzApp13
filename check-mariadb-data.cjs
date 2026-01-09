const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkData() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Pepperoni13',
      database: 'SmartPizzApp13'
    });

    console.log(' Połączono z MariaDB\n');

    // Sprawdź wszystkie tabele
    const tables = ['menu_pizza', 'skladniki', 'relacja_skladniki', 'napoje', 'pozycje_extra', 'ulice', 'zamowienia'];

    for (const table of tables) {
      const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`[STATS] ${table}: ${rows[0].count} rekordów`);
      
      if (rows[0].count > 0 && rows[0].count <= 10) {
        const [data] = await connection.execute(`SELECT * FROM ${table} LIMIT 5`);
        console.log('   Przykładowe dane:', JSON.stringify(data[0], null, 2));
      }
      console.log('');
    }

    await connection.end();
  } catch (error) {
    console.error(' Błąd:', error.message);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

checkData();
