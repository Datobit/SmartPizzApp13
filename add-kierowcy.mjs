import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Pepperoni13',
    database: 'SmartPizzApp13'
  });

  try {
    // Sprawdź czy kierowcy już istnieją
    const [existing] = await connection.execute('SELECT * FROM kierowcy');
    console.log('Istniejący kierowcy:', existing);

    if (existing.length === 0) {
      // Dodaj początkowych kierowców
      const kierowcy = ['Tobiasz', 'Mateusz', 'Bocian'];
      
      for (const nazwa of kierowcy) {
        await connection.execute(
          'INSERT INTO kierowcy (nazwa) VALUES (?)',
          [nazwa]
        );
        console.log(`✅ Dodano kierowcę: ${nazwa}`);
      }
      
      console.log('\n✅ Wszyscy kierowcy dodani pomyślnie!');
    } else {
      console.log('\n✅ Kierowcy już istnieją w bazie');
    }
    
    // Pokaż wszystkich kierowców
    const [all] = await connection.execute('SELECT * FROM kierowcy');
    console.log('\nLista kierowców:');
    all.forEach(k => console.log(`  ${k.id}. ${k.nazwa}`));
    
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
