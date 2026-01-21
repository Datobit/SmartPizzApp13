const mysql = require('mysql2/promise');

async function clearTables() {
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
    
    // Sprawdź liczby rekordów przed usunięciem
    console.log('\n📊 Stan przed usunięciem:');
    const [zamowieniaCount] = await connection.execute('SELECT COUNT(*) as count FROM zamowienia');
    const [sesjeCount] = await connection.execute('SELECT COUNT(*) as count FROM sesje');
    const [transakcjeCount] = await connection.execute('SELECT COUNT(*) as count FROM transakcje');
    
    console.log(`   - Zamówienia: ${zamowieniaCount[0].count} rekordów`);
    console.log(`   - Sesje: ${sesjeCount[0].count} rekordów`);
    console.log(`   - Transakcje: ${transakcjeCount[0].count} rekordów`);
    
    // Wyłącz sprawdzanie kluczy obcych
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    // Wyczyść tabele
    console.log('\n🗑️  Czyszczenie tabel...');
    await connection.execute('DELETE FROM transakcje');
    console.log('✅ Tabela transakcje wyczyszczona');
    
    await connection.execute('DELETE FROM zamowienia');
    console.log('✅ Tabela zamowienia wyczyszczona');
    
    await connection.execute('DELETE FROM sesje');
    console.log('✅ Tabela sesje wyczyszczona');
    
    // Włącz z powrotem sprawdzanie kluczy obcych
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    // Sprawdź liczby rekordów po usunięciu
    console.log('\n📊 Stan po usunięciu:');
    const [zamowieniaCount2] = await connection.execute('SELECT COUNT(*) as count FROM zamowienia');
    const [sesjeCount2] = await connection.execute('SELECT COUNT(*) as count FROM sesje');
    const [transakcjeCount2] = await connection.execute('SELECT COUNT(*) as count FROM transakcje');
    
    console.log(`   - Zamówienia: ${zamowieniaCount2[0].count} rekordów`);
    console.log(`   - Sesje: ${sesjeCount2[0].count} rekordów`);
    console.log(`   - Transakcje: ${transakcjeCount2[0].count} rekordów`);
    
    console.log('\n✅ Wszystkie tabele wyczyszczone pomyślnie');
    
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
clearTables()
  .then(() => {
    console.log('✅ Operacja zakończona pomyślnie');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Operacja nie powiodła się:', error);
    process.exit(1);
  });
