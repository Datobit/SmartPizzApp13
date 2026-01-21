const mysql = require('mysql2/promise');

async function updateDzielnicaNazwa() {
  let connection;
  
  try {
    console.log('🔄 Łączenie z bazą danych...');
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'Pepperoni13',
      database: 'SmartPizzApp13'
    });
    
    console.log('✅ Połączono z bazą danych');
    
    // Sprawdź ile rekordów ma NULL w dzielnica_nazwa
    const [nullCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM ulice WHERE dzielnica_nazwa IS NULL'
    );
    console.log(`📊 Rekordów z NULL w dzielnica_nazwa: ${nullCount[0].count}`);
    
    // Zaktualizuj dzielnica_nazwa na podstawie id_dzielnica
    console.log('🔄 Aktualizowanie dzielnica_nazwa...');
    const [result] = await connection.execute(`
      UPDATE ulice u
      INNER JOIN dzielnice d ON u.id_dzielnica = d.id
      SET u.dzielnica_nazwa = d.nazwa
      WHERE u.dzielnica_nazwa IS NULL
    `);
    
    console.log(`✅ Zaktualizowano ${result.affectedRows} rekordów`);
    
    // Sprawdź ponownie
    const [nullCountAfter] = await connection.execute(
      'SELECT COUNT(*) as count FROM ulice WHERE dzielnica_nazwa IS NULL'
    );
    console.log(`📊 Rekordów z NULL w dzielnica_nazwa po aktualizacji: ${nullCountAfter[0].count}`);
    
    // Pokaż przykładowe rekordy
    console.log('\n📋 Przykładowe rekordy po aktualizacji:');
    const [samples] = await connection.execute(
      "SELECT id, ulica, numer, dzielnica_nazwa, id_dzielnica FROM ulice WHERE ulica LIKE 'Pog%' LIMIT 5"
    );
    console.table(samples);
    
  } catch (error) {
    console.error('❌ Błąd:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Rozłączono z bazą danych');
    }
  }
}

// Uruchom funkcję
updateDzielnicaNazwa()
  .then(() => {
    console.log('✅ Operacja zakończona pomyślnie');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Operacja nie powiodła się:', error);
    process.exit(1);
  });
