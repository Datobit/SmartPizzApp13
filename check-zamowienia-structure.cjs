const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkStructure() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Pepperoni13',
      database: 'SmartPizzApp13'
    });

    console.log('Struktura tabeli zamowienia:');
    const [columns] = await connection.execute("DESCRIBE zamowienia");
    columns.forEach(col => {
      console.log(`  ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key === 'PRI' ? 'PRIMARY KEY' : ''}`);
    });

    console.log('\nPrzykładowe dane:');
    const [rows] = await connection.execute("SELECT * FROM zamowienia LIMIT 2");
    console.log(rows);

    await connection.end();
  } catch (error) {
    console.error('Error:', error);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

checkStructure();
