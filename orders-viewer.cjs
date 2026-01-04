const mysql = require('mysql2/promise');
const path = require('path');
const http = require('http');
const url = require('url');
const querystring = require('querystring');
require('dotenv').config();

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;
  
  // Endpoint do pobierania statystyk klienta
  if (pathname === '/customer-stats' && req.method === 'GET') {
    const queryParams = querystring.parse(parsedUrl.query || '');
    const searchQuery = queryParams.query || '';
    
    if (!searchQuery) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Brak zapytania wyszukiwania' }));
      return;
    }
    
    let connection;
    try {
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Pepperoni13',
        database: 'SmartPizzApp13'
      });
      
      // Wyszukaj zamówienia pasujące do telefonu lub adresu
      const [orders] = await connection.execute(
        `SELECT z.*, k.nazwa as kierowca_nazwa 
         FROM zamowienia z
         LEFT JOIN sesje s ON z.sesja_id = s.id
         LEFT JOIN kierowcy k ON s.kierowca_id = k.id
         WHERE z.telefon LIKE ? OR z.adres LIKE ?
         ORDER BY z.created_at DESC`,
        [`%${searchQuery}%`, `%${searchQuery}%`]
      );
      
      // Pobierz nazwy pizz
      const [pizzas] = await connection.execute('SELECT * FROM menu_pizza');
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ orders, pizzas }));
      
      if (connection) await connection.end();
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
      if (connection) await connection.end();
    }
    return;
  }
  
  // Strona statystyk klientów
  if (pathname === '/customer-dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const dashboardHtml = require('fs').readFileSync(path.join(__dirname, 'customer-stats.html'), 'utf8');
    res.end(dashboardHtml);
    return;
  }
  
  // Obsługa aktualizacji zamówienia
  if (pathname === '/update-order' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      let connection;
      try {
        const data = querystring.parse(body);
        const orderId = parseInt(data.id);
        const platnosc = data.platnosc;
        const cena = data.cena ? parseFloat(data.cena) : null;
        const sesjaId = data.sesja_id ? parseInt(data.sesja_id) : null;
        const telefon = data.telefon || null;
        const adres = data.adres || null;
        
        connection = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: 'Pepperoni13',
          database: 'SmartPizzApp13'
        });
        
        // Pobierz aktualne dane zamówienia przed zmianami
        const [currentOrder] = await connection.execute(
          'SELECT sesja_id, platnosc, cena_calkowita, adres FROM zamowienia WHERE id = ?',
          [orderId]
        );
        
        if (currentOrder.length > 0) {
          const staraSesjaId = currentOrder[0].sesja_id;
          const staraPlatnosc = currentOrder[0].platnosc;
          const kwotaZamowienia = currentOrder[0].cena_calkowita;
          const adresZamowienia = currentOrder[0].adres;
          
          // === SPRAWDZANIE ZMIANY KIEROWCY ===
          if (sesjaId !== null) {
            const nowaSesjaId = sesjaId === -1 ? null : sesjaId;
            
            // Jeśli sesja się zmienia
            if (staraSesjaId !== nowaSesjaId) {
              // Usuń transakcję ze starej sesji (jeśli była)
              if (staraSesjaId) {
                await connection.execute(
                  `DELETE FROM transakcje 
                   WHERE sesja_id = ? 
                   AND typ = 'wplyw' 
                   AND kwota = ? 
                   AND opis LIKE ?
                   ORDER BY data_utworzenia DESC 
                   LIMIT 1`,
                  [staraSesjaId, kwotaZamowienia, `%${adresZamowienia}%`]
                );
                console.log(`Usunięto transakcję ze starej sesji ${staraSesjaId}`);
              }
              
              // Dodaj transakcję do nowej sesji (jeśli jest)
              if (nowaSesjaId) {
                await connection.execute(
                  'INSERT INTO transakcje (sesja_id, typ, kwota, forma_platnosci, opis) VALUES (?, ?, ?, ?, ?)',
                  [nowaSesjaId, 'wplyw', kwotaZamowienia, staraPlatnosc, `Zamówienie - ${adresZamowienia}`]
                );
                console.log(`Dodano transakcję do nowej sesji ${nowaSesjaId} (${staraPlatnosc})`);
              }
            }
          }
          
          // === SPRAWDZANIE ZMIANY TYPU PŁATNOŚCI ===
          if (platnosc && platnosc !== staraPlatnosc) {
            const aktualnaSesjaId = sesjaId !== null ? (sesjaId === -1 ? null : sesjaId) : staraSesjaId;
            
            // Jeśli jest przypisana sesja
            if (aktualnaSesjaId) {
              // Znajdź ID transakcji do aktualizacji
              const [transakcjeDoZmiany] = await connection.execute(
                `SELECT id FROM transakcje
                 WHERE sesja_id = ? 
                 AND typ = 'wplyw' 
                 AND kwota = ? 
                 AND opis LIKE ?
                 ORDER BY data_utworzenia DESC 
                 LIMIT 1`,
                [aktualnaSesjaId, kwotaZamowienia, `%${adresZamowienia}%`]
              );
              
              if (transakcjeDoZmiany.length > 0) {
                // Zaktualizuj formę płatności w istniejącej transakcji
                await connection.execute(
                  `UPDATE transakcje 
                   SET forma_platnosci = ?
                   WHERE id = ?`,
                  [platnosc, transakcjeDoZmiany[0].id]
                );
                console.log(`Zaktualizowano formę płatności na ${platnosc} dla transakcji ID ${transakcjeDoZmiany[0].id}`);
              } else {
                console.log(`Nie znaleziono transakcji do aktualizacji, tworzę nową`);
                // Jeśli nie znaleziono transakcji do aktualizacji, dodaj nową
                await connection.execute(
                  'INSERT INTO transakcje (sesja_id, typ, kwota, forma_platnosci, opis) VALUES (?, ?, ?, ?, ?)',
                  [aktualnaSesjaId, 'wplyw', kwotaZamowienia, platnosc, `Zamówienie - ${adresZamowienia}`]
                );
              }
            }
          }
        }
        
        // Buduj zapytanie dynamicznie
        let updateFields = [];
        let updateValues = [];
        
        if (platnosc) {
          updateFields.push('platnosc = ?');
          updateValues.push(platnosc);
        }
        
        if (cena !== null) {
          updateFields.push('cena_calkowita = ?');
          updateValues.push(cena);
        }
        
        if (sesjaId !== null) {
          updateFields.push('sesja_id = ?');
          updateValues.push(sesjaId === -1 ? null : sesjaId);
        }
        
        if (telefon !== null) {
          updateFields.push('telefon = ?');
          updateValues.push(telefon);
        }
        
        if (adres !== null) {
          updateFields.push('adres = ?');
          updateValues.push(adres);
        }
        
        updateValues.push(orderId);
        
        await connection.execute(
          `UPDATE zamowienia SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
        
        res.writeHead(302, { 'Location': '/' });
        res.end();
        
        if (connection) {
          await connection.end();
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Błąd aktualizacji</h1><p>${error.message}</p>`);
        if (connection) {
          await connection.end();
        }
      }
    });
    return;
  }
  
  // Obsługa usuwania zamówienia
  if (pathname === '/delete-order' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      let connection;
      try {
        const data = querystring.parse(body);
        const orderId = parseInt(data.id);
        
        connection = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: 'Pepperoni13',
          database: 'SmartPizzApp13'
        });
        
        await connection.execute(
          'DELETE FROM zamowienia WHERE id = ?',
          [orderId]
        );
        
        res.writeHead(302, { 'Location': '/' });
        res.end();
        
        if (connection) {
          await connection.end();
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Błąd usuwania</h1><p>${error.message}</p>`);
        if (connection) {
          await connection.end();
        }
      }
    });
    return;
  }
  
  // === ENDPOINTY DLA SESJI KIEROWCÓW ===
  
  // Strona zarządzania sesjami
  if (pathname === '/sesja') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const sesjaHtml = require('fs').readFileSync(path.join(__dirname, 'sesja.html'), 'utf8');
    res.end(sesjaHtml);
    return;
  }
  
  // Strona listy zakupów
  if (pathname === '/zakupy-lista') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const zakupyHtml = require('fs').readFileSync(path.join(__dirname, 'zakupy-lista.html'), 'utf8');
    res.end(zakupyHtml);
    return;
  }
  
  // API: Lista wszystkich kierowców
  if (pathname === '/api/kierowcy' && req.method === 'GET') {
    let connection;
    try {
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Pepperoni13',
        database: 'SmartPizzApp13'
      });
      
      const [kierowcy] = await connection.execute('SELECT * FROM kierowcy ORDER BY nazwa');
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(kierowcy));
      
      if (connection) await connection.end();
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
      if (connection) await connection.end();
    }
    return;
  }
  
  // API: Dodaj nowego kierowcę
  if (pathname === '/api/kierowcy' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      let connection;
      try {
        const data = JSON.parse(body);
        const nazwa = data.nazwa;
        
        if (!nazwa || nazwa.trim() === '') {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Nazwa kierowcy jest wymagana' }));
          return;
        }
        
        connection = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: 'Pepperoni13',
          database: 'SmartPizzApp13'
        });
        
        const [result] = await connection.execute(
          'INSERT INTO kierowcy (nazwa) VALUES (?)',
          [nazwa.trim()]
        );
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ id: result.insertId, nazwa: nazwa.trim() }));
        
        if (connection) await connection.end();
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: error.message }));
        if (connection) await connection.end();
      }
    });
    return;
  }
  
  // API: Pobierz aktywne sesje
  if (pathname === '/api/sesje/aktywne' && req.method === 'GET') {
    let connection;
    try {
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Pepperoni13',
        database: 'SmartPizzApp13'
      });
      
      const [sesje] = await connection.execute(
        `SELECT s.*, k.nazwa as kierowca_nazwa 
         FROM sesje s
         JOIN kierowcy k ON s.kierowca_id = k.id
         WHERE s.status = 'otwarta'
         ORDER BY s.data_otwarcia DESC`
      );
      
      // Dla każdej sesji policz saldo
      for (let sesja of sesje) {
        const [transakcje] = await connection.execute(
          'SELECT typ, kwota, forma_platnosci FROM transakcje WHERE sesja_id = ?',
          [sesja.id]
        );
        
        let saldo = 0;
        for (let t of transakcje) {
          // Transakcje kartą nie wliczają się do salda
          if (t.forma_platnosci === 'karta') {
            continue;
          }
          
          if (t.typ === 'wplyw') {
            saldo += parseFloat(t.kwota);
          } else {
            saldo -= parseFloat(t.kwota);
          }
        }
        sesja.saldo_aktualne = saldo;
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(sesje));
      
      if (connection) await connection.end();
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
      if (connection) await connection.end();
    }
    return;
  }
  
  // API: Otwórz nową sesję
  if (pathname === '/api/sesje/otworz' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      let connection;
      try {
        const data = JSON.parse(body);
        const kierowcaId = data.kierowca_id;
        
        if (!kierowcaId) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'ID kierowcy jest wymagane' }));
          return;
        }
        
        connection = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: 'Pepperoni13',
          database: 'SmartPizzApp13'
        });
        
        // Sprawdź czy kierowca nie ma już otwartej sesji
        const [existing] = await connection.execute(
          'SELECT * FROM sesje WHERE kierowca_id = ? AND status = "otwarta"',
          [kierowcaId]
        );
        
        if (existing.length > 0) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Kierowca ma już otwartą sesję' }));
          if (connection) await connection.end();
          return;
        }
        
        const [result] = await connection.execute(
          'INSERT INTO sesje (kierowca_id, status) VALUES (?, "otwarta")',
          [kierowcaId]
        );
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ id: result.insertId }));
        
        if (connection) await connection.end();
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: error.message }));
        if (connection) await connection.end();
      }
    });
    return;
  }
  
  // API: Zamknij sesję
  if (pathname === '/api/sesje/zamknij' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      let connection;
      try {
        const data = JSON.parse(body);
        const sesjaId = data.sesja_id;
        
        if (!sesjaId) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'ID sesji jest wymagane' }));
          return;
        }
        
        connection = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: 'Pepperoni13',
          database: 'SmartPizzApp13'
        });
        
        // Oblicz saldo końcowe
        const [transakcje] = await connection.execute(
          'SELECT typ, kwota, forma_platnosci FROM transakcje WHERE sesja_id = ?',
          [sesjaId]
        );
        
        let saldo = 0;
        for (let t of transakcje) {
          // Transakcje kartą nie wliczają się do salda
          if (t.forma_platnosci === 'karta') {
            continue;
          }
          
          if (t.typ === 'wplyw') {
            saldo += parseFloat(t.kwota);
          } else {
            saldo -= parseFloat(t.kwota);
          }
        }
        
        await connection.execute(
          'UPDATE sesje SET status = "zamknieta", data_zamkniecia = NOW(), saldo_koncowe = ? WHERE id = ?',
          [saldo, sesjaId]
        );
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ saldo_koncowe: saldo }));
        
        if (connection) await connection.end();
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: error.message }));
        if (connection) await connection.end();
      }
    });
    return;
  }
  
  // API: Dodaj transakcję
  if (pathname === '/api/transakcje' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      let connection;
      try {
        const data = JSON.parse(body);
        const { sesja_id, typ, kwota, opis } = data;
        
        if (!sesja_id || !typ || !kwota) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Wszystkie pola są wymagane' }));
          return;
        }
        
        if (typ !== 'wplyw' && typ !== 'wydatek') {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Typ musi być "wplyw" lub "wydatek"' }));
          return;
        }
        
        connection = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: 'Pepperoni13',
          database: 'SmartPizzApp13'
        });
        
        const [result] = await connection.execute(
          'INSERT INTO transakcje (sesja_id, typ, kwota, forma_platnosci, opis) VALUES (?, ?, ?, ?, ?)',
          [sesja_id, typ, kwota, 'manualny', opis || null]
        );
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ id: result.insertId }));
        
        if (connection) await connection.end();
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: error.message }));
        if (connection) await connection.end();
      }
    });
    return;
  }
  
  // API: Historia zamkniętych sesji
  if (pathname === '/api/sesje/historia' && req.method === 'GET') {
    let connection;
    try {
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Pepperoni13',
        database: 'SmartPizzApp13'
      });
      
      const [sesje] = await connection.execute(
        `SELECT s.*, k.nazwa as kierowca_nazwa 
         FROM sesje s
         JOIN kierowcy k ON s.kierowca_id = k.id
         WHERE s.status = 'zamknieta'
         ORDER BY s.data_zamkniecia DESC
         LIMIT 50`
      );
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(sesje));
      
      if (connection) await connection.end();
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
      if (connection) await connection.end();
    }
    return;
  }
  
  // API: Transakcje dla sesji
  if (pathname.startsWith('/api/sesje/') && pathname.includes('/transakcje') && req.method === 'GET') {
    const sesjaId = pathname.split('/')[3];
    let connection;
    try {
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Pepperoni13',
        database: 'SmartPizzApp13'
      });
      
      const [transakcje] = await connection.execute(
        'SELECT * FROM transakcje WHERE sesja_id = ? ORDER BY data_utworzenia ASC',
        [sesjaId]
      );
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(transakcje));
      
      if (connection) await connection.end();
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
      if (connection) await connection.end();
    }
    return;
  }
  
  // === KONIEC ENDPOINTÓW DLA SESJI ===
  
  // Główna strona
  res.writeHead(200, { 
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });

  let connection;
  try {
    // Pobierz parametry z URL
    const queryParams = querystring.parse(parsedUrl.query || '');
    const limit = parseInt(queryParams.limit) || 50;
    const search = queryParams.search || '';
    const dateFilter = queryParams.dateFilter || '';
    
    // Połącz z MariaDB
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Pepperoni13',
      database: 'SmartPizzApp13'
    });
    
    // Buduj zapytanie SQL
    let query = `SELECT z.*, k.nazwa as kierowca_nazwa 
                 FROM zamowienia z
                 LEFT JOIN sesje s ON z.sesja_id = s.id
                 LEFT JOIN kierowcy k ON s.kierowca_id = k.id
                 WHERE 1=1`;
    const params = [];
    
    // Filtr daty (dzisiejsza data)
    if (dateFilter === 'today') {
      query += ' AND DATE(created_at) = CURDATE()';
    }
    
    // Filtr wyszukiwania - szuka w całej historii
    if (search) {
      query += ` AND (
        telefon LIKE ? OR 
        adres LIKE ? OR 
        pizze LIKE ? OR 
        platnosc LIKE ? OR 
        skladniki LIKE ? OR
        CAST(id AS CHAR) LIKE ? OR
        CAST(cena_calkowita AS CHAR) LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    query += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);
    
    // Pobierz zamówienia
    const [orders] = await connection.execute(query, params);
    
    // Pobierz również dane pizz i napojów do wyświetlania nazw
    const [pizzas] = await connection.execute('SELECT * FROM menu_pizza');
    const [napoje] = await connection.execute('SELECT * FROM napoje');
    
    // Helper function do formatowania informacji o pizzach
    const formatPizzaInfo = (pizzeJson) => {
      if (!pizzeJson) return '-';
      try {
        const pizzeArray = JSON.parse(pizzeJson);
        return pizzeArray.map(pizza => {
          const pizzaData = pizzas.find(p => p.id === pizza.id);
          if (!pizzaData) return `Pizza ID:${pizza.id} (${pizza.rozmiar})`;
          
          let result = `${pizzaData.nazwa} - ${pizza.rozmiar}`;
          if (pizza.polNaPol) {
            const drugaPizza = pizzas.find(p => p.id === pizza.polNaPol.id);
            if (drugaPizza) {
              result = `${pizzaData.nazwa} / ${drugaPizza.nazwa} (pół na pół) - ${pizza.rozmiar}`;
            }
          }
          return result;
        }).join('<br>');
      } catch (e) {
        return pizzeJson;
      }
    };
    
    // Helper function do formatowania nazwy napoju
    const formatNapojInfo = (napojId) => {
      if (!napojId) return '-';
      const napojData = napoje.find(n => n.id == napojId);
      return napojData ? napojData.nazwa : `Napój ID:${napojId}`;
    };
    
    // Helper function do formatowania czasu
    const formatPolishTime = (dateString) => {
      if (!dateString) return '-';
      try {
        // Jeśli to już polski czas lokalny, wyświetlaj bezpośrednio
        const date = new Date(dateString);
        return date.toLocaleString('pl-PL');
      } catch (e) {
        return dateString;
      }
    };
    
    // Helper function do formatowania typu zamówienia
    const formatTypZamowienia = (typ) => {
      if (!typ) return '-';
      switch(typ) {
        case 'na_miejscu': return 'Na miejscu';
        case 'na_wynos': return 'Na wynos';
        case 'dowoz': return 'Dowóz';
        default: return typ;
      }
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Zamówienia Pizza</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .refresh-btn { 
      background: #007bff; 
      color: white; 
      padding: 10px 20px; 
      border: none; 
      border-radius: 5px; 
      cursor: pointer; 
      margin-bottom: 20px;
    }
    .filters-container {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      gap: 15px;
      align-items: center;
      flex-wrap: wrap;
    }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .filter-group label {
      font-weight: bold;
      font-size: 14px;
      color: #333;
    }
    .filter-group select,
    .filter-group input {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 14px;
    }
    .search-input {
      width: 300px;
    }
    .apply-btn {
      background: #28a745;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-weight: bold;
      margin-top: 20px;
    }
    .apply-btn:hover {
      background: #218838;
    }
    .edit-btn {
      background: #28a745;
      color: white;
      padding: 5px 10px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      margin-bottom: 3px;
    }
    .edit-btn:hover {
      background: #218838;
    }
    .delete-btn {
      background: #dc3545;
      color: white;
      padding: 5px 10px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    .delete-btn:hover {
      background: #c82333;
    }
    .save-btn {
      background: #007bff;
      color: white;
      padding: 5px 10px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      margin-right: 5px;
    }
    .cancel-btn {
      background: #6c757d;
      color: white;
      padding: 5px 10px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    .editable-cell {
      position: relative;
    }
    select.payment-select {
      padding: 5px;
      font-size: 14px;
      border: 1px solid #ddd;
      border-radius: 3px;
      width: 100%;
      margin-bottom: 5px;
    }
    input.edit-input {
      padding: 5px;
      font-size: 14px;
      border: 1px solid #ddd;
      border-radius: 3px;
      width: 100%;
      margin-bottom: 5px;
    }
  </style>
  <script>
    let kierowcyList = [];
    
    // Załaduj listę kierowców na start
    async function loadKierowcy() {
      try {
        const response = await fetch('/api/kierowcy');
        kierowcyList = await response.json();
      } catch (error) {
        console.error('Błąd ładowania kierowców:', error);
      }
    }
    
    loadKierowcy();
    
    function editOrder(orderId, currentPayment, currentPrice, currentKierowca, currentSesjaId, currentTelefon, currentAdres) {
      const telefonCell = document.getElementById('telefon-' + orderId);
      const adresCell = document.getElementById('adres-' + orderId);
      const priceCell = document.getElementById('price-' + orderId);
      const paymentCell = document.getElementById('payment-' + orderId);
      const kierowcaCell = document.getElementById('kierowca-' + orderId);
      const actionsCell = document.getElementById('actions-' + orderId);
      
      // Edycja telefonu
      telefonCell.innerHTML = \`
        <input type="text" id="telefon-input-\${orderId}" class="edit-input" value="\${currentTelefon}">
      \`;
      
      // Edycja adresu
      adresCell.innerHTML = \`
        <input type="text" id="adres-input-\${orderId}" class="edit-input" value="\${currentAdres}">
      \`;
      
      // Edycja ceny
      priceCell.innerHTML = \`
        <input type="number" id="price-input-\${orderId}" class="edit-input" value="\${currentPrice}" step="0.01" min="0">
      \`;
      
      // Edycja płatności
      const paymentSelect = document.createElement('select');
      paymentSelect.id = 'payment-select-' + orderId;
      paymentSelect.className = 'payment-select';
      paymentSelect.innerHTML = \`
        <option value="gotowka" \${currentPayment === 'gotowka' ? 'selected' : ''}>Gotówka</option>
        <option value="karta" \${currentPayment === 'karta' ? 'selected' : ''}>Karta</option>
      \`;
      paymentCell.innerHTML = '';
      paymentCell.appendChild(paymentSelect);
      
      // Edycja kierowcy
      const kierowcaSelect = document.createElement('select');
      kierowcaSelect.id = 'kierowca-select-' + orderId;
      kierowcaSelect.className = 'payment-select';
      kierowcaSelect.innerHTML = '<option value="-1">-- Brak --</option>';
      
      // Pobierz aktywne sesje dla dropdownu kierowców
      fetch('/api/sesje/aktywne')
        .then(res => res.json())
        .then(sesje => {
          sesje.forEach(sesja => {
            const selected = currentSesjaId === sesja.id ? 'selected' : '';
            kierowcaSelect.innerHTML += \`<option value="\${sesja.id}" \${selected}>\${sesja.kierowca_nazwa}</option>\`;
          });
        });
      
      kierowcaCell.innerHTML = '';
      kierowcaCell.appendChild(kierowcaSelect);
      
      // Przyciski zapisz i anuluj
      actionsCell.innerHTML = \`
        <button class="save-btn" onclick="saveOrder(\${orderId})">💾 Zapisz</button>
        <button class="cancel-btn" onclick="location.reload()">✖ Anuluj</button>
      \`;
    }
    
    function saveOrder(orderId) {
      const telefonInput = document.getElementById('telefon-input-' + orderId);
      const adresInput = document.getElementById('adres-input-' + orderId);
      const priceInput = document.getElementById('price-input-' + orderId);
      const paymentSelect = document.getElementById('payment-select-' + orderId);
      const kierowcaSelect = document.getElementById('kierowca-select-' + orderId);
      
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/update-order';
      
      const idInput = document.createElement('input');
      idInput.type = 'hidden';
      idInput.name = 'id';
      idInput.value = orderId;
      
      const telefonHiddenInput = document.createElement('input');
      telefonHiddenInput.type = 'hidden';
      telefonHiddenInput.name = 'telefon';
      telefonHiddenInput.value = telefonInput.value;
      
      const adresHiddenInput = document.createElement('input');
      adresHiddenInput.type = 'hidden';
      adresHiddenInput.name = 'adres';
      adresHiddenInput.value = adresInput.value;
      
      const priceHiddenInput = document.createElement('input');
      priceHiddenInput.type = 'hidden';
      priceHiddenInput.name = 'cena';
      priceHiddenInput.value = priceInput.value;
      
      const paymentInput = document.createElement('input');
      paymentInput.type = 'hidden';
      paymentInput.name = 'platnosc';
      paymentInput.value = paymentSelect.value;
      
      const sesjaInput = document.createElement('input');
      sesjaInput.type = 'hidden';
      sesjaInput.name = 'sesja_id';
      sesjaInput.value = kierowcaSelect.value;
      
      form.appendChild(idInput);
      form.appendChild(telefonHiddenInput);
      form.appendChild(adresHiddenInput);
      form.appendChild(priceHiddenInput);
      form.appendChild(paymentInput);
      form.appendChild(sesjaInput);
      document.body.appendChild(form);
      form.submit();
    }
    
    function deleteOrder(orderId) {
      if (!confirm('Czy na pewno chcesz usunąć to zamówienie?')) {
        return;
      }
      
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/delete-order';
      
      const idInput = document.createElement('input');
      idInput.type = 'hidden';
      idInput.name = 'id';
      idInput.value = orderId;
      
      form.appendChild(idInput);
      document.body.appendChild(form);
      form.submit();
    }
    function applyFilters() {
      const limit = document.getElementById('limitSelect').value;
      const search = document.getElementById('searchInput').value;
      const dateFilter = document.getElementById('dateFilter').value;
      
      let url = '/?limit=' + limit;
      if (search) url += '&search=' + encodeURIComponent(search);
      if (dateFilter) url += '&dateFilter=' + dateFilter;
      
      window.location.href = url;
    }
    
    function resetFilters() {
      window.location.href = '/';
    }
  </script>
</head>
<body>
  <h1>🍕 Zamówienia Pizza App</h1>
  
  <div style="display: flex; gap: 10px; margin-bottom: 20px;">
    <button class="apply-btn" onclick="window.location.href='/customer-dashboard'">
      📊 Statystyki Klientów
    </button>
    <button class="apply-btn" onclick="window.location.href='/sesja'" style="background: #10b981;">
      💼 SESJA
    </button>
    <button class="apply-btn" onclick="window.location.href='/zakupy-lista'" style="background: #f59e0b;">
      🛒 Lista zakupów
    </button>
  </div>
  
  <div class="filters-container">
    <div class="filter-group">
      <label for="dateFilter">Zakres dat:</label>
      <select id="dateFilter">
        <option value="" ${dateFilter === '' ? 'selected' : ''}>Wszystkie</option>
        <option value="today" ${dateFilter === 'today' ? 'selected' : ''}>Dzisiejsze</option>
      </select>
    </div>
    
    <div class="filter-group">
      <label for="limitSelect">Liczba rekordów:</label>
      <select id="limitSelect">
        <option value="25" ${limit === 25 ? 'selected' : ''}>25 ostatnich</option>
        <option value="50" ${limit === 50 ? 'selected' : ''}>50 ostatnich</option>
        <option value="75" ${limit === 75 ? 'selected' : ''}>75 ostatnich</option>
        <option value="100" ${limit === 100 ? 'selected' : ''}>100 ostatnich</option>
        <option value="200" ${limit === 200 ? 'selected' : ''}>200 ostatnich</option>
      </select>
    </div>
    
    <div class="filter-group">
      <label for="searchInput">Wyszukiwarka:</label>
      <input type="text" id="searchInput" class="search-input" placeholder="Szukaj w całej historii..." value="${search}">
    </div>
    
    <div class="filter-group">
      <label>&nbsp;</label>
      <button class="apply-btn" onclick="applyFilters()">🔍 Zastosuj filtry</button>
    </div>
    
    <div class="filter-group">
      <label>&nbsp;</label>
      <button class="refresh-btn" onclick="resetFilters()">🔄 Resetuj</button>
    </div>
  </div>
  
  <p><strong>Wyświetlono zamówień:</strong> ${orders.length} ${search ? `(wyszukiwanie: "${search}")` : ''} ${dateFilter === 'today' ? '(tylko dzisiejsze)' : ''}</p>
  
  <table>
    <tr>
      <th style="width: 50px;">ID</th>
      <th style="width: 100px;">Typ</th>
      <th style="width: 100px;">Telefon</th>
      <th style="width: 150px;">Adres</th>
      <th style="width: 60px;">Kupony</th>
      <th style="width: 250px;">Pizze (szczegóły)</th>
      <th style="width: 200px;">Modyfikacje składników</th>
      <th style="width: 100px;">Sosy</th>
      <th style="width: 120px;">Napój</th>
      <th style="width: 120px;">Dodatki</th>
      <th style="width: 80px;">Cena</th>
      <th style="width: 100px;">Płatność</th>
      <th style="width: 100px;">Kierowca</th>
      <th style="width: 140px;">Data</th>
      <th style="width: 80px;">Akcje</th>
    </tr>
    ${orders.map((order, i) => `
    <tr id="row-${order.id}" style="vertical-align: top;">
      <td>${order.id || order.rowid || '-'}</td>
      <td>${formatTypZamowienia(order.typ_zamowienia)}</td>
      <td id="telefon-${order.id}" class="editable-cell">${order.telefon || '-'}</td>
      <td id="adres-${order.id}" class="editable-cell">${order.adres || '-'}</td>
      <td>${(typeof order.is_kupony !== 'undefined' && order.is_kupony === 1) ? 'KUPONY' : '-'}</td>
      <td style="max-width: 250px; word-wrap: break-word;">${formatPizzaInfo(order.pizze || order.pizza)}</td>
      <td style="max-width: 200px; word-wrap: break-word; font-size: 12px;">${order.skladniki || '-'}</td>
      <td>${order.sosy || '-'}</td>
      <td>${formatNapojInfo(order.napoj)}</td>
      <td>${order.pozycje_extra || order.dodatki || '-'}</td>
      <td id="price-${order.id}" class="editable-cell">${order.cena_calkowita || order.cena || '-'} PLN</td>
      <td id="payment-${order.id}" class="editable-cell">
        ${order.platnosc || '-'}
      </td>
      <td id="kierowca-${order.id}" class="editable-cell">${order.kierowca_nazwa || '-'}</td>
      <td>${formatPolishTime(order.created_at || order.godzina_otrzymania)}</td>
      <td id="actions-${order.id}" style="white-space: nowrap;">
        <button class="edit-btn" onclick="editOrder(${order.id}, '${order.platnosc || ''}', ${order.cena_calkowita || order.cena || 0}, '${order.kierowca_nazwa || ''}', ${order.sesja_id || 'null'}, '${(order.telefon || '').replace(/'/g, "\\\\'")}', '${(order.adres || '').replace(/'/g, "\\\\'").replace(/\n/g, ' ')}')">✏️ Edytuj</button>
        <button class="delete-btn" onclick="deleteOrder(${order.id})">🗑️ Usuń</button>
      </td>
    </tr>
    `).join('')}
  </table>
  
  <br>
  <p style="color: #666; font-size: 12px;">
    Ostatnia aktualizacja: ${new Date().toLocaleString('pl-PL')}
  </p>
</body>
</html>`;

    res.end(html);
    
    if (connection) {
      await connection.end();
    }
  } catch (error) {
    res.end(`<h1>Błąd</h1><p>${error.message}</p>`);
    if (connection) {
      await connection.end();
    }
  }
});

const PORT = 3006;
server.listen(PORT, () => {
  console.log(`🍕 Serwer zamówień działa na http://localhost:${PORT}`);
});
//