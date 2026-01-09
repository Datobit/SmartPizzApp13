/**
 * Test połączenia z MariaDB
 */

const mysql = require('mysql2/promise');

const config = {
  host: 'localhost',
  user: 'root',
  password: 'Pepperoni13',
  port: 3306
};

async function testConnection() {
  console.log('[CONNECT] Testowanie połączenia z MariaDB...\n');
  
  try {
    const connection = await mysql.createConnection(config);
    console.log(' Połączenie udane!');
    
    const [rows] = await connection.query('SELECT VERSION() as version');
    console.log(`[STATS] Wersja: ${rows[0].version}`);
    
    const [databases] = await connection.query('SHOW DATABASES');
    console.log(`\n Dostępne bazy danych:`);
    databases.forEach(db => {
      const dbName = Object.values(db)[0];
      if (dbName === 'SmartPizzApp13') {
        console.log(`    ${dbName} (nasza baza)`);
      } else {
        console.log(`   - ${dbName}`);
      }
    });
    
    await connection.end();
    
    console.log('\n Test zakończony pomyślnie!');
    console.log('[TIP] MariaDB jest gotowa do migracji');
    
  } catch (error) {
    console.error(' Błąd połączenia:', error.message);
    console.error('\n[TIP] Sprawdź czy:');
    console.error('   - MariaDB jest uruchomiona');
    console.error('   - Hasło root to: Pepperoni13');
    console.error('   - Port 3306 jest dostępny');
    process.exit(1);
  }
}

testConnection();
