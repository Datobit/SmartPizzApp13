const Database = require('better-sqlite3');

async function testDirectInsert() {
  const db = new Database('./smartpizzapp13-T3.db');
  
  console.log('=== TEST BEZPOŚREDNIEGO ZAPISU DO TABELI ZAMÓWIENIA ===');
  
  try {
    // Test 1: Kwadratowe nawiasy
    console.log('\n1. Test z kwadratowymi nawiasami [Zamówienia]...');
    const stmt1 = db.prepare(`
      INSERT INTO [Zamówienia] (
        adres, telefon, pizza, sosy, dodatki, cena, platnosc, godzina_otrzymania, sosy_ile, rozmiar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result1 = stmt1.run(
      'Test Adres 1',
      123456789,
      1,
      2,
      'Test dodatki 1',
      45.50,
      'gotowka',
      new Date().toLocaleString('pl-PL'),
      2,
      'mala'
    );
    
    console.log('✅ Test 1 udany:', result1);
    
  } catch (error1) {
    console.log('❌ Test 1 nieudany:', error1.message);
    
    try {
      // Test 2: Backticks
      console.log('\n2. Test z backticks `Zamówienia`...');
      const stmt2 = db.prepare(`
        INSERT INTO \`Zamówienia\` (
          adres, telefon, pizza, sosy, dodatki, cena, platnosc, godzina_otrzymania, sosy_ile, rozmiar
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result2 = stmt2.run(
        'Test Adres 2',
        123456789,
        1,
        2,
        'Test dodatki 2',
        45.50,
        'gotowka',
        new Date().toLocaleString('pl-PL'),
        2,
        'mala'
      );
      
      console.log('✅ Test 2 udany:', result2);
      
    } catch (error2) {
      console.log('❌ Test 2 nieudany:', error2.message);
      
      try {
        // Test 3: Bez cudzysłowów
        console.log('\n3. Test bez cudzysłowów Zamówienia...');
        const stmt3 = db.prepare(`
          INSERT INTO Zamówienia (
            adres, telefon, pizza, sosy, dodatki, cena, platnosc, godzina_otrzymania, sosy_ile, rozmiar
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result3 = stmt3.run(
          'Test Adres 3',
          123456789,
          1,
          2,
          'Test dodatki 3',
          45.50,
          'gotowka',
          new Date().toLocaleString('pl-PL'),
          2,
          'mala'
        );
        
        console.log('✅ Test 3 udany:', result3);
        
      } catch (error3) {
        console.log('❌ Test 3 nieudany:', error3.message);
      }
    }
  }
  
  // Sprawdzmy ostatnie rekordy
  console.log('\n=== OSTATNIE REKORDY ===');
  const lastRecords = db.prepare('SELECT * FROM [Zamówienia] ORDER BY rowid DESC LIMIT 3').all();
  lastRecords.forEach((record, i) => {
    console.log(`${i + 1}. ${record.adres} - ${record.cena} PLN`);
  });
  
  db.close();
}

testDirectInsert().catch(console.error);