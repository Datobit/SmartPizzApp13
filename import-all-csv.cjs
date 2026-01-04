const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Funkcja do konwersji daty z ISO do MySQL format
function convertDate(isoDate) {
  if (!isoDate) return null;
  // Usuń 'Z' i zamień 'T' na spację
  return isoDate.replace('Z', '').replace('T', ' ');
}

async function importCSV() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Pepperoni13',
    database: 'SmartPizzApp13',
    multipleStatements: true
  });

  try {
    console.log('🔌 Połączono z bazą danych\n');

    // Wyłącz foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Wyczyść istniejące dane
    console.log('🧹 Czyszczenie tabel...');
    await connection.query('TRUNCATE TABLE zamowienia');
    await connection.query('TRUNCATE TABLE transakcje');
    await connection.query('TRUNCATE TABLE sesje');
    await connection.query('TRUNCATE TABLE relacja_skladniki');
    await connection.query('TRUNCATE TABLE menu_pizza');
    await connection.query('TRUNCATE TABLE skladniki');
    await connection.query('TRUNCATE TABLE napoje');
    await connection.query('TRUNCATE TABLE pozycje_extra');
    await connection.query('TRUNCATE TABLE ulice');
    await connection.query('TRUNCATE TABLE dzielnice');
    await connection.query('TRUNCATE TABLE kierowcy');
    console.log('✅ Tabele wyczyszczone\n');

    const csvDir = path.join(__dirname, 'csv-export');

    // 1. Importuj dzielnice
    console.log('📥 Importowanie dzielnic...');
    const dzielnice = fs.readFileSync(path.join(csvDir, 'dzielnice.csv'), 'utf-8')
      .split('\n')
      .slice(1)
      .filter(line => line.trim())
      .map(line => {
        const [id, cena] = line.replace(/"/g, '').split(',');
        return [parseInt(id), parseFloat(cena)];
      });
    
    for (const [id, cena] of dzielnice) {
      await connection.query('INSERT INTO dzielnice (id, cena_dzielnica) VALUES (?, ?)', [id, cena]);
    }
    console.log(`✅ Zaimportowano ${dzielnice.length} dzielnic\n`);

    // 2. Importuj kierowców
    console.log('📥 Importowanie kierowców...');
    const kierowcy = fs.readFileSync(path.join(csvDir, 'kierowcy.csv'), 'utf-8')
      .split('\n')
      .slice(1)
      .filter(line => line.trim())
      .map(line => {
        const [id, nazwa] = line.replace(/"/g, '').split(',');
        return [parseInt(id), nazwa];
      });
    
    for (const [id, nazwa] of kierowcy) {
      await connection.query('INSERT INTO kierowcy (id, nazwa) VALUES (?, ?)', [id, nazwa]);
    }
    console.log(`✅ Zaimportowano ${kierowcy.length} kierowców\n`);

    // 3. Importuj ulice
    console.log('📥 Importowanie ulic...');
    const uliceContent = fs.readFileSync(path.join(csvDir, 'ulica.csv'), 'utf-8');
    const uliceLines = uliceContent.split('\n').slice(1).filter(line => line.trim());
    
    let uliceCount = 0;
    for (const line of uliceLines) {
      const match = line.match(/"([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)"/);
      if (match) {
        const [_, id, miejscowosc, ulica, numer, x, y, id_dzielnica, dzielnica_nazwa] = match;
        await connection.query(
          'INSERT INTO ulice (id, miejscowosc, ulica, numer, x, y, id_dzielnica, dzielnica_nazwa) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            parseInt(id) || null,
            miejscowosc || null,
            ulica || null,
            numer || null,
            x ? parseInt(x) : null,
            y ? parseInt(y) : null,
            id_dzielnica ? parseInt(id_dzielnica) : null,
            dzielnica_nazwa || null
          ]
        );
        uliceCount++;
      }
    }
    console.log(`✅ Zaimportowano ${uliceCount} ulic\n`);

    // 4. Importuj pizze
    console.log('📥 Importowanie pizz...');
    const pizze = fs.readFileSync(path.join(csvDir, 'menu_pizza.csv'), 'utf-8')
      .split('\n')
      .slice(1)
      .filter(line => line.trim())
      .map(line => {
        const [id, nazwa, cena_mala, cena_srednia, cena_duza] = line.replace(/"/g, '').split(',');
        return [parseInt(id), nazwa, parseFloat(cena_mala), parseFloat(cena_srednia), parseFloat(cena_duza)];
      });
    
    for (const [id, nazwa, cena_mala, cena_srednia, cena_duza] of pizze) {
      await connection.query(
        'INSERT INTO menu_pizza (id, nazwa, cena_mala, cena_srednia, cena_duza) VALUES (?, ?, ?, ?, ?)',
        [id, nazwa, cena_mala, cena_srednia, cena_duza]
      );
    }
    console.log(`✅ Zaimportowano ${pizze.length} pizz\n`);

    // 5. Importuj składniki
    console.log('📥 Importowanie składników...');
    const skladniki = fs.readFileSync(path.join(csvDir, 'skladniki.csv'), 'utf-8')
      .split('\n')
      .slice(1)
      .filter(line => line.trim())
      .map(line => {
        const [id, nazwa, cena_srednia, cena_duza] = line.replace(/"/g, '').split(',');
        return [parseInt(id), nazwa, parseFloat(cena_srednia), parseFloat(cena_duza)];
      });
    
    for (const [id, nazwa, cena_srednia, cena_duza] of skladniki) {
      await connection.query(
        'INSERT INTO skladniki (id, nazwa, cena_srednia, cena_duza) VALUES (?, ?, ?, ?)',
        [id, nazwa, cena_srednia, cena_duza]
      );
    }
    console.log(`✅ Zaimportowano ${skladniki.length} składników\n`);

    // 6. Importuj relacje pizza-składnik
    console.log('📥 Importowanie relacji pizza-składnik...');
    const pizzaSkladnik = fs.readFileSync(path.join(csvDir, 'pizza_skladnik.csv'), 'utf-8')
      .split('\n')
      .slice(1)
      .filter(line => line.trim())
      .map(line => {
        const [id_pizza, id_skladnik] = line.replace(/"/g, '').split(',');
        return [parseInt(id_pizza), parseInt(id_skladnik)];
      });
    
    for (const [id_pizza, id_skladnik] of pizzaSkladnik) {
      await connection.query(
        'INSERT INTO relacja_skladniki (id_pizza, id_skladnik) VALUES (?, ?)',
        [id_pizza, id_skladnik]
      );
    }
    console.log(`✅ Zaimportowano ${pizzaSkladnik.length} relacji pizza-składnik\n`);

    // 7. Importuj napoje
    console.log('📥 Importowanie napojów...');
    const napoje = fs.readFileSync(path.join(csvDir, 'napoje.csv'), 'utf-8')
      .split('\n')
      .slice(1)
      .filter(line => line.trim())
      .map(line => {
        const [id, nazwa, cena] = line.replace(/"/g, '').split(',');
        return [parseInt(id), nazwa, parseFloat(cena)];
      });
    
    for (const [id, nazwa, cena] of napoje) {
      await connection.query(
        'INSERT INTO napoje (id, nazwa, cena) VALUES (?, ?, ?)',
        [id, nazwa, cena]
      );
    }
    console.log(`✅ Zaimportowano ${napoje.length} napojów\n`);

    // 8. Importuj pozycje extra
    console.log('📥 Importowanie pozycji extra...');
    await connection.query('TRUNCATE TABLE pozycje_extra'); // Wyczyść wcześniej dodane
    const pozycjeExtra = fs.readFileSync(path.join(csvDir, 'pozycje_extra.csv'), 'utf-8')
      .split('\n')
      .slice(1)
      .filter(line => line.trim())
      .map(line => {
        const [id, nazwa, cena] = line.replace(/"/g, '').split(',');
        return [parseInt(id), nazwa, parseFloat(cena)];
      });
    
    for (const [id, nazwa, cena] of pozycjeExtra) {
      await connection.query(
        'INSERT INTO pozycje_extra (id, nazwa, cena) VALUES (?, ?, ?)',
        [id, nazwa, cena]
      );
    }
    console.log(`✅ Zaimportowano ${pozycjeExtra.length} pozycji extra\n`);

    // 9. Importuj sesje
    console.log('📥 Importowanie sesji...');
    const sesjeContent = fs.readFileSync(path.join(csvDir, 'sesje.csv'), 'utf-8');
    const sesjeLines = sesjeContent.split('\n').slice(1).filter(line => line.trim());
    
    let sesjeCount = 0;
    for (const line of sesjeLines) {
      // Parsowanie z uwzględnieniem podwójnych cudzysłowów w polach
      const parts = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++; // Pomiń następny cudzysłów
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          parts.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current);
      
      if (parts.length >= 6) {
        const [id, kierowca_id, data_otwarcia, data_zamkniecia, saldo_koncowe, status] = parts;
        await connection.query(
          'INSERT INTO sesje (id, kierowca_id, data_otwarcia, data_zamkniecia, saldo_koncowe, status) VALUES (?, ?, ?, ?, ?, ?)',
          [
            parseInt(id),
            parseInt(kierowca_id),
            convertDate(data_otwarcia),
            convertDate(data_zamkniecia),
            saldo_koncowe ? parseFloat(saldo_koncowe) : null,
            status
          ]
        );
        sesjeCount++;
      }
    }
    console.log(`✅ Zaimportowano ${sesjeCount} sesji\n`);

    // 10. Importuj transakcje
    console.log('📥 Importowanie transakcji...');
    const transakcjeContent = fs.readFileSync(path.join(csvDir, 'transakcje.csv'), 'utf-8');
    const transakcjeLines = transakcjeContent.split('\n').slice(1).filter(line => line.trim());
    
    let transakcjeCount = 0;
    for (const line of transakcjeLines) {
      const parts = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          parts.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current);
      
      if (parts.length >= 6) {
        const [id, sesja_id, typ, kwota, opis, data_utworzenia] = parts;
        await connection.query(
          'INSERT INTO transakcje (id, sesja_id, typ, kwota, opis, data_utworzenia) VALUES (?, ?, ?, ?, ?, ?)',
          [
            parseInt(id),
            parseInt(sesja_id),
            typ,
            parseFloat(kwota),
            opis || null,
            convertDate(data_utworzenia)
          ]
        );
        transakcjeCount++;
      }
    }
    console.log(`✅ Zaimportowano ${transakcjeCount} transakcji\n`);

    // 11. Importuj zamówienia
    console.log('📥 Importowanie zamówień...');
    const zamowieniaContent = fs.readFileSync(path.join(csvDir, 'zamowienia.csv'), 'utf-8');
    const zamowieniaLines = zamowieniaContent.split('\n').slice(1).filter(line => line.trim());
    
    let zamowieniaCount = 0;
    for (const line of zamowieniaLines) {
      const parts = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          parts.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current);
      
      if (parts.length >= 13) {
        const [id, telefon, adres, pizze, sosy, napoj, pozycje_extra, platnosc, cena_calkowita, created_at, is_kupony, typ_zamowienia, skladniki, sesja_id] = parts;
        
        await connection.query(
          'INSERT INTO zamowienia (id, telefon, adres, pizze, sosy, napoj, pozycje_extra, platnosc, cena_calkowita, created_at, is_kupony, typ_zamowienia, skladniki, sesja_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            parseInt(id),
            telefon || null,
            adres || null,
            pizze || null,
            sosy || null,
            napoj || null,
            pozycje_extra || null,
            platnosc || null,
            cena_calkowita ? parseFloat(cena_calkowita) : null,
            convertDate(created_at),
            is_kupony ? parseInt(is_kupony) : null,
            typ_zamowienia || null,
            skladniki || null,
            sesja_id ? parseInt(sesja_id) : null
          ]
        );
        zamowieniaCount++;
      }
    }
    console.log(`✅ Zaimportowano ${zamowieniaCount} zamówień\n`);

    // Włącz z powrotem foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('🎉 Import zakończony pomyślnie!');
    console.log('\n📊 Podsumowanie:');
    console.log(`- Dzielnice: ${dzielnice.length}`);
    console.log(`- Kierowcy: ${kierowcy.length}`);
    console.log(`- Ulice: ${uliceCount}`);
    console.log(`- Pizze: ${pizze.length}`);
    console.log(`- Składniki: ${skladniki.length}`);
    console.log(`- Pizza-składnik: ${pizzaSkladnik.length}`);
    console.log(`- Napoje: ${napoje.length}`);
    console.log(`- Pozycje extra: ${pozycjeExtra.length}`);
    console.log(`- Sesje: ${sesjeCount}`);
    console.log(`- Transakcje: ${transakcjeCount}`);
    console.log(`- Zamówienia: ${zamowieniaCount}`);

  } catch (error) {
    console.error('❌ Błąd podczas importu:', error);
  } finally {
    await connection.end();
  }
}

importCSV();
