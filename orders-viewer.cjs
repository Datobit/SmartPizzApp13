const mysql = require('mysql2/promise');
const path = require('path');
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
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
  
  // === ENDPOINTY DLA KUCHNI ===
  
  // Strona kuchni
  if (pathname === '/kuchnia') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const kuchniaHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kuchnia - Organizacja Zamówień</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: white;
      margin-bottom: 30px;
      padding: 20px 30px;
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
    }
    
    .header > div:first-child {
      text-align: left;
    }
    
    .header h1 {
      font-size: 2.5em;
      font-weight: 800;
      margin-bottom: 8px;
      text-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    .header .subtitle {
      font-size: 1.1em;
      opacity: 0.9;
    }
    
    .orders-container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .order-card {
      background: white;
      border-radius: 16px;
      padding: 0;
      margin-bottom: 20px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      overflow: hidden;
    }
    
    .status-tabs {
      display: flex;
      background: #f3f4f6;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .status-tab {
      flex: 1;
      padding: 16px 20px;
      text-align: center;
      font-weight: 700;
      font-size: 0.95em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      border: none;
      background: transparent;
      color: #9ca3af;
    }
    
    .status-tab.active {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      box-shadow: inset 0 -3px 0 rgba(0,0,0,0.2);
    }
    
    .status-tab.active.in-progress {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }
    
    .status-tab.active.done {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }
    
    .order-content {
      padding: 20px;
    }
    
    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #f3f4f6;
    }
    
    .order-id {
      font-size: 1.5em;
      font-weight: 800;
      color: #1f2937;
    }
    
    .order-time {
      font-size: 0.9em;
      color: #6b7280;
      font-weight: 600;
    }
    
    .order-type {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 0.8em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    
    .order-type.dowoz {
      background: #dbeafe;
      color: #1e40af;
    }
    
    .order-type.na_wynos {
      background: #fed7aa;
      color: #92400e;
    }
    
    .order-type.na_miejscu {
      background: #d1fae5;
      color: #065f46;
    }
    
    .order-details {
      margin: 16px 0;
    }
    
    .detail-row {
      margin: 10px 0;
      font-size: 1em;
      color: #374151;
      line-height: 1.6;
    }
    
    .detail-label {
      font-weight: 700;
      color: #1f2937;
      display: inline-block;
      min-width: 90px;
    }
    
    .pizza-list {
      margin: 16px 0;
    }
    
    .pizza-item {
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
      padding: 12px 16px;
      margin: 8px 0;
      border-radius: 10px;
      border-left: 4px solid #8b5cf6;
      box-shadow: 0 2px 6px rgba(0,0,0,0.05);
    }
    
    .pizza-name {
      font-weight: 700;
      color: #1f2937;
      font-size: 1.1em;
    }
    
    .pizza-size {
      color: #6b7280;
      font-size: 0.9em;
      margin-left: 10px;
      font-weight: 600;
    }
    
    .modifications {
      margin-top: 8px;
      padding: 8px 12px;
      background: #fef3c7;
      border-radius: 6px;
      font-size: 0.9em;
      color: #92400e;
      border-left: 3px solid #f59e0b;
    }
    
    .modifications strong {
      color: #78350f;
      font-weight: 700;
    }
    
    .order-actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 2px solid #f3f4f6;
    }
    
    .action-btn {
      flex: 1;
      padding: 14px 20px;
      border: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 1em;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
    }
    
    .action-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
    }
    
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: white;
      font-size: 1.2em;
    }
    
    .empty-state-icon {
      font-size: 4em;
      margin-bottom: 16px;
    }
    
    .refresh-btn {
      background: white;
      border: none;
      color: #667eea;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 0.95em;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.2s ease;
      text-transform: none;
      letter-spacing: 0.3px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    
    .refresh-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.25);
      background: rgba(255,255,255,0.95);
    }
    
    .refresh-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    
    .refresh-indicator {
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      padding: 12px 24px;
      border-radius: 24px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.2);
      font-weight: 700;
      color: #667eea;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Panel Kuchni</h1>
      <p class="subtitle">System Organizacji Zamowien</p>
    </div>
    <div style="display: flex; gap: 12px; align-items: center;">
      <a href="http://localhost:3000" class="refresh-btn" style="text-decoration: none;">
        📝 Formularz Zamowienia
      </a>
      <button class="refresh-btn" onclick="loadOrders()">
        🔄 Odswież
      </button>
    </div>
  </div>
  
  <div class="orders-container" id="ordersContainer">
    <div class="empty-state">
      <div class="empty-state-icon">👨‍🍳</div>
      <p>Ladowanie zamowien...</p>
    </div>
  </div>
  
  <script>
    let lastUpdate = Date.now();
    
    async function loadOrders() {
      try {
        console.log('Ladowanie zamowien...');
        const response = await fetch('/api/kuchnia/zamowienia');
        const data = await response.json();
        console.log('Otrzymano zamowien:', data.orders.length);
        
        renderOrders(data.orders, data.pizzas);
        lastUpdate = Date.now();
      } catch (error) {
        console.error('Blad ladowania zamowien:', error);
        document.getElementById('ordersContainer').innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><p>Blad ladowania: ' + error.message + '</p></div>';
      }
    }
    
    function renderOrders(orders, pizzas) {
      const container = document.getElementById('ordersContainer');
      console.log('Renderowanie zamowien:', orders.length);
      
      // Filtruj tylko aktywne (nie gotowe) i sortuj chronologicznie
      const activeOrders = orders.filter(o => o.status_kuchnia !== 'gotowe');
      const sortedOrders = activeOrders.slice().sort((a, b) => a.id - b.id);
      console.log('Posortowane aktywne zamowienia:', sortedOrders.length);
      
      if (sortedOrders.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><p>Brak zamowien do przygotowania</p></div>';
        return;
      }
      
      try {
        container.innerHTML = sortedOrders.map(order => renderOrderCard(order, pizzas)).join('');
        console.log('Zamowienia wyrenderowane');
      } catch (error) {
        console.error('Blad renderowania:', error);
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><p>Blad: ' + error.message + '</p></div>';
      }
    }
    
    function renderOrderCard(order, pizzas) {
      try {
        const typeMap = { 'na_miejscu': 'Na miejscu', 'na_wynos': 'Na wynos', 'dowoz': 'Dowoz' };
        const orderTime = new Date(order.created_at).toLocaleTimeString('pl-PL');
        const currentStatus = order.status_kuchnia || 'do_przygotowania';
        
        let pizzaHtml = '';
        if (order.pizze) {
          try {
            const pizzeArray = JSON.parse(order.pizze);
            pizzaHtml = pizzeArray.map(pizza => {
              const pizzaData = pizzas.find(p => p.id === pizza.id);
              const pizzaName = pizzaData ? pizzaData.nazwa : 'Pizza ID:' + pizza.id;
              return '<div class="pizza-item"><span class="pizza-name">' + pizzaName + '</span><span class="pizza-size">[' + pizza.rozmiar + ']</span></div>';
            }).join('');
          } catch (e) {
            console.error('Blad parsowania pizze:', e);
            pizzaHtml = '<div class="pizza-item">Blad odczytu pizzy</div>';
          }
        }
        
        let modificationsHtml = '';
        if (order.skladniki && order.skladniki.trim() !== '') {
          modificationsHtml = '<div class="modifications"><strong>⚠️ Modyfikacje:</strong> ' + order.skladniki + '</div>';
        }
        
        let addressHtml = '';
        if (order.typ_zamowienia === 'dowoz') {
          addressHtml = '<div class="detail-row"><span class="detail-label">Telefon:</span> ' + (order.telefon || '-') + '</div>' +
                        '<div class="detail-row"><span class="detail-label">Adres:</span> ' + (order.adres || '-') + '</div>';
        }
        
        return '<div class="order-card">' +
          '<div class="status-tabs">' +
            '<button class="status-tab ' + (currentStatus === 'do_przygotowania' ? 'active' : '') + '" onclick="updateStatus(' + order.id + ', &apos;do_przygotowania&apos;)">Do przygotowania</button>' +
            '<button class="status-tab in-progress ' + (currentStatus === 'w_trakcie' ? 'active' : '') + '" onclick="updateStatus(' + order.id + ', &apos;w_trakcie&apos;)">W trakcie</button>' +
            '<button class="status-tab done ' + (currentStatus === 'gotowe' ? 'active' : '') + '" onclick="updateStatus(' + order.id + ', &apos;gotowe&apos;)">Gotowe</button>' +
          '</div>' +
          '<div class="order-content">' +
            '<div class="order-header">' +
              '<div class="order-id">#' + order.id + '</div>' +
              '<div class="order-time">' + orderTime + '</div>' +
            '</div>' +
            '<div class="order-type ' + order.typ_zamowienia + '">' + (typeMap[order.typ_zamowienia] || order.typ_zamowienia) + '</div>' +
            '<div class="order-details">' +
              addressHtml +
              '<div class="pizza-list">' + pizzaHtml + '</div>' +
              modificationsHtml +
              '<div class="detail-row"><span class="detail-label">Cena:</span> ' + order.cena_calkowita + ' PLN</div>' +
              '<div class="detail-row"><span class="detail-label">Platnosc:</span> ' + order.platnosc + '</div>' +
            '</div>' +
            '<div class="order-actions">' +
              '<button class="action-btn" onclick="printOrder(' + order.id + ')">Drukuj Paragon</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      } catch (error) {
        console.error('Blad renderowania karty zamowienia ID ' + order.id + ':', error);
        return '<div class="order-card"><div class="order-content">Blad: ' + error.message + '</div></div>';
      }
    }
    
    async function updateStatus(orderId, newStatus) {
      try {
        const response = await fetch('/api/kuchnia/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, status: newStatus })
        });
        
        if (response.ok) {
          loadOrders();
        } else {
          alert('Blad aktualizacji statusu');
        }
      } catch (error) {
        console.error('Blad:', error);
        alert('Blad polaczenia');
      }
    }
    
    async function printOrder(orderId) {
      try {
        const response = await fetch('/print-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: [orderId] })
        });
        
        const result = await response.json();
        if (response.ok) {
          alert('Paragon wydrukowany!');
        } else {
          alert('Blad drukowania: ' + result.error);
        }
      } catch (error) {
        console.error('Blad drukowania:', error);
        alert('Blad polaczenia z drukarką');
      }
    }
    
    // Initial load
    loadOrders();
  </script>
</body>
</html>
    `;
    res.end(kuchniaHtml);
    return;
  }
  
  // API: Pobierz zamówienia dla kuchni
  if (pathname === '/api/kuchnia/zamowienia' && req.method === 'GET') {
    let connection;
    try {
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Pepperoni13',
        database: 'SmartPizzApp13'
      });
      
      // Pobierz zamówienia z dzisiaj które nie są archiwalne (gotowe starsze niż 1h ukrywamy)
      const [orders] = await connection.execute(
        `SELECT z.* FROM zamowienia z 
         WHERE DATE(z.created_at) = CURDATE()
         AND (z.status_kuchnia != 'gotowe' OR z.updated_at > DATE_SUB(NOW(), INTERVAL 1 HOUR))
         ORDER BY 
           CASE z.status_kuchnia
             WHEN 'do_przygotowania' THEN 1
             WHEN 'w_trakcie' THEN 2
             WHEN 'gotowe' THEN 3
           END,
           z.created_at DESC`
      );
      
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
  
  // API: Aktualizuj status kuchni
  if (pathname === '/api/kuchnia/status' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      let connection;
      try {
        const data = JSON.parse(body);
        const { orderId, status } = data;
        
        if (!orderId || !status) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Brak wymaganych parametrów' }));
          return;
        }
        
        connection = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: 'Pepperoni13',
          database: 'SmartPizzApp13'
        });
        
        await connection.execute(
          'UPDATE zamowienia SET status_kuchnia = ?, updated_at = NOW() WHERE id = ?',
          [status, orderId]
        );
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
        
        if (connection) await connection.end();
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: error.message }));
        if (connection) await connection.end();
      }
    });
    return;
  }
  
  // === KONIEC ENDPOINTÓW DLA KUCHNI ===
  
  // Endpoint drukowania paragonów
  if (pathname === '/print-receipt' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      let connection;
      try {
        const data = JSON.parse(body);
        const orderIds = data.orderIds;
        
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Brak zamówień do wydruku' }));
          return;
        }
        
        connection = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: 'Pepperoni13',
          database: 'SmartPizzApp13'
        });
        
        // Pobierz zamówienia
        const placeholders = orderIds.map(() => '?').join(',');
        const [orders] = await connection.execute(
          `SELECT z.*, k.nazwa as kierowca_nazwa 
           FROM zamowienia z
           LEFT JOIN sesje s ON z.sesja_id = s.id
           LEFT JOIN kierowcy k ON s.kierowca_id = k.id
           WHERE z.id IN (${placeholders})`,
          orderIds
        );
        
        // Pobierz dane pizz i napojów
        const [pizzas] = await connection.execute('SELECT * FROM menu_pizza');
        const [napoje] = await connection.execute('SELECT * FROM napoje');
        const [pozycjeExtra] = await connection.execute('SELECT * FROM pozycje_extra');
        
        // Funkcja drukowania na drukarce USB
        const printReceipt = (order) => {
          return new Promise((resolve, reject) => {
            // Funkcja do konwersji polskich znaków na ASCII
            const toAscii = (text) => {
              if (!text) return text;
              return text
                .replace(/ą/g, 'a').replace(/Ą/g, 'A')
                .replace(/ć/g, 'c').replace(/Ć/g, 'C')
                .replace(/ę/g, 'e').replace(/Ę/g, 'E')
                .replace(/ł/g, 'l').replace(/Ł/g, 'L')
                .replace(/ń/g, 'n').replace(/Ń/g, 'N')
                .replace(/ó/g, 'o').replace(/Ó/g, 'O')
                .replace(/ś/g, 's').replace(/Ś/g, 'S')
                .replace(/ź/g, 'z').replace(/Ź/g, 'Z')
                .replace(/ż/g, 'z').replace(/Ż/g, 'Z');
            };
            
            // Ścieżka do drukarki USB Xprinter
            const printerPath = process.env.PRINTER_PORT || '/dev/usb/lp0';
            
            console.log(`Drukowanie na: ${printerPath}`);
            
            // Sprawdź czy drukarka istnieje
            if (!fs.existsSync(printerPath)) {
              const error = new Error(`Drukarka nie znaleziona: ${printerPath}`);
              console.error(error.message);
              console.error('Sprawdź:');
              console.error('1. Czy drukarka jest podłączona (sudo dmesg | grep -i xprinter)');
              console.error('2. Czy ścieżka jest poprawna (ustaw PRINTER_PORT w .env)');
              console.error('3. Czy masz uprawnienia: sudo chmod 666 ' + printerPath);
              reject(error);
              return;
            }
            
            // Komendy ESC/POS
            const ESC = 0x1B;
            const GS = 0x1D;
            const LF = 0x0A;
            const CENTER = [ESC, 0x61, 0x01]; // Wyśrodkowanie
            const LEFT = [ESC, 0x61, 0x00];   // Do lewej
            const BOLD_ON = [ESC, 0x45, 0x01]; // Pogrubienie
            const BOLD_OFF = [ESC, 0x45, 0x00];
            const SIZE_NORMAL = [GS, 0x21, 0x00];
            const SIZE_DOUBLE = [GS, 0x21, 0x11]; // Podwójna wielkość
            const CUT = [GS, 0x56, 0x00]; // Ucięcie papieru
            
            // Przygotuj dane paragonu
            let receipt = [];
            
            // Inicjalizacja
            receipt.push(ESC, 0x40); // Reset drukarki
            
            // Nagłówek
            receipt.push(...CENTER, ...SIZE_DOUBLE, ...BOLD_ON);
            receipt.push(...Buffer.from('PizzApp13\n', 'utf-8'));
            receipt.push(...BOLD_OFF, ...SIZE_NORMAL);
            receipt.push(...Buffer.from('================================\n', 'utf-8'));
            
            // data
            const orderDate = new Date(order.created_at).toLocaleString('pl-PL');
            receipt.push(...Buffer.from(`Data: ${orderDate}\n`, 'utf-8'));
            receipt.push(...Buffer.from('================================\n', 'utf-8'));
            
            // Typ zamówienia
            const typMap = { 'na_miejscu': 'Na miejscu', 'na_wynos': 'Na wynos', 'dowoz': 'Dowoz' };
            receipt.push(...Buffer.from(`Typ: ${typMap[order.typ_zamowienia] || order.typ_zamowienia}\n`, 'utf-8'));
            
            // Telefon i adres (tylko dla dowozu)
            if (order.typ_zamowienia === 'dowoz') {
              receipt.push(...LEFT, ...SIZE_DOUBLE, ...BOLD_ON);
              receipt.push(...Buffer.from(toAscii(`Tel: ${order.telefon || '-'}\n`), 'utf-8'));
              receipt.push(LF);
              receipt.push(...BOLD_OFF, ...SIZE_NORMAL);
              receipt.push(...Buffer.from(toAscii(`Adres: ${order.adres || '-'}\n`), 'utf-8'));
            }
            receipt.push(...Buffer.from('================================\n', 'utf-8'));
            
            // Pizze
            if (order.pizze) {
              try {
                const pizzeArray = JSON.parse(order.pizze);
                receipt.push(...BOLD_ON);
                receipt.push(...Buffer.from('PIZZE:\n', 'utf-8'));
                receipt.push(...BOLD_OFF);
                pizzeArray.forEach((pizza) => {
                  const pizzaData = pizzas.find(p => p.id === pizza.id);
                  let pizzaName = pizzaData ? pizzaData.nazwa : `Pizza ID:${pizza.id}`;
                  if (pizza.polNaPol) {
                    const drugaPizza = pizzas.find(p => p.id === pizza.polNaPol.id);
                    if (drugaPizza) {
                      pizzaName = `${pizzaData.nazwa}/${drugaPizza.nazwa} (pol na pol)`;
                    }
                  }
                  receipt.push(...Buffer.from(toAscii(`  ${pizzaName}\n`), 'utf-8'));
                  receipt.push(...Buffer.from(toAscii(`    Rozmiar: ${pizza.rozmiar}\n`), 'utf-8'));
                });
              } catch (e) {}
            }
            
            // Modyfikacje składników
            if (order.skladniki) {
              receipt.push(...BOLD_ON);
              receipt.push(...Buffer.from('Modyfikacje:\n', 'utf-8'));
              receipt.push(...BOLD_OFF);
              receipt.push(...Buffer.from(toAscii(`  ${order.skladniki.replace(/<br>/g, '\n  ')}\n`), 'utf-8'));
            }
            
            // Sosy
            if (order.sosy) {
              try {
                const sosy = JSON.parse(order.sosy);
                if (sosy.pom > 0 || sosy.czos > 0) {
                  receipt.push(...BOLD_ON);
                  receipt.push(...Buffer.from('Sosy:\n', 'utf-8'));
                  receipt.push(...BOLD_OFF);
                  if (sosy.pom > 0) receipt.push(...Buffer.from(toAscii(`  Pomidorowy: ${sosy.pom}\n`), 'utf-8'));
                  if (sosy.czos > 0) receipt.push(...Buffer.from(toAscii(`  Czosnkowy: ${sosy.czos}\n`), 'utf-8'));
                }
              } catch (e) {}
            }
            
            // Napoje
            if (order.napoj) {
              try {
                const napojIds = JSON.parse(order.napoj);
                if (Array.isArray(napojIds) && napojIds.length > 0) {
                  receipt.push(...BOLD_ON);
                  receipt.push(...Buffer.from('Napoje:\n', 'utf-8'));
                  receipt.push(...BOLD_OFF);
                  napojIds.forEach(id => {
                    const napojData = napoje.find(n => n.id == id);
                    const napojName = napojData ? napojData.nazwa : `ID:${id}`;
                    receipt.push(...Buffer.from(toAscii(`  ${napojName}\n`), 'utf-8'));
                  });
                  receipt.push(LF);
                }
              } catch (e) {}
            }
            
            // Pozycje extra
            if (order.pozycje_extra) {
              try {
                const extraIds = JSON.parse(order.pozycje_extra);
                if (Array.isArray(extraIds) && extraIds.length > 0) {
                  receipt.push(...BOLD_ON);
                  receipt.push(...Buffer.from('Dodatki:\n', 'utf-8'));
                  receipt.push(...BOLD_OFF);
                  extraIds.forEach(id => {
                    const extraData = pozycjeExtra.find(e => e.id == id);
                    const extraName = extraData ? extraData.nazwa : `ID:${id}`;
                    receipt.push(...Buffer.from(toAscii(`  ${extraName}\n`), 'utf-8'));
                  });
                }
              } catch (e) {}
            }
            
            // Podsumowanie
            receipt.push(...Buffer.from('================================\n', 'utf-8'));
            receipt.push(...SIZE_DOUBLE, ...BOLD_ON);
            receipt.push(...Buffer.from(`SUMA: ${order.cena_calkowita} PLN\n`, 'utf-8'));
            receipt.push(...SIZE_NORMAL, ...BOLD_OFF);
            receipt.push(...Buffer.from(toAscii(`Platnosc: ${order.platnosc}\n`), 'utf-8'));
            if (order.is_kupony) {
              receipt.push(...Buffer.from('KUPONY\n', 'utf-8'));
            }
            if (order.kierowca_nazwa) {
              receipt.push(...Buffer.from(toAscii(`Kierowca: ${order.kierowca_nazwa}\n`), 'utf-8'));
            }
            receipt.push(...Buffer.from('================================\n', 'utf-8'));
            receipt.push(LF);
            
            // Stopka
            receipt.push(...CENTER);
            receipt.push(...Buffer.from('Smacznego!\n', 'utf-8'));
            receipt.push(LF, LF); // Kilka linii pustych (brak automatycznego cięcia)
            
            // Wyślij do drukarki USB
            try {
              const buffer = Buffer.from(receipt);
              fs.writeFileSync(printerPath, buffer);
              console.log(` Wydrukowano paragon dla zamówienia #${order.id}`);
              resolve();
            } catch (err) {
              console.error(' Błąd wysyłania do drukarki:', err.message);
              if (err.code === 'EACCES') {
                console.error('   Brak uprawnień! Wykonaj: sudo chmod 666 ' + printerPath);
              }
              reject(err);
            }
          });
        };
        
        // Drukuj każde zamówienie
        for (const order of orders) {
          try {
            await printReceipt(order);
          } catch (err) {
            console.error(`Błąd drukowania zamówienia #${order.id}:`, err.message);
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, printed: orders.length }));
        
        if (connection) await connection.end();
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: error.message }));
        if (connection) await connection.end();
      }
    });
    return;
  }
  
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
    const formatNapojInfo = (napojJson) => {
      if (!napojJson) return '-';
      try {
        // Sprawdź czy to JSON z tablicą ID
        const napojIds = JSON.parse(napojJson);
        if (Array.isArray(napojIds)) {
          if (napojIds.length === 0) return '-';
          return napojIds.map(id => {
            const napojData = napoje.find(n => n.id == id);
            return napojData ? napojData.nazwa : `ID:${id}`;
          }).join('<br>');
        }
        // Jeśli to pojedyncze ID (stary format)
        const napojData = napoje.find(n => n.id == napojIds);
        return napojData ? napojData.nazwa : `Napój ID:${napojIds}`;
      } catch (e) {
        // Jeśli nie jest JSON, zwróć jako tekst
        return napojJson;
      }
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
    
    // Helper function do formatowania sosów
    const formatSosyInfo = (sosyJson) => {
      if (!sosyJson) return '-';
      try {
        const sosy = JSON.parse(sosyJson);
        const lines = [];
        // Obsługa nowego formatu (pom, czos)
        if (sosy.pom !== undefined) lines.push(`pom: ${sosy.pom}`);
        if (sosy.czos !== undefined) lines.push(`czos: ${sosy.czos}`);
        // Obsługa starego formatu (pomidorowy, czosnkowy) - dla kompatybilności wstecznej
        if (sosy.pomidorowy !== undefined) lines.push(`pom: ${sosy.pomidorowy}`);
        if (sosy.czosnkowy !== undefined) lines.push(`czos: ${sosy.czosnkowy}`);
        return lines.length > 0 ? lines.join('<br>') : '-';
      } catch (e) {
        return sosyJson;
      }
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Zamówienia Pizza</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f3f4f6;
      min-height: 100vh;
      padding: 20px;
    }
    table { 
      border-collapse: collapse; 
      width: 100%; 
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
      border-radius: 20px;
      overflow: hidden;
      table-layout: fixed;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    th, td { 
      border: 1px solid #e5e7eb; 
      padding: 12px 14px; 
      text-align: left; 
      font-size: 13px;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    th { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 700;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      color: #1f2937;
    }
    tr:hover {
      background-color: #f9fafb;
      transition: background-color 0.2s ease;
    }
    .refresh-btn { 
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white; 
      padding: 10px 18px; 
      border: none; 
      border-radius: 12px; 
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .refresh-btn:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 10px 30px rgba(59, 130, 246, 0.5);
    }
    .filters-container {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 16px;
      border-radius: 16px;
      margin-bottom: 16px;
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      box-shadow: 0 10px 20px rgba(0,0,0,0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .filter-group label {
      font-weight: 600;
      font-size: 11px;
      color: #1f2937;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .filter-group select,
    .filter-group input {
      padding: 8px 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 13px;
      transition: all 0.3s ease;
      background: white;
    }
    .filter-group select:focus,
    .filter-group input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    .search-input {
      width: 280px;
    }
    .apply-btn {
      padding: 10px 18px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 700;
      margin-top: 14px;
      font-size: 12px;
      color: white;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      position: relative;
      overflow: hidden;
    }
    .apply-btn:hover {
      transform: translateY(-3px) scale(1.02);
    }
    .apply-btn:active {
      transform: translateY(-1px) scale(0.98);
    }
    .edit-btn {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 6px 12px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      margin-bottom: 3px;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    }
    .edit-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }
    .delete-btn {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 6px 12px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
    }
    .delete-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    }
    .save-btn {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      margin-right: 4px;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }
    .save-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
    .cancel-btn {
      background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
      color: white;
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(107, 114, 128, 0.3);
    }
    .cancel-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(107, 114, 128, 0.4);
    }
    .editable-cell {
      position: relative;
    }
    select.payment-select {
      padding: 8px;
      font-size: 15px;
      border: 2px solid #e0e0e0;
      border-radius: 5px;
      width: 100%;
      margin-bottom: 6px;
    }
    input.edit-input {
      padding: 8px;
      font-size: 15px;
      border: 2px solid #e0e0e0;
      border-radius: 5px;
      width: 100%;
      margin-bottom: 6px;
    }
    .print-btn {
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }
    .print-btn:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 10px 30px rgba(139, 92, 246, 0.5);
    }
    .print-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    .order-checkbox {
      width: 20px;
      height: 20px;
      cursor: pointer;
      accent-color: #8b5cf6;
    }
    #select-all-checkbox {
      width: 20px;
      height: 20px;
      cursor: pointer;
      accent-color: #8b5cf6;
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
        <button class="save-btn" onclick="saveOrder(\${orderId})">Zapisz</button>
        <button class="cancel-btn" onclick="location.reload()">Anuluj</button>
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
    
    function toggleSelectAll() {
      const selectAllCheckbox = document.getElementById('select-all-checkbox');
      const checkboxes = document.querySelectorAll('.order-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
      });
      updatePrintButton();
    }
    
    function updatePrintButton() {
      const checkboxes = document.querySelectorAll('.order-checkbox:checked');
      const printBtn = document.getElementById('print-btn');
      const count = checkboxes.length;
      
      if (count > 0) {
        printBtn.disabled = false;
        printBtn.textContent = 'Drukuj zaznaczone (' + count + ')';
      } else {
        printBtn.disabled = true;
        printBtn.textContent = 'Drukuj zaznaczone (0)';
      }
    }
    
    async function printSelected() {
      const checkboxes = document.querySelectorAll('.order-checkbox:checked');
      const orderIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
      
      if (orderIds.length === 0) {
        alert('Nie zaznaczono żadnych zamówień do wydruku');
        return;
      }
      
      const printBtn = document.getElementById('print-btn');
      printBtn.disabled = true;
      printBtn.textContent = 'Drukowanie...';
      
      try {
        const response = await fetch('/print-receipt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ orderIds })
        });
        
        const result = await response.json();
        
        if (response.ok) {
          alert('Pomyslnie wydrukowano ' + result.printed + ' paragonow');
          // Odznacz wszystkie checkboxy
          checkboxes.forEach(cb => cb.checked = false);
          document.getElementById('select-all-checkbox').checked = false;
          updatePrintButton();
        } else {
          alert('Blad drukowania: ' + result.error);
        }
      } catch (error) {
        alert('Blad polaczenia: ' + error.message);
      } finally {
        printBtn.disabled = false;
        updatePrintButton();
      }
    }
  </script>
</head>
<body>
  <div style="max-width: 1600px; margin: 0 auto;">
    <h1 style="color: #1f2937; font-size: 2.2em; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 20px;">Zamówienia Pizza App</h1>
    
    <div style="display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: nowrap;">
      <button class="apply-btn" onclick="window.location.href='http://localhost:3000'" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); box-shadow: 0 6px 20px rgba(249, 115, 22, 0.4);">
        Formularz zamówienia
      </button>
      <button class="apply-btn" onclick="window.location.href='/kuchnia'" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);">
        Panel Kuchni
      </button>
      <button class="apply-btn" onclick="window.location.href='/customer-dashboard'" style="background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); box-shadow: 0 6px 20px rgba(168, 85, 247, 0.4);">
        Statystyki Klientów
      </button>
      <button class="apply-btn" onclick="window.location.href='/sesja'" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);">
        Sesja
      </button>
      <button class="apply-btn" onclick="window.location.href='/zakupy-lista'" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);">
        Lista zakupów
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
      <button class="apply-btn" onclick="applyFilters()">Zastosuj filtry</button>
    </div>
    
    <div class="filter-group">
      <label>&nbsp;</label>
      <button class="refresh-btn" onclick="resetFilters()">Resetuj</button>
    </div>
  </div>
  
  <p><strong>Wyświetlono zamówień:</strong> ${orders.length} ${search ? `(wyszukiwanie: "${search}")` : ''} ${dateFilter === 'today' ? '(tylko dzisiejsze)' : ''}</p>
  
  <button id="print-btn" class="print-btn" onclick="printSelected()" disabled>
    Drukuj zaznaczone (0)
  </button>
  
  <table>
    <tr>
      <th style="width: 50px;">
        <input type="checkbox" id="select-all-checkbox" onchange="toggleSelectAll()" title="Zaznacz wszystkie">
      </th>
      <th style="width: 80px;">Typ</th>
      <th style="width: 100px;">Telefon</th>
      <th style="width: 150px;">Adres</th>
      <th style="width: 180px;">Pizze</th>
      <th style="width: 140px;">Modyfikacje</th>
      <th style="width: 80px;">Sosy</th>
      <th style="width: 80px;">Napój</th>
      <th style="width: 90px;">Dodatki</th>
      <th style="width: 100px;">Cena</th>
      <th style="width: 90px;">Kupony</th>
      <th style="width: 100px;">Płatność</th>
      <th style="width: 100px;">Kierowca</th>
      <th style="width: 130px;">Data</th>
      <th style="width: 180px;">Akcje</th>
    </tr>
    ${orders.map((order, i) => `
    <tr id="row-${order.id}" style="vertical-align: top;">
      <td style="text-align: center;">
        <input type="checkbox" class="order-checkbox" value="${order.id}" onchange="updatePrintButton()">
      </td>
      <td>${formatTypZamowienia(order.typ_zamowienia)}</td>
      <td id="telefon-${order.id}" class="editable-cell">${order.telefon || '-'}</td>
      <td id="adres-${order.id}" class="editable-cell">${order.adres || '-'}</td>
      <td style="max-width: 160px; word-wrap: break-word; font-size: 11px;">${formatPizzaInfo(order.pizze || order.pizza)}</td>
      <td style="max-width: 120px; word-wrap: break-word; font-size: 10px;">${order.skladniki || '-'}</td>
      <td style="font-size: 10px; line-height: 1.3;">${formatSosyInfo(order.sosy)}</td>
      <td style="font-size: 11px;">${formatNapojInfo(order.napoj)}</td>
      <td style="font-size: 11px;">${order.pozycje_extra || order.dodatki || '-'}</td>
      <td id="price-${order.id}" class="editable-cell">${order.cena_calkowita || order.cena || '-'} PLN</td>
      <td>${(typeof order.is_kupony !== 'undefined' && order.is_kupony === 1) ? 'KUPONY' : '-'}</td>
      <td id="payment-${order.id}" class="editable-cell">
        ${order.platnosc || '-'}
      </td>
      <td id="kierowca-${order.id}" class="editable-cell">${order.kierowca_nazwa || '-'}</td>
      <td>${formatPolishTime(order.created_at || order.godzina_otrzymania)}</td>
      <td id="actions-${order.id}" style="white-space: nowrap;">
        <button class="edit-btn" onclick="editOrder(${order.id}, '${order.platnosc || ''}', ${order.cena_calkowita || order.cena || 0}, '${order.kierowca_nazwa || ''}', ${order.sesja_id || 'null'}, '${(order.telefon || '').replace(/'/g, "\\\\'")}', '${(order.adres || '').replace(/'/g, "\\\\'").replace(/\n/g, ' ')}')">Edytuj</button>
        <button class="delete-btn" onclick="deleteOrder(${order.id})">Usun</button>
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
  console.log(`Serwer zamowien dziala na http://localhost:${PORT}`);
});
//