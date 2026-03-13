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
      
      // Normalizuj zapytanie - usuń przecinki i nadmiarowe spacje
      const normalizedQuery = searchQuery.replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Wyszukaj zamówienia pasujące do telefonu lub adresu (elastyczne wyszukiwanie)
      const [orders] = await connection.execute(
        `SELECT z.*, k.nazwa as kierowca_nazwa 
         FROM zamowienia z
         LEFT JOIN sesje s ON z.sesja_id = s.id
         LEFT JOIN kierowcy k ON s.kierowca_id = k.id
         WHERE z.telefon LIKE ? 
            OR REPLACE(REPLACE(LOWER(z.adres), ',', ' '), '  ', ' ') LIKE ?
         ORDER BY z.created_at DESC`,
        [`%${searchQuery}%`, `%${normalizedQuery.toLowerCase()}%`]
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
          
          // === SPRAWDZANIE ZMIANY CENY ===
          if (cena !== null && cena !== kwotaZamowienia) {
            const aktualnaSesjaId = sesjaId !== null ? (sesjaId === -1 ? null : sesjaId) : staraSesjaId;
            
            // Jeśli jest przypisana sesja i płatność nie jest online
            if (aktualnaSesjaId && staraPlatnosc !== 'online') {
              // Znajdź transakcję do aktualizacji
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
                // Zaktualizuj kwotę w istniejącej transakcji
                await connection.execute(
                  `UPDATE transakcje 
                   SET kwota = ?
                   WHERE id = ?`,
                  [cena, transakcjeDoZmiany[0].id]
                );
                console.log(`Zaktualizowano kwotę z ${kwotaZamowienia} na ${cena} PLN dla transakcji ID ${transakcjeDoZmiany[0].id}`);
              } else {
                console.log(`Nie znaleziono transakcji do aktualizacji kwoty`);
              }
            }
          }
          
          // === SPRAWDZANIE ZMIANY KIEROWCY ===
          if (sesjaId !== null) {
            const nowaSesjaId = sesjaId === -1 ? null : sesjaId;
            
            // Jeśli sesja się zmienia
            if (staraSesjaId !== nowaSesjaId) {
              // Użyj nowej ceny jeśli została zmieniona, inaczej użyj starej
              const kwotaDoTransakcji = cena !== null ? cena : kwotaZamowienia;
              // Użyj nowej płatności jeśli została zmieniona, inaczej użyj starej
              const platnosc_do_transakcji = platnosc || staraPlatnosc;
              
              // Usuń transakcję ze starej sesji (jeśli była i nie była online)
              if (staraSesjaId && staraPlatnosc !== 'online') {
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
              
              // Dodaj transakcję do nowej sesji (jeśli jest i płatność nie jest online)
              if (nowaSesjaId && platnosc_do_transakcji !== 'online') {
                await connection.execute(
                  'INSERT INTO transakcje (sesja_id, zamowienie_id, typ, kwota, forma_platnosci, opis) VALUES (?, ?, ?, ?, ?, ?)',
                  [nowaSesjaId, orderId, 'wplyw', kwotaDoTransakcji, platnosc_do_transakcji, `Zamówienie - ${adresZamowienia}`]
                );
                console.log(`Dodano transakcję do nowej sesji ${nowaSesjaId} z kwotą ${kwotaDoTransakcji} PLN (${platnosc_do_transakcji})`);
              }
            }
          }
          
          // === SPRAWDZANIE ZMIANY TYPU PŁATNOŚCI ===
          if (platnosc && platnosc !== staraPlatnosc) {
            const aktualnaSesjaId = sesjaId !== null ? (sesjaId === -1 ? null : sesjaId) : staraSesjaId;
            
            // Jeśli jest przypisana sesja
            if (aktualnaSesjaId) {
              // Sprawdź czy istnieje już transakcja dla tego zamówienia
              const [istniejacaTransakcja] = await connection.execute(
                `SELECT id, forma_platnosci FROM transakcje
                 WHERE sesja_id = ? 
                 AND typ = 'wplyw' 
                 AND kwota = ? 
                 AND opis LIKE ?
                 ORDER BY data_utworzenia DESC 
                 LIMIT 1`,
                [aktualnaSesjaId, kwotaZamowienia, `%${adresZamowienia}%`]
              );
              
              // Jeśli zmiana na 'online'
              if (platnosc === 'online') {
                // Usuń transakcję jeśli istnieje
                if (istniejacaTransakcja.length > 0) {
                  await connection.execute(
                    `DELETE FROM transakcje WHERE id = ?`,
                    [istniejacaTransakcja[0].id]
                  );
                  console.log(`Usunięto transakcję - zmiana na płatność online`);
                }
              } 
              // Jeśli zmiana z 'online' na gotówka/kartę
              else if (staraPlatnosc === 'online') {
                // Tylko dodaj transakcję jeśli jeszcze nie istnieje
                if (istniejacaTransakcja.length === 0) {
                  await connection.execute(
                    'INSERT INTO transakcje (sesja_id, zamowienie_id, typ, kwota, forma_platnosci, opis) VALUES (?, ?, ?, ?, ?, ?)',
                    [aktualnaSesjaId, orderId, 'wplyw', kwotaZamowienia, platnosc, `Zamówienie - ${adresZamowienia}`]
                  );
                  console.log(`Dodano transakcję - zmiana z online na ${platnosc}`);
                } else {
                  // Jeśli transakcja już istnieje, tylko zaktualizuj formę płatności
                  await connection.execute(
                    `UPDATE transakcje SET forma_platnosci = ? WHERE id = ?`,
                    [platnosc, istniejacaTransakcja[0].id]
                  );
                  console.log(`Zaktualizowano formę płatności na ${platnosc} (transakcja już istniała)`);
                }
              }
              // Jeśli zmiana między gotówką a kartą
              else {
                if (istniejacaTransakcja.length > 0) {
                  // Zaktualizuj formę płatności w istniejącej transakcji
                  await connection.execute(
                    `UPDATE transakcje SET forma_platnosci = ? WHERE id = ?`,
                    [platnosc, istniejacaTransakcja[0].id]
                  );
                  console.log(`Zaktualizowano formę płatności na ${platnosc} dla transakcji ID ${istniejacaTransakcja[0].id}`);
                } else {
                  console.log(`Nie znaleziono transakcji do aktualizacji, tworzę nową`);
                  // Jeśli nie znaleziono transakcji do aktualizacji, dodaj nową
                  await connection.execute(
                    'INSERT INTO transakcje (sesja_id, zamowienie_id, typ, kwota, forma_platnosci, opis) VALUES (?, ?, ?, ?, ?, ?)',
                    [aktualnaSesjaId, orderId, 'wplyw', kwotaZamowienia, platnosc, `Zamówienie - ${adresZamowienia}`]
                  );
                }
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
  
  // Panel Rozliczenia Pizzerii
  if (pathname === '/rozliczenie') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const rozliczenieHtml = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rozliczenie Pizzerii</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    /* Powiększ kalendarz Chrome/Edge o 50% */
    input[type="date"]::-webkit-calendar-picker-indicator {
      transform: scale(1.5);
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .header {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .header h1 {
      font-size: 28px;
      color: #1f2937;
    }
    
    .date-selector {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    
    .date-selector input[type="date"] {
      padding: 14px 20px;
      border: 3px solid #10b981;
      border-radius: 8px;
      font-size: 20px;
      font-weight: 600;
      cursor: pointer;
      min-width: 200px;
      background: white;
    }
    
    .date-selector input[type="date"]::-webkit-calendar-picker-indicator {
      cursor: pointer;
      font-size: 24px;
      width: 32px;
      height: 32px;
      padding: 0;
    }
    
    /* Powiększ kalendarz wyskakujący o 50% */
    .date-selector input[type="date"]::-webkit-datetime-edit {
      font-size: 20px;
    }
    
    .date-selector input[type="date"]::-webkit-datetime-edit-fields-wrapper {
      font-size: 20px;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 10px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
      transition: all 0.3s;
    }
    
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(16, 185, 129, 0.4);
    }
    
    .btn-back {
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
      color: white;
      padding: 10px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    
    .section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .section h2 {
      font-size: 22px;
      color: #1f2937;
      margin-bottom: 16px;
      border-bottom: 3px solid #10b981;
      padding-bottom: 8px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    tr:hover {
      background: #f9fafb;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }
    
    .summary-card {
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      padding: 20px;
      border-radius: 10px;
      border-left: 4px solid #10b981;
    }
    
    .summary-card.wydatek {
      border-left-color: #ef4444;
    }
    
    .summary-card.info {
      border-left-color: #3b82f6;
    }
    
    .summary-card h3 {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    
    .summary-card .amount {
      font-size: 32px;
      font-weight: 700;
      color: #1f2937;
    }
    
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #6b7280;
    }
    
    .loading {
      text-align: center;
      padding: 40px;
      font-size: 18px;
      color: #6b7280;
    }
    
    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .badge-gotowka { background: #dcfce7; color: #166534; }
    .badge-karta { background: #dbeafe; color: #1e40af; }
    .badge-online { background: #e0e7ff; color: #4338ca; }
    .badge-wplyw { background: #dcfce7; color: #166534; }
    .badge-wydatek { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Rozliczenie Pizzerii</h1>
      <div class="date-selector">
        <a href="/" class="btn-back">← Powrót do POZ</a>
        <input type="date" id="dateInput" value="" style="cursor: pointer;">
        <button class="btn-primary" onclick="loadData()">Pokaż dane</button>
      </div>
    </div>
    
    <div id="loading" class="loading" style="display: none;">
      Ładowanie danych...
    </div>
    
    <script>
    // Zablokuj ręczną edycję daty
    const dateInput = document.getElementById('dateInput');
    dateInput.addEventListener('keydown', (e) => e.preventDefault());
    dateInput.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dateInput.showPicker();
    });
    dateInput.addEventListener('focus', (e) => {
      e.preventDefault();
      dateInput.blur();
      dateInput.showPicker();
    });
    </script>
    
    <div id="content" style="display: none;">
      <!-- Sekcja 0: Stan kasy początkowy -->
      <div class="section">
        <h2>💵 Stan kasy początkowy</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <h3 style="font-size: 16px; margin-bottom: 12px; color: #374151;">Wpisz stan kasy na start dnia:</h3>
            <div style="display: flex; gap: 12px; align-items: flex-end;">
              <div style="flex: 1;">
                <label style="display: block; font-size: 14px; color: #6b7280; margin-bottom: 6px;">Kwota (PLN)</label>
                <input type="number" id="stanKasyInput" step="0.01" placeholder="0.00" 
                  style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 18px; font-weight: 600; -moz-appearance: textfield;">
                <style>
                  #stanKasyInput::-webkit-outer-spin-button,
                  #stanKasyInput::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                  }
                </style>
              </div>
              <div style="flex: 1;">
                <label style="display: block; font-size: 14px; color: #6b7280; margin-bottom: 6px;">Notatka (opcjonalnie)</label>
                <input type="text" id="stanKasyNotatka" placeholder="" 
                  style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
              </div>
              <button onclick="zapiszStanKasy()" class="btn-primary" style="padding: 12px 24px; white-space: nowrap;">
                Zapisz stan
              </button>
            </div>
            <p style="font-size: 13px; color: #6b7280; margin-top: 8px;">💡 Pole wyczyści się po wyjściu z formularza</p>
          </div>
          <div>
            <h3 style="font-size: 16px; margin-bottom: 8px; color: #374151;">Ostatnie 10 wpisów:</h3>
            <p style="font-size: 13px; color: #059669; margin-bottom: 12px; padding: 8px; background: #d1fae5; border-radius: 6px; border-left: 3px solid #10b981;">
              ℹ️ <strong>Ostatni zapis</strong> to aktualny stan kasy brany w rozliczeniu - powinna to być wartość stanu kasy przed rozpoczęciem dnia pracy pizzerii.
            </p>
            <div id="ostatnieStany" style="max-height: 200px; overflow-y: auto; background: #f9fafb; padding: 12px; border-radius: 8px; font-size: 13px;">
              Ładowanie...
            </div>
          </div>
        </div>
      </div>
      
      <!-- Sekcja A: Zamówienia -->
      <div class="section">
        <h2>📦 Zamówienia z dnia</h2>
        <table id="zamowieniaTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Godzina</th>
              <th>Typ zamówienia</th>
              <th>Kwota</th>
              <th>Płatność</th>
            </tr>
          </thead>
          <tbody id="zamowieniaBody"></tbody>
        </table>
        <div class="summary" id="zamowieniaSummary"></div>
      </div>
      
      <!-- Sekcja B: Transakcje -->
      <div class="section">
        <h2>💸 Transakcje (wpływy/wydatki)</h2>
        <table id="transakcjeTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Godzina</th>
              <th>Typ</th>
              <th>Kwota</th>
              <th>Forma</th>
              <th>Opis</th>
              <th>Sesja</th>
            </tr>
          </thead>
          <tbody id="transakcjeBody"></tbody>
        </table>
        <div class="summary" id="transakcjeSummary"></div>
      </div>
      
      <!-- Sekcja C: Podsumowanie -->
      <div class="section">
        <h2>📊 Podsumowanie dnia</h2>
        <div class="summary" id="podsumowanie"></div>
      </div>
    </div>
  </div>
  
  <script>
    // Ustaw dzisiejszą datę
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateInput').value = today;
    
    // Załaduj dane automatycznie przy starcie
    loadData();
    loadOstatnieStany();
    
    // Wyczyść pole po wyjściu/odświeżeniu
    window.addEventListener('beforeunload', () => {
      document.getElementById('stanKasyInput').value = '';
      document.getElementById('stanKasyNotatka').value = '';
    });
    
    async function zapiszStanKasy() {
      const kwota = document.getElementById('stanKasyInput').value;
      const notatka = document.getElementById('stanKasyNotatka').value;
      
      if (!kwota || parseFloat(kwota) < 0) {
        alert('Wpisz prawidłową kwotę');
        return;
      }
      
      try {
        const response = await fetch('/api/stankasy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kwota: parseFloat(kwota), notatka })
        });
        
        const result = await response.json();
        
        if (response.ok) {
          alert('✅ Stan kasy zapisany!');
          document.getElementById('stanKasyInput').value = '';
          document.getElementById('stanKasyNotatka').value = '';
          loadOstatnieStany();
          loadData(); // Odśwież podsumowanie
        } else {
          alert('Błąd: ' + result.error);
        }
      } catch (error) {
        console.error('Błąd zapisywania:', error);
        alert('Błąd zapisywania stanu kasy');
      }
    }
    
    async function loadOstatnieStany() {
      try {
        const response = await fetch('/api/stankasy/ostatnie');
        const stany = await response.json();
        
        const container = document.getElementById('ostatnieStany');
        
        if (stany.length === 0) {
          container.innerHTML = '<p style="color: #9ca3af;">Brak wpisów</p>';
          return;
        }
        
        container.innerHTML = stany.map(s => \`
          <div style="padding: 8px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
              <strong style="color: #10b981;">\${parseFloat(s.kwota).toFixed(2)} PLN</strong>
              <span style="color: #9ca3af; font-size: 12px; margin-left: 8px;">
                \${new Date(s.data_utworzenia).toLocaleString('pl-PL')}
              </span>
              \${s.notatka ? '<br><small style="color: #6b7280;">' + s.notatka + '</small>' : ''}
            </div>
            <button onclick="usunStanKasy(\${s.id})" 
              style="background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s;"
              onmouseover="this.style.background='#dc2626'" 
              onmouseout="this.style.background='#ef4444'"
              title="Usuń ten wpis">
              🗑️ Usuń
            </button>
          </div>
        \`).join('');
      } catch (error) {
        console.error('Błąd ładowania stanów:', error);
        document.getElementById('ostatnieStany').innerHTML = '<p style="color: #ef4444;">Błąd ładowania</p>';
      }
    }
    
    async function usunStanKasy(id) {
      if (!confirm('Czy na pewno chcesz usunąć ten wpis?')) {
        return;
      }
      
      try {
        const response = await fetch('/api/stankasy/' + id, {
          method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
          alert('✅ Wpis usunięty!');
          loadOstatnieStany();
          loadData(); // Odśwież podsumowanie
        } else {
          alert('Błąd: ' + result.error);
        }
      } catch (error) {
        console.error('Błąd usuwania:', error);
        alert('Błąd usuwania wpisu');
      }
    }
    
    async function loadData() {
      const date = document.getElementById('dateInput').value;
      if (!date) {
        alert('Wybierz datę');
        return;
      }
      
      document.getElementById('loading').style.display = 'block';
      document.getElementById('content').style.display = 'none';
      
      try {
        const response = await fetch('/api/rozliczenie?data=' + date);
        const data = await response.json();
        
        renderZamowienia(data.zamowienia);
        renderTransakcje(data.transakcje, data.sesje || []);
        renderPodsumowanie(data.podsumowanie);
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';
      } catch (error) {
        console.error('Błąd:', error);
        alert('Błąd ładowania danych: ' + error.message);
        document.getElementById('loading').style.display = 'none';
      }
    }
    
    function renderZamowienia(zamowienia) {
      const tbody = document.getElementById('zamowieniaBody');
      const summary = document.getElementById('zamowieniaSummary');
      
      if (zamowienia.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Brak zamówień w tym dniu</td></tr>';
        summary.innerHTML = '';
        return;
      }
      
      tbody.innerHTML = zamowienia.map(z => \`
        <tr>
          <td>#\${z.id}</td>
          <td>\${new Date(z.created_at).toLocaleTimeString('pl-PL')}</td>
          <td>\${z.typ_zamowienia}</td>
          <td><strong>\${z.cena_calkowita} PLN</strong></td>
          <td><span class="badge badge-\${z.platnosc}">\${z.platnosc.toUpperCase()}</span></td>
        </tr>
      \`).join('');
      
      // Podsumowanie zamówień - rozdziel na miejsce/wynos vs dowóz
      const gotowkaNaMiejscuWynos = zamowienia.filter(z => z.platnosc === 'gotowka' && (z.typ_zamowienia === 'na_miejscu' || z.typ_zamowienia === 'na_wynos')).reduce((sum, z) => sum + parseFloat(z.cena_calkowita), 0);
      const gotowkaDowoz = zamowienia.filter(z => z.platnosc === 'gotowka' && z.typ_zamowienia === 'dowoz').reduce((sum, z) => sum + parseFloat(z.cena_calkowita), 0);
      const karta = zamowienia.filter(z => z.platnosc === 'karta').reduce((sum, z) => sum + parseFloat(z.cena_calkowita), 0);
      const online = zamowienia.filter(z => z.platnosc === 'online').reduce((sum, z) => sum + parseFloat(z.cena_calkowita), 0);
      const razem = gotowkaNaMiejscuWynos + gotowkaDowoz + karta + online;
      
      summary.innerHTML = \`
        <div class="summary-card">
          <h3>Gotówka (na miejscu/wynos)</h3>
          <div class="amount">\${gotowkaNaMiejscuWynos.toFixed(2)} PLN</div>
          <small style="color: #6b7280;">Wpływ do kasy</small>
        </div>
        <div class="summary-card">
          <h3>Gotówka (dowóz)</h3>
          <div class="amount">\${gotowkaDowoz.toFixed(2)} PLN</div>
          <small style="color: #6b7280;">W saldzie kierowcy</small>
        </div>
        <div class="summary-card info">
          <h3>Karta</h3>
          <div class="amount">\${karta.toFixed(2)} PLN</div>
        </div>
        <div class="summary-card info">
          <h3>Online</h3>
          <div class="amount">\${online.toFixed(2)} PLN</div>
        </div>
        <div class="summary-card">
          <h3>RAZEM PRZYCHÓD</h3>
          <div class="amount">\${razem.toFixed(2)} PLN</div>
        </div>
      \`;
    }
    
    function renderTransakcje(transakcje, sesje) {
      const tbody = document.getElementById('transakcjeBody');
      const summary = document.getElementById('transakcjeSummary');
      
      if (transakcje.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Brak transakcji w tym dniu</td></tr>';
        summary.innerHTML = '';
        return;
      }
      
      // Jeśli jest więcej niż jedna sesja, grupuj transakcje według kierowców
      if (sesje.length > 1) {
        let html = '';
        
        // Dla każdego kierowcy
        sesje.forEach(sesja => {
          const transakcjeSesji = transakcje.filter(t => t.sesja_id === sesja.id);
          if (transakcjeSesji.length > 0) {
            html += \`
              <tr style="background: #f3f4f6; font-weight: 600;">
                <td colspan="7" style="padding: 12px 16px;">
                  👤 \${sesja.kierowca_nazwa} - Sesja #\${sesja.id}
                </td>
              </tr>
            \`;
            
            html += transakcjeSesji.map(t => \`
              <tr>
                <td>#\${t.id}</td>
                <td>\${new Date(t.created_at).toLocaleTimeString('pl-PL')}</td>
                <td><span class="badge badge-\${t.typ}">\${t.typ.toUpperCase()}</span></td>
                <td><strong>\${t.kwota} PLN</strong></td>
                <td>\${t.forma_platnosci || '-'}</td>
                <td>\${t.opis || '-'}</td>
                <td>\${sesja.kierowca_nazwa} - Sesja #\${sesja.id}</td>
              </tr>
            \`).join('');
          }
        });
        
        // Transakcje bez sesji (manualne)
        const transakcjeManualne = transakcje.filter(t => !t.sesja_id);
        if (transakcjeManualne.length > 0) {
          html += \`
            <tr style="background: #fef3c7; font-weight: 600;">
              <td colspan="7" style="padding: 12px 16px;">
                📝 Transakcje manualne (bez sesji)
              </td>
            </tr>
          \`;
          
          html += transakcjeManualne.map(t => \`
            <tr>
              <td>#\${t.id}</td>
              <td>\${new Date(t.created_at).toLocaleTimeString('pl-PL')}</td>
              <td><span class="badge badge-\${t.typ}">\${t.typ.toUpperCase()}</span></td>
              <td><strong>\${t.kwota} PLN</strong></td>
              <td>\${t.forma_platnosci || '-'}</td>
              <td>\${t.opis || '-'}</td>
              <td>-</td>
            </tr>
          \`).join('');
        }
        
        tbody.innerHTML = html;
      } else {
        // Standardowe wyświetlanie gdy jedna sesja lub brak sesji
        tbody.innerHTML = transakcje.map(t => \`
          <tr>
            <td>#\${t.id}</td>
            <td>\${new Date(t.created_at).toLocaleTimeString('pl-PL')}</td>
            <td><span class="badge badge-\${t.typ}">\${t.typ.toUpperCase()}</span></td>
            <td><strong>\${t.kwota} PLN</strong></td>
            <td>\${t.forma_platnosci || '-'}</td>
            <td>\${t.opis || '-'}</td>
            <td>\${t.kierowca_nazwa && t.sesja_id ? t.kierowca_nazwa + ' - Sesja #' + t.sesja_id : '-'}</td>
          </tr>
        \`).join('');
      }
      
      // Podsumowanie transakcji
      const wplywManualne = transakcje.filter(t => t.typ === 'wplyw' && t.sesja_id && t.forma_platnosci === 'manualny').reduce((sum, t) => sum + parseFloat(t.kwota), 0);
      const wplywZamowienia = transakcje.filter(t => t.typ === 'wplyw' && t.sesja_id && t.forma_platnosci === 'gotowka').reduce((sum, t) => sum + parseFloat(t.kwota), 0);
      const wydatki = transakcje.filter(t => t.typ === 'wydatek').reduce((sum, t) => sum + parseFloat(t.kwota), 0);
      
      // Oblicz salda sesji
      const sesjeIds = [...new Set(transakcje.filter(t => t.sesja_id).map(t => t.sesja_id))];
      let saldaSesji = 0;
      for (const sesjaId of sesjeIds) {
        const transakcjeSesji = transakcje.filter(t => t.sesja_id === sesjaId);
        let saldoSesji = 0;
        for (const t of transakcjeSesji) {
          if (t.forma_platnosci === 'karta' || t.forma_platnosci === 'online') continue;
          saldoSesji += t.typ === 'wplyw' ? parseFloat(t.kwota) : -parseFloat(t.kwota);
        }
        saldaSesji += saldoSesji;
      }
      
      summary.innerHTML = \`
        <div class="summary-card wydatek">
          <h3>Pieniądze które dostali z kasy</h3>
          <div class="amount">-\${wplywManualne.toFixed(2)} PLN</div>
          <small style="color: #6b7280;">Wyszło z kasy</small>
        </div>
        <div class="summary-card">
          <h3>Salda sesji (wrócą do kasy)</h3>
          <div class="amount">+\${saldaSesji.toFixed(2)} PLN</div>
          <small style="color: #6b7280;">Po wydatkach (-\${wydatki.toFixed(2)}) i dowozach (+\${wplywZamowienia.toFixed(2)})</small>
        </div>
        <div class="summary-card info">
          <h3>Bilans kierowców</h3>
          <div class="amount">\${(saldaSesji - wplywManualne).toFixed(2)} PLN</div>
          <small style="color: #6b7280;">Różnica: co wrócą minus co dostali</small>
        </div>
      \`;
    }
    
    function renderPodsumowanie(podsumowanie) {
      const container = document.getElementById('podsumowanie');
      
      const stanPoczatkowy = podsumowanie.stan_poczatkowy || 0;
      const stanKoncowy = podsumowanie.stan_koncowy || 0;
      const zmianaWKasie = podsumowanie.zmiana_w_kasie || 0;
      
      container.innerHTML = \`
        <div class="summary-card info">
          <h3>Stan kasy początkowy</h3>
          <div class="amount">\${stanPoczatkowy.toFixed(2)} PLN</div>
          <small style="color: #6b7280;">\${stanPoczatkowy > 0 ? 'Ostatni wpis z tabeli' : 'Brak wpisu w bazie'}</small>
        </div>
        <div class="summary-card">
          <h3>Przychód z zamówień (gotówka)</h3>
          <div class="amount">+\${podsumowanie.gotowka_zamowienia.toFixed(2)} PLN</div>
          <small style="color: #6b7280;">Na miejscu i na wynos (dowóz w saldzie kierowcy)</small>
        </div>
        <div class="summary-card wydatek">
          <h3>Pieniądze które dostali kierowcy z kasy</h3>
          <div class="amount">-\${podsumowanie.pieniadze_wyszly.toFixed(2)} PLN</div>
          <small style="color: #6b7280;">Na zakupy, paliwo itp.</small>
        </div>
        <div class="summary-card">
          <h3>Pieniądze które wrócły od kierowców</h3>
          <div class="amount">+\${podsumowanie.salda_sesji.toFixed(2)} PLN</div>
          <small style="color: #6b7280;">Reszta po wydatkach i dowozach</small>
        </div>
        <div class="summary-card wydatek">
          <h3>Wydatki kierowców</h3>
          <div class="amount">-\${podsumowanie.wydatki_kierowcow.toFixed(2)} PLN</div>
          <small style="color: #6b7280;">Zakupy, paliwo, itp.</small>
        </div>
        <div class="summary-card" style="grid-column: 1 / -1; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none;">
          <h3 style="color: rgba(255,255,255,0.8);">OCZEKIWANY STAN KOŃCOWY KASY</h3>
          <div class="amount" style="color: white; font-size: 48px;">\${stanKoncowy.toFixed(2)} PLN</div>
          <div style="color: rgba(255,255,255,0.85); font-size: 14px; margin-top: 12px; line-height: 1.6;">
            <div style="margin-bottom: 6px;">(stan początkowy kasy) - (kasa oddana kierowcom) + (salda z sesji kierowców) + (przychód z zamówień w gotówce)</div>
            <div style="font-weight: 600; font-size: 15px;">= \${stanPoczatkowy.toFixed(2)} - \${podsumowanie.pieniadze_wyszly.toFixed(2)} + \${podsumowanie.salda_sesji.toFixed(2)} + \${podsumowanie.gotowka_zamowienia.toFixed(2)}</div>
          </div>
        </div>
        <div class="summary-card" style="grid-column: 1 / -1; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; border: none;">
          <h3 style="color: rgba(255,255,255,0.9);">ZMIANA W KASIE</h3>
          <div class="amount" style="color: white; font-size: 42px;">\${zmianaWKasie >= 0 ? '+' : ''}\${zmianaWKasie.toFixed(2)} PLN</div>
          <small style="color: rgba(255,255,255,0.8);">= Stan końcowy (\${stanKoncowy.toFixed(2)}) - Stan początkowy (\${stanPoczatkowy.toFixed(2)})</small>
        </div>
        <div class="summary-card info">
          <h3>Karta + Online (info)</h3>
          <div class="amount">\${podsumowanie.karta_online.toFixed(2)} PLN</div>
          <small style="color: #6b7280;">Nie wpływa na kasę</small>
        </div>
      \`;
    }
  </script>
</body>
</html>`;
    res.end(rozliczenieHtml);
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
          // Transakcje kartą i online nie wliczają się do salda
          if (t.forma_platnosci === 'karta' || t.forma_platnosci === 'online') {
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
          // Transakcje kartą i online nie wliczają się do salda
          if (t.forma_platnosci === 'karta' || t.forma_platnosci === 'online') {
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
  
  // API: Rozliczenie pizzerii - dane z wybranego dnia
  if (pathname === '/api/rozliczenie' && req.method === 'GET') {
    let connection;
    try {
      const urlParams = new URLSearchParams(parsedUrl.search);
      const data = urlParams.get('data'); // Format: YYYY-MM-DD
      
      if (!data) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Brak parametru data' }));
        return;
      }
      
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Pepperoni13',
        database: 'SmartPizzApp13'
      });
      
      // Pobierz zamówienia z danego dnia
      const [zamowienia] = await connection.execute(
        `SELECT id, typ_zamowienia, cena_calkowita, platnosc, created_at
         FROM zamowienia
         WHERE DATE(created_at) = ?
         ORDER BY created_at ASC`,
        [data]
      );
      
      // Pobierz transakcje z danego dnia (manualne wpływy/wydatki + transakcje kierowców)
      const [transakcje] = await connection.execute(
        `SELECT t.id, t.typ, t.kwota, t.forma_platnosci, t.opis, t.sesja_id, t.zamowienie_id, t.data_utworzenia as created_at,
                s.kierowca_id, k.nazwa as kierowca_nazwa
         FROM transakcje t
         LEFT JOIN sesje s ON t.sesja_id = s.id
         LEFT JOIN kierowcy k ON s.kierowca_id = k.id
         WHERE DATE(t.data_utworzenia) = ?
         ORDER BY t.data_utworzenia ASC`,
        [data]
      );
      
      // Pobierz unikalne sesje z nazwami kierowców
      const [sesje] = await connection.execute(
        `SELECT DISTINCT s.id, s.kierowca_id, k.nazwa as kierowca_nazwa
         FROM sesje s
         JOIN kierowcy k ON s.kierowca_id = k.id
         WHERE s.id IN (
           SELECT DISTINCT sesja_id FROM transakcje WHERE sesja_id IS NOT NULL AND DATE(data_utworzenia) = ?
         )
         ORDER BY s.id ASC`,
        [data]
      );
      
      // Oblicz podsumowanie - NOWA LOGIKA
      // 1. Przychód z zamówień gotówką TYLKO "na miejscu" i "na wynos" (w POZ)
      // Dowóz jest liczony tylko w saldzie kierowcy
      const gotowkaZamowienia = zamowienia
        .filter(z => z.platnosc === 'gotowka' && (z.typ_zamowienia === 'na_miejscu' || z.typ_zamowienia === 'na_wynos'))
        .reduce((sum, z) => sum + parseFloat(z.cena_calkowita), 0);
      
      const kartaOnline = zamowienia
        .filter(z => z.platnosc === 'karta' || z.platnosc === 'online')
        .reduce((sum, z) => sum + parseFloat(z.cena_calkowita), 0);
      
      // 2. Pieniądze które WYSZŁY z kasy do kierowców (wpływy ręczne typu "manualny")
      const pieniadzeWyszlyDlaKierowcow = transakcje
        .filter(t => t.typ === 'wplyw' && t.sesja_id && t.forma_platnosci === 'manualny')
        .reduce((sum, t) => sum + parseFloat(t.kwota), 0);
      
      // 3. Oblicz salda sesji (pieniądze które WRÓCIŁY od kierowców)
      let saldaSesji = 0;
      for (const sesja of sesje) {
        const transakcjeSesji = transakcje.filter(t => t.sesja_id === sesja.id);
        let saldoSesji = 0;
        
        for (const t of transakcjeSesji) {
          // Pomijamy transakcje kartą i online
          if (t.forma_platnosci === 'karta' || t.forma_platnosci === 'online') {
            continue;
          }
          
          if (t.typ === 'wplyw') {
            saldoSesji += parseFloat(t.kwota);
          } else {
            saldoSesji -= parseFloat(t.kwota);
          }
        }
        
        saldaSesji += saldoSesji;
      }
      
      // 4. Wydatki kierowców (na zakupy, paliwo itp)
      const wydatkiKierowcow = transakcje
        .filter(t => t.typ === 'wydatek' && t.sesja_id)
        .reduce((sum, t) => sum + parseFloat(t.kwota), 0);
      
      // 5. Stan końcowy kasy - zawsze używaj ostatniego wpisu niezależnie od daty
      const stanPoczatkowy = await (async () => {
        const [stanyKasy] = await connection.execute(
          `SELECT kwota FROM stankasy 
           ORDER BY data_utworzenia DESC 
           LIMIT 1`
        );
        return stanyKasy.length > 0 ? parseFloat(stanyKasy[0].kwota) : 0;
      })();
      
      // Stan końcowy = Stan początkowy - pieniądze dla kierowców + salda sesji + przychód z zamówień
      const stanKoncowy = stanPoczatkowy - pieniadzeWyszlyDlaKierowcow + saldaSesji + gotowkaZamowienia;
      const zmianaWKasie = stanKoncowy - stanPoczatkowy;
      
      const podsumowanie = {
        gotowka_zamowienia: gotowkaZamowienia,
        karta_online: kartaOnline,
        pieniadze_wyszly: pieniadzeWyszlyDlaKierowcow,
        salda_sesji: saldaSesji,
        wydatki_kierowcow: wydatkiKierowcow,
        stan_poczatkowy: stanPoczatkowy,
        stan_koncowy: stanKoncowy,
        zmiana_w_kasie: zmianaWKasie
      };
      
      await connection.end();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        zamowienia,
        transakcje,
        podsumowanie,
        sesje
      }));
      
    } catch (error) {
      console.error('Błąd API rozliczenie:', error);
      if (connection) await connection.end();
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  
  // API: Pobierz ostatnie 10 wpisów stanu kasy
  if (pathname === '/api/stankasy/ostatnie' && req.method === 'GET') {
    let connection;
    try {
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Pepperoni13',
        database: 'SmartPizzApp13'
      });
      
      const [stany] = await connection.execute(
        `SELECT id, kwota, data_utworzenia, notatka
         FROM stankasy
         ORDER BY data_utworzenia DESC
         LIMIT 10`
      );
      
      await connection.end();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stany));
      
    } catch (error) {
      console.error('Błąd pobierania stanów kasy:', error);
      if (connection) await connection.end();
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  
  // API: Zapisz nowy stan kasy
  if (pathname === '/api/stankasy' && req.method === 'POST') {
    let connection;
    let body = '';
    
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { kwota, notatka } = data;
        
        if (!kwota || isNaN(kwota)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Nieprawidłowa kwota' }));
          return;
        }
        
        connection = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: 'Pepperoni13',
          database: 'SmartPizzApp13'
        });
        
        await connection.execute(
          `INSERT INTO stankasy (kwota, notatka) VALUES (?, ?)`,
          [parseFloat(kwota), notatka || null]
        );
        
        await connection.end();
        
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Stan kasy zapisany' }));
        
      } catch (error) {
        console.error('Błąd zapisywania stanu kasy:', error);
        if (connection) await connection.end();
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }
  
  // API: Usuń stan kasy
  if (pathname.startsWith('/api/stankasy/') && req.method === 'DELETE') {
    let connection;
    try {
      const id = pathname.split('/').pop();
      
      if (!id || isNaN(id)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Nieprawidłowe ID' }));
        return;
      }
      
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Pepperoni13',
        database: 'SmartPizzApp13'
      });
      
      const [result] = await connection.execute(
        `DELETE FROM stankasy WHERE id = ?`,
        [parseInt(id)]
      );
      
      await connection.end();
      
      if (result.affectedRows === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Nie znaleziono wpisu' }));
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Stan kasy usunięty' }));
      
    } catch (error) {
      console.error('Błąd usuwania stanu kasy:', error);
      if (connection) await connection.end();
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
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
      
      // Pobierz wszystkie transakcje
      const [transakcje] = await connection.execute(
        'SELECT * FROM transakcje WHERE sesja_id = ? ORDER BY data_utworzenia ASC',
        [sesjaId]
      );
      
      // Pobierz wszystkie zamówienia przypisane do sesji (w tym online)
      const [zamowienia] = await connection.execute(
        `SELECT id, telefon, adres, cena_calkowita, platnosc, created_at 
         FROM zamowienia 
         WHERE sesja_id = ? 
         ORDER BY created_at ASC`,
        [sesjaId]
      );
      
      // Połącz transakcje i zamówienia w jedną listę
      const wszystko = [];
      
      // Dodaj transakcje
      transakcje.forEach(t => {
        wszystko.push({
          typ: 'transakcja',
          data: t.data_utworzenia,
          transakcja: t
        });
      });
      
      // Dodaj zamówienia online (które nie mają transakcji)
      zamowienia.forEach(z => {
        if (z.platnosc === 'online') {
          wszystko.push({
            typ: 'zamowienie_online',
            data: z.created_at,
            zamowienie: z
          });
        }
      });
      
      // Sortuj po dacie
      wszystko.sort((a, b) => new Date(a.data) - new Date(b.data));
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(wszystko));
      
      if (connection) await connection.end();
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
      if (connection) await connection.end();
    }
    return;
  }
  
  // API: Usuwanie transakcji manualnej
  if (pathname.startsWith('/api/transakcje/') && req.method === 'DELETE') {
    const transakcjaId = pathname.split('/')[3];
    let connection;
    try {
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Pepperoni13',
        database: 'SmartPizzApp13'
      });
      
      // Sprawdź czy transakcja jest manualna (bez zamowienie_id)
      const [transakcja] = await connection.execute(
        'SELECT zamowienie_id FROM transakcje WHERE id = ?',
        [transakcjaId]
      );
      
      if (transakcja.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Transakcja nie znaleziona' }));
        await connection.end();
        return;
      }
      
      if (transakcja[0].zamowienie_id !== null) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Nie można usunąć transakcji powiązanej z zamówieniem. Edytuj zamówienie w POZ.' }));
        await connection.end();
        return;
      }
      
      // Usuń transakcję manualną
      await connection.execute('DELETE FROM transakcje WHERE id = ?', [transakcjaId]);
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
      await connection.end();
      
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
      if (connection) await connection.end();
    }
    return;
  }
  
  // GET /api/transakcje/:id - pobierz szczegóły transakcji
  if (req.method === 'GET' && pathname.startsWith('/api/transakcje/')) {
    const transakcjaId = pathname.split('/')[3];
    let connection;
    try {
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Pepperoni13',
        database: 'SmartPizzApp13'
      });
      const [rows] = await connection.query(
        'SELECT * FROM transakcje WHERE id = ?',
        [transakcjaId]
      );
      
      if (rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Transakcja nie znaleziona' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rows[0]));
      }
      await connection.end();
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
      if (connection) await connection.end();
    }
    return;
  }
  
  // PUT /api/transakcje/:id - aktualizuj transakcję manualną
  if (req.method === 'PUT' && pathname.startsWith('/api/transakcje/')) {
    const transakcjaId = pathname.split('/')[3];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      let connection;
      try {
        const data = JSON.parse(body);
        connection = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: 'Pepperoni13',
          database: 'SmartPizzApp13'
        });
        
        // Sprawdź czy transakcja istnieje i czy jest manualna
        const [existing] = await connection.query(
          'SELECT zamowienie_id FROM transakcje WHERE id = ?',
          [transakcjaId]
        );
        
        if (existing.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Transakcja nie znaleziona' }));
          await connection.end();
          return;
        }
        
        if (existing[0].zamowienie_id !== null) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Nie można edytować transakcji powiązanej z zamówieniem. Edytuj zamówienie w POZ.' }));
          await connection.end();
          return;
        }
        
        // Dla transakcji manualnych zawsze ustaw formę płatności jako 'manualny'
        const formaPlat = 'manualny';
        
        // Aktualizuj transakcję
        await connection.query(
          `UPDATE transakcje 
           SET typ = ?, kwota = ?, forma_platnosci = ?, opis = ?
           WHERE id = ?`,
          [data.typ, data.kwota, formaPlat, data.opis, transakcjaId]
        );
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Transakcja zaktualizowana' }));
        await connection.end();
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        if (connection) await connection.end();
      }
    });
    return;
  }
  
  // DELETE /api/transakcje/:id - usuń transakcję manualną
  if (req.method === 'DELETE' && pathname.startsWith('/api/transakcje/')) {
    const transakcjaId = pathname.split('/')[3];
    let connection;
    try {
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Pepperoni13',
        database: 'SmartPizzApp13'
      });
      
      // Sprawdź czy transakcja jest manualna (nie ma zamowienie_id)
      const [rows] = await connection.query(
        'SELECT zamowienie_id FROM transakcje WHERE id = ?',
        [transakcjaId]
      );
      
      if (rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Transakcja nie znaleziona' }));
        await connection.end();
        return;
      }
      
      if (rows[0].zamowienie_id !== null) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Nie można usunąć transakcji powiązanej z zamówieniem' }));
        await connection.end();
        return;
      }
      
      // Usuń transakcję manualną
      await connection.query('DELETE FROM transakcje WHERE id = ?', [transakcjaId]);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Transakcja została usunięta' }));
      await connection.end();
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
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
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
      background: #ffffff;
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
      background: linear-gradient(135deg, hsl(25 95% 53%) 0%, hsl(25 95% 45%) 100%);
      
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(249, 115, 22, 0.3);
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
      padding: 18px 24px;
      text-align: center;
      font-weight: 700;
      font-size: 1em;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      cursor: pointer;
      border: none;
      background: transparent;
      color: #9ca3af;
    }
    
    .status-tab.active {
      background: linear-gradient(135deg, hsl(25 95% 53%) 0%, hsl(25 95% 45%) 100%);
      color: white;
      box-shadow: inset 0 -3px 0 rgba(0,0,0,0.2);
    }
    
    .status-tab.active.to-prep {
      background: linear-gradient(135deg, #7c2d12 0%, #991b1b 100%);
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
      font-size: 1em;
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
      min-width: 180px;
    }
    
    .pizza-list {
      margin: 16px 0;
    }
    
    .pizza-item {
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
      padding: 14px 18px;
      margin: 8px 0;
      border-radius: 10px;
      border-left: 4px solid hsl(25 95% 53%);
      box-shadow: 0 2px 6px rgba(0,0,0,0.05);
    }
    
    .pizza-name {
      font-weight: 700;
      color: #1f2937;
      font-size: 1.3em;
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
      padding: 16px 24px;
      border: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 1.05em;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      background: linear-gradient(135deg, hsl(25 95% 53%) 0%, hsl(25 95% 45%) 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(255, 123, 0, 0.3);
    }
    
    .action-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(255, 123, 0, 0.4);
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
      color: hsl(25 95% 53%);
      padding: 14px 28px;
      border-radius: 12px;
      font-size: 1em;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.2s ease;
      text-transform: none;
      letter-spacing: 0.5px;
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
      padding: 14px 28px;
      border-radius: 24px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.2);
      font-weight: 700;
      color: hsl(25 95% 53%);
      font-size: 1em;
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
        Formularz Zamowienia
      </a>
      <a href="http://localhost:3006" class="refresh-btn" style="text-decoration: none;">
        POZ
      </a>
      <a href="/kuchnia/historia" class="refresh-btn" style="text-decoration: none;">
        Historia
      </a>
      <button class="refresh-btn" onclick="loadOrders()">
        Odswież
      </button>
    </div>
  </div>
  
  <div class="orders-container" id="ordersContainer">
    <div class="empty-state">
      <div class="empty-state-icon"></div>
      <p>Ladowanie zamowien...</p>
    </div>
  </div>
  
  <script>
    let lastUpdate = Date.now();
    
    let allSkladniki = [];
    let allPizzaSkladnik = [];
    
    async function loadOrders() {
      try {
        console.log('Ladowanie zamowien...');
        const response = await fetch('/api/kuchnia/zamowienia');
        const data = await response.json();
        console.log('Otrzymano zamowien:', data.orders.length);
        
        allSkladniki = data.skladniki || [];
        allPizzaSkladnik = data.pizzaSkladnik || [];
        
        renderOrders(data.orders, data.pizzas);
        lastUpdate = Date.now();
      } catch (error) {
        console.error('Blad ladowania zamowien:', error);
        document.getElementById('ordersContainer').innerHTML = '<div class="empty-state"><div class="empty-state-icon"></div><p>Blad ladowania: ' + error.message + '</p></div>';
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
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"></div><p>Blad: ' + error.message + '</p></div>';
      }
    }
    
    function renderOrderCard(order, pizzas) {
      try {
        const typeMap = { 'na_miejscu': 'Na miejscu', 'na_wynos': 'Na wynos', 'dowoz': 'Dowoz' };
        const orderTime = new Date(order.created_at).toLocaleTimeString('pl-PL');
        const currentStatus = order.status_kuchnia || 'do_przygotowania';
        
        let pizzaHtml = '';
        let extrasHtml = '';
        let drinkHtml = '';
        let sosyHtml = '';
        
        if (order.pizze && order.pizze.length > 0) {
          try {
            const pizzeArray = JSON.parse(order.pizze);
            console.log('[ORDER #' + order.id + '] pizzeArray:', pizzeArray.length, 'pizz');
            const allSkladniki = pizzas.flatMap(p => p.skladniki || []);
            const allPizzaSkladnik = pizzas.flatMap(p => p.pizza_skladnik || []);
          
          // Nowa część: parsowanie składników i modyfikacji
          let modyfikacjeMap = {};
          
          console.log('[ORDER #' + order.id + '] Sprawdzanie skladniki:', order.skladniki);
          
          if (order.skladniki) {
            const linie = order.skladniki.split(';').map(l => l.trim()).filter(l => l);
            
            console.log('[ORDER #' + order.id + '] Podzielone linie:', linie);
            
            linie.forEach(line => {
              console.log('[ORDER #' + order.id + '] Parsowanie linii:', line);
              
              // Format 1: NAZWA1 / NAZWA2 (pół na pół): [PIZZA1: mods] lub [PIZZA1: mods] [PIZZA2: mods]
              const mixedPolNaPolMatch = line.match(/^(.+?)\\s*\\/\\s*(.+?)\\s*\\(p[oó]ł\\s+na\\s+p[oó]ł\\):\\s*(.+)$/i);
              if (mixedPolNaPolMatch) {
                console.log('[ORDER #' + order.id + '] Znaleziono mixed pol na pol format');
                const pizza1Nazwa = mixedPolNaPolMatch[1].trim().toUpperCase();
                const pizza2Nazwa = mixedPolNaPolMatch[2].trim().toUpperCase();
                const modsString = mixedPolNaPolMatch[3].trim();
                
                // Parsuj modyfikacje w nawiasach kwadratowych
                const bracketsMatch = modsString.match(/\\[(.+?):\\s*(.+?)\\](?:\\s*\\[(.+?):\\s*(.+?)\\])?/);
                if (bracketsMatch) {
                  const pizza1 = bracketsMatch[1].trim().toUpperCase();
                  const mods1 = bracketsMatch[2].trim();
                  
                  const key = pizza1Nazwa + '|' + pizza2Nazwa;
                  if (!modyfikacjeMap[key]) {
                    modyfikacjeMap[key] = { isPolNaPol: true, left: null, right: null };
                  }
                  modyfikacjeMap[key].left = { name: pizza1, mods: mods1 };
                  
                  if (bracketsMatch[3] && bracketsMatch[4]) {
                    const pizza2 = bracketsMatch[3].trim().toUpperCase();
                    const mods2 = bracketsMatch[4].trim();
                    modyfikacjeMap[key].right = { name: pizza2, mods: mods2 };
                  }
                  console.log('[ORDER #' + order.id + '] Mixed format parsed: key=' + key + ', left=' + pizza1 + ', right=' + (bracketsMatch[3] || 'null'));
                  return;
                }
              }
              
              // Format 2: NAZWA1 / NAZWA2: [PIZZA1: mods] lub [PIZZA1: mods] [PIZZA2: mods]
              const polNaPolMatch = line.match(/^(.+?)\\s*\\/\\s*(.+?):\\s*(.+)$/i);
              if (polNaPolMatch) {
                console.log('[ORDER #' + order.id + '] Znaleziono pol na pol format (stary)');
                const pizza1Nazwa = polNaPolMatch[1].trim().toUpperCase();
                const pizza2Nazwa = polNaPolMatch[2].trim().toUpperCase();
                const modsString = polNaPolMatch[3].trim();
                
                // Sprawdź czy modyfikacje są w nowym formacie z nawiasami kwadratowymi
                const bracketsMatch = modsString.match(/\\[(.+?):\\s*(.+?)\\](?:\\s*\\[(.+?):\\s*(.+?)\\])?/);
                if (bracketsMatch) {
                  const pizza1 = bracketsMatch[1].trim().toUpperCase();
                  const mods1 = bracketsMatch[2].trim();
                  
                  const key = pizza1Nazwa + '|' + pizza2Nazwa;
                  if (!modyfikacjeMap[key]) {
                    modyfikacjeMap[key] = { isPolNaPol: true, left: null, right: null };
                  }
                  modyfikacjeMap[key].left = { name: pizza1, mods: mods1 };
                  
                  if (bracketsMatch[3] && bracketsMatch[4]) {
                    const pizza2 = bracketsMatch[3].trim().toUpperCase();
                    const mods2 = bracketsMatch[4].trim();
                    modyfikacjeMap[key].right = { name: pizza2, mods: mods2 };
                  }
                  console.log('[ORDER #' + order.id + '] Pol na pol (nowy format) parsed: key=' + key);
                } else {
                  // Stary format bez nawiasów - wszystkie modyfikacje dla pierwszej pizzy
                  const key = pizza1Nazwa + '|' + pizza2Nazwa;
                  if (!modyfikacjeMap[key]) {
                    modyfikacjeMap[key] = { isPolNaPol: true, left: null, right: null };
                  }
                  modyfikacjeMap[key].left = { name: pizza1Nazwa, mods: modsString };
                  console.log('[ORDER #' + order.id + '] Pol na pol (stary format) parsed: key=' + key);
                }
                return;
              }
              
              // Format 3: NAZWA: [PIZZA1: mods] lub [PIZZA1: mods] [PIZZA2: mods]
              const polNaPolFullMatch = line.match(/^(.+?):\\s*\\[(.+?):\\s*(.+?)\\](?:\\s*\\[(.+?):\\s*(.+?)\\])?$/i);
              if (polNaPolFullMatch) {
                console.log('[ORDER #' + order.id + '] Znaleziono pol na pol full format');
                const fullNazwa = polNaPolFullMatch[1].trim().toUpperCase();
                const pizza1 = polNaPolFullMatch[2].trim().toUpperCase();
                const mods1 = polNaPolFullMatch[3].trim();
                
                // Użyj kombinacji obu nazw jako klucza
                const pizza2Name = polNaPolFullMatch[4] ? polNaPolFullMatch[4].trim().toUpperCase() : '';
                const uniqueKey = pizza1 + '|' + pizza2Name;
                
                if (!modyfikacjeMap[uniqueKey]) {
                  modyfikacjeMap[uniqueKey] = { isPolNaPol: true, left: null, right: null, fullName: fullNazwa };
                }
                modyfikacjeMap[uniqueKey].left = { name: pizza1, mods: mods1 };
                
                if (polNaPolFullMatch[4] && polNaPolFullMatch[5]) {
                  const pizza2 = pizza2Name;
                  const mods2 = polNaPolFullMatch[5].trim();
                  modyfikacjeMap[uniqueKey].right = { name: pizza2, mods: mods2 };
                }
                console.log('[ORDER #' + order.id + '] Pol na pol full parsed: key=' + uniqueKey);
                return;
              }
              
              // Format 4: NAZWA: modyfikacje (format standardowy)
              const match = line.match(/^(.+?):\\s*(.+)$/);
              if (match) {
                const pizzaNazwa = match[1].trim().toUpperCase();
                const mods = match[2].trim();
                console.log('[ORDER #' + order.id + '] Standardowy format: pizza=' + pizzaNazwa + ', mods=' + mods);
                // Użyj tablicy dla pizz o tej samej nazwie
                if (!modyfikacjeMap[pizzaNazwa]) {
                  modyfikacjeMap[pizzaNazwa] = [];
                }
                modyfikacjeMap[pizzaNazwa].push({ isPolNaPol: false, mods: mods });
              }
            });
          }
          
          console.log('[ORDER #' + order.id + '] modyfikacjeMap:', JSON.stringify(modyfikacjeMap));
          
          // Liczniki dla pizz o tej samej nazwie (aby obsłużyć wiele pizz tego samego typu)
          const pizzaCounters = {};
          // Śledzenie użytych modyfikacji pizz pół na pół (aby nie przypisywać ich do zwykłych pizz)
          const usedPolNaPolMods = new Set();
          
          pizzaHtml = pizzeArray.map((pizza, idx) => {
            const pizzaData = pizzas.find(p => p.id === pizza.id);
            const pizzaName = pizzaData ? pizzaData.nazwa : 'Pizza ID:' + pizza.id;
              
              // Sprawdź czy to pizza pół na pół
              const isPolNaPol = pizza.polNaPol && pizza.polNaPol.id;
              
              if (isPolNaPol) {
                // Pizza pół na pół - renderuj jako jedną pizzę
                const pizza2Data = pizzas.find(p => p.id === pizza.polNaPol.id);
                const pizza2Name = pizza2Data ? pizza2Data.nazwa : 'Pizza ID:' + pizza.polNaPol.id;
                
                // Nazwa pizzy pół na pół
                const polNaPolName = pizzaName + ' / ' + pizza2Name + ' (pół na pół)';
                
                // Znajdź modyfikacje dla obu stron - używamy klucza PIZZA1|PIZZA2
                let modsArray = [];
                
                const pizzaNazwa1Upper = pizzaName.toUpperCase();
                const pizzaNazwa2Upper = pizza2Name.toUpperCase();
                const searchKey = pizzaNazwa1Upper + '|' + pizzaNazwa2Upper;
                
                console.log('[KUCHNIA] Szukam modyfikacji dla klucza: ' + searchKey);
                
                // Sprawdź czy jest wpis z tym kluczem
                if (modyfikacjeMap[searchKey]) {
                  const mapEntry = modyfikacjeMap[searchKey];
                  if (mapEntry.left && mapEntry.left.mods) {
                    modsArray.push(pizzaName.toUpperCase() + ': ' + mapEntry.left.mods);
                  }
                  if (mapEntry.right && mapEntry.right.mods) {
                    modsArray.push(pizza2Name.toUpperCase() + ': ' + mapEntry.right.mods);
                  }
                }
                
                const modsHtml = modsArray.length > 0 
                  ? '<div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 6px 10px; border-radius: 6px; font-size: 1.3em; font-weight: 700; margin-top: 6px; line-height: 1.4;">' + modsArray.join('; ') + '</div>'
                  : '';
                
                // Sprawdź czy pizza jest za kupony
                const kuponyHtml = pizza.isKupony 
                  ? '<span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 4px 12px; border-radius: 6px; font-size: 0.85em; font-weight: 700; margin-left: 10px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">🎟️ ZA KUPONY</span>'
                  : '';
                
                return '<div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 14px 18px; margin: 8px 0; border-radius: 10px; border-left: 4px solid hsl(25 95% 53%); box-shadow: 0 2px 6px rgba(0,0,0,0.05);">' +
                  '<div style="font-weight: 700; color: hsl(25 95% 53%); font-size: 1.4em; margin-bottom: 4px;">' + polNaPolName + ' - ' + pizza.rozmiar + kuponyHtml + '</div>' +
                  modsHtml +
                '</div>';
              }
              
              // Zwykła pizza - stary kod
              const pizzaData2 = pizzas.find(p => p.id === pizza.id);
              const pizzaName2 = pizzaData2 ? pizzaData2.nazwa : 'Pizza ID:' + pizza.id;
              
              // Pobierz składniki dla tej pizzy
              let skladnikiHtml = '';
              if (pizzaData2 && allPizzaSkladnik.length > 0) {
                const pizzaSkladnikiIds = allPizzaSkladnik
                  .filter(ps => ps.id_pizza === pizzaData2.id)
                  .map(ps => ps.id_skladnik);
                const pizzaSkladniki = allSkladniki
                  .filter(s => pizzaSkladnikiIds.includes(s.id))
                  .map(s => s.nazwa);
                if (pizzaSkladniki.length > 0) {
                  skladnikiHtml = '<div style="font-size: 1.3em; color: #6b7280; margin-top: 4px; line-height: 1.4;">' + pizzaSkladniki.join(', ') + '</div>';
                }
              }
              
              // Sprawdź czy są modyfikacje dla tej pizzy
              let modyfikacjeHtml = '';
              const pizzaNazwaUpper = pizzaName2.toUpperCase();
              
              // Inicjalizuj licznik dla tej nazwy pizzy jeśli jeszcze nie istnieje
              if (!pizzaCounters[pizzaNazwaUpper]) {
                pizzaCounters[pizzaNazwaUpper] = 0;
              }
              
              // Najpierw sprawdź czy to zwykła pizza - użyj licznika dla pizz o tej samej nazwie
              let modsData = null;
              const modsArray = modyfikacjeMap[pizzaNazwaUpper];
              if (Array.isArray(modsArray) && modsArray.length > pizzaCounters[pizzaNazwaUpper]) {
                modsData = modsArray[pizzaCounters[pizzaNazwaUpper]];
                pizzaCounters[pizzaNazwaUpper]++;
              }
              
              // Jeśli nie znaleziono, sprawdź czy ta pizza jest częścią pizzy pół na pół
              if (!modsData) {
                for (const key in modyfikacjeMap) {
                  const mapEntry = modyfikacjeMap[key];
                  if (mapEntry && mapEntry.isPolNaPol) {
                    // Sprawdź czy nazwa pizzy pasuje do lewej lub prawej strony
                    if (mapEntry.left && mapEntry.left.name.toUpperCase() === pizzaNazwaUpper && !usedPolNaPolMods.has(key + '_left')) {
                      modsData = { isPolNaPol: true, side: 'left', data: mapEntry.left, fullKey: key };
                      break;
                    }
                    if (mapEntry.right && mapEntry.right.name.toUpperCase() === pizzaNazwaUpper && !usedPolNaPolMods.has(key + '_right')) {
                      modsData = { isPolNaPol: true, side: 'right', data: mapEntry.right, fullKey: key };
                      break;
                    }
                  }
                }
              }
              
              if (modsData) {
                if (modsData.isPolNaPol && modsData.side) {
                  // Pizza pół na pół - pokaż tylko modyfikacje dla tej strony
                  const bgColor = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                  const textColor = 'white';
                  const arrow = modsData.side === 'left' ? '← ' : ' →';
                  modyfikacjeHtml = '<div style="background: ' + bgColor + '; color: ' + textColor + '; padding: 8px 14px; border-radius: 8px; font-size: 1.3em; font-weight: 700; line-height: 1.5; box-shadow: 0 2px 6px rgba(0,0,0,0.2); max-width: 220px; word-wrap: break-word;">';
                  modyfikacjeHtml += '<div style="font-size: 1.1em; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">PÓŁ NA PÓŁ ' + arrow + ':</div>';
                  modyfikacjeHtml += modsData.data.mods;
                  modyfikacjeHtml += '</div>';
                } else if (modsData.isPolNaPol) {
                  // Pokazanie pełnej pizzy pół na pół (nie powinno się zdarzyć, ale dla bezpieczeństwa)
                  modyfikacjeHtml = '<div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 8px 14px; border-radius: 8px; font-size: 1.3em; font-weight: 600; line-height: 1.5; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3); max-width: 250px; word-wrap: break-word;">';
                  // Nagłówek ZMIANY: usunięty
                  if (modsData.left) {
                    modyfikacjeHtml += '<div style="background: rgba(220, 38, 38, 0.3); padding: 4px 8px; border-radius: 4px; margin: 4px 0;"><span style="color: white;">← ' + modsData.left.name + ':</span> ' + modsData.left.mods + '</div>';
                  }
                  if (modsData.right) {
                    modyfikacjeHtml += '<div style="background: rgba(220, 38, 38, 0.3); padding: 4px 8px; border-radius: 4px; margin: 4px 0;"><span style="color: white;">' + modsData.right.name + ' →:</span> ' + modsData.right.mods + '</div>';
                  }
                  modyfikacjeHtml += '</div>';
                } else {
                  // Zwykła pizza
                  modyfikacjeHtml = '<div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 8px 14px; border-radius: 8px; font-size: 1.3em; font-weight: 600; line-height: 1.5; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3); max-width: 200px; word-wrap: break-word;">' + modsData.mods + '</div>';
                }
              }
              
              // Obsługa dodanych składników z JSON (fallback)
              if (!modyfikacjeHtml && pizza.dodane && Array.isArray(pizza.dodane) && pizza.dodane.length > 0) {
                const dodaneNazwy = pizza.dodane.map(idSkladnik => {
                  const skladnik = allSkladniki.find(s => s.id === idSkladnik);
                  return skladnik ? skladnik.nazwa : 'ID:' + idSkladnik;
                });
                modyfikacjeHtml = '<div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 8px 14px; border-radius: 8px; font-size: 1.3em; font-weight: 600; line-height: 1.5; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3); max-width: 200px; word-wrap: break-word;">+ ' + dodaneNazwy.join(', ') + '</div>';
              }
              
              // Obsługa usuniętych składników z JSON (fallback)
              if (!modyfikacjeHtml && pizza.usuniete && Array.isArray(pizza.usuniete) && pizza.usuniete.length > 0) {
                const usunietaNazwy = pizza.usuniete.map(idSkladnik => {
                  const skladnik = allSkladniki.find(s => s.id === idSkladnik);
                  return skladnik ? skladnik.nazwa : 'ID:' + idSkladnik;
                });
                modyfikacjeHtml = '<div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 8px 14px; border-radius: 8px; font-size: 1.3em; font-weight: 600; line-height: 1.5; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3); max-width: 200px; word-wrap: break-word;">- ' + usunietaNazwy.join(', ') + '</div>';
              }
              
              // Sprawdź czy pizza jest za kupony
              const kuponyBadge = pizza.isKupony 
                ? '<span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 3px 10px; border-radius: 5px; font-size: 0.75em; font-weight: 700; margin-left: 8px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3); vertical-align: middle;">🎟️ ZA KUPONY</span>'
                : '';
              
              return '<div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 14px 18px; margin: 8px 0; border-radius: 10px; border-left: 4px solid hsl(25 95% 53%); box-shadow: 0 2px 6px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;"><div style="flex: 1;"><div><span style="font-weight: 700; color: #1f2937; font-size: 1.3em;">' + pizzaName2 + '</span><span style="color: #6b7280; font-size: 0.9em; margin-left: 10px; font-weight: 600;">[' + pizza.rozmiar + ']</span>' + kuponyBadge + '</div>' + skladnikiHtml + '</div>' + modyfikacjeHtml + '</div>';
            }).join('');
          } catch (e) {
            console.error('Blad parsowania pizze:', e);
            pizzaHtml = '<div class="pizza-item">Blad odczytu pizzy</div>';
          }
        }
        
        let addressHtml = '';
        if (order.typ_zamowienia === 'dowoz') {
          addressHtml = '<div class="detail-row"><span class="detail-label">Telefon:</span> ' + (order.telefon || '-') + '</div>' +
                        '<div class="detail-row"><span class="detail-label">Adres:</span> ' + (order.adres || '-') + '</div>';
        }
        
        // Informacja o sosach
        if (order.sosy) {
          try {
            const sosy = JSON.parse(order.sosy);
            if (sosy.pom > 0 || sosy.czos > 0) {
              const sosyItems = [];
              if (sosy.pom > 0) sosyItems.push('Pomidorowy: ' + sosy.pom);
              if (sosy.czos > 0) sosyItems.push('Czosnkowy: ' + sosy.czos);
              sosyHtml = '<div class="detail-row" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 5px 7px; border-radius: 6px; margin: 4px 0; border-left: 3px solid #f59e0b; font-size: 1em;"><span class="detail-label" style="color: #92400e; font-weight: 700;">Sosy:</span> <span style="color: #78350f; font-weight: 600;">' + sosyItems.join(', ') + '</span></div>';
            }
          } catch (e) {
            console.error('Błąd parsowania sosów:', e);
          }
        }
        
        return '<div class="order-card">' +
          '<div class="status-tabs">' +
            '<button class="status-tab to-prep ' + (currentStatus === 'do_przygotowania' ? 'active' : '') + '" onclick="updateStatus(' + order.id + ', &apos;do_przygotowania&apos;)">Do przygotowania</button>' +
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
              sosyHtml +
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
          showToast('Blad aktualizacji statusu', 'error');
        }
      } catch (error) {
        console.error('Blad:', error);
        showToast('Blad polaczenia', 'error');
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
          showToast('Paragon wydrukowany!', 'success');
        } else {
          showToast('Blad drukowania: ' + result.error, 'error');
        }
      } catch (error) {
        console.error('Blad drukowania:', error);
        showToast('Blad polaczenia z drukarką', 'error');
      }
    }
    
    // Toast notification function
    function showToast(message, type) {
      const toast = document.createElement('div');
      let bgColor = 'hsl(25 95% 53%)';
      if (type === 'error') bgColor = '#ef4444';
      if (type === 'warning') bgColor = '#404040';
      
      toast.style.position = 'fixed';
      toast.style.top = '50%';
      toast.style.left = '50%';
      toast.style.transform = 'translate(-50%, -50%)';
      toast.style.background = bgColor;
      toast.style.color = 'white';
      toast.style.padding = '24px 32px';
      toast.style.borderRadius = '12px';
      toast.style.fontSize = '16px';
      toast.style.fontWeight = '500';
      toast.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.3)';
      toast.style.zIndex = '10000';
      toast.style.maxWidth = '90%';
      toast.style.textAlign = 'center';
      toast.style.animation = 'slideIn 0.3s ease-out';
      
      toast.textContent = message;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    // Add animation styles if not already present
    if (!document.getElementById('toast-animations')) {
      const style = document.createElement('style');
      style.id = 'toast-animations';
      style.textContent = '@keyframes slideIn { from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } } @keyframes slideOut { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } }';
      document.head.appendChild(style);
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
      
      // Pobierz zamówienia aktywne (nie gotowe) lub ostatnio zaktualizowane
      const [orders] = await connection.execute(
        `SELECT z.* FROM zamowienia z 
         WHERE (z.status_kuchnia != 'gotowe' AND DATE(z.updated_at) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY))
         OR (z.status_kuchnia = 'gotowe' AND z.updated_at > DATE_SUB(NOW(), INTERVAL 1 HOUR))
         ORDER BY 
           CASE z.status_kuchnia
             WHEN 'do_przygotowania' THEN 1
             WHEN 'w_trakcie' THEN 2
             WHEN 'gotowe' THEN 3
           END,
           z.created_at DESC`
      );
      
      const [pizzas] = await connection.execute('SELECT * FROM menu_pizza');
      
      // Pobierz składniki dla wszystkich pizz
      const [skladniki] = await connection.execute('SELECT * FROM skladniki');
      const [pizzaSkladnik] = await connection.execute('SELECT * FROM relacja_skladniki');
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ orders, pizzas, skladniki, pizzaSkladnik }));
      
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
  
  // API: Historia zamówień - ostatnie 15 gotowych
  if (pathname === '/api/kuchnia/historia' && req.method === 'GET') {
    let connection;
    try {
      connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Pepperoni13',
        database: 'SmartPizzApp13'
      });
      
      // Pobierz ostatnie 15 zamówień ze statusem 'gotowe', posortowane po updated_at (najnowsze na górze)
      const [orders] = await connection.execute(
        `SELECT z.* FROM zamowienia z 
         WHERE z.status_kuchnia = 'gotowe'
         ORDER BY z.updated_at DESC
         LIMIT 15`
      );
      
      const [pizzas] = await connection.execute('SELECT * FROM menu_pizza');
      
      // Pobierz składniki dla wszystkich pizz
      const [skladniki] = await connection.execute('SELECT * FROM skladniki');
      const [pizzaSkladnik] = await connection.execute('SELECT * FROM relacja_skladniki');
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ orders, pizzas, skladniki, pizzaSkladnik }));
      
      if (connection) await connection.end();
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
      if (connection) await connection.end();
    }
    return;
  }
  
  // Strona historii zamówień
  if (pathname === '/kuchnia/historia') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const historiaHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Historia Zamówień - Ostatnie Gotowe</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
      background: linear-gradient(135deg, hsl(25 95% 53%) 0%, hsl(25 95% 45%) 100%);
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
      background: linear-gradient(135deg, hsl(25 95% 53%) 0%, hsl(25 95% 45%) 100%);
      
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(249, 115, 22, 0.3);
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
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      overflow: hidden;
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
    
    .finished-time {
      background: #d1fae5;
      color: #065f46;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 1em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: inline-block;
    }
    
    .order-type {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 1em;
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
      min-width: 180px;
    }
    
    .pizza-list {
      margin: 16px 0;
    }
    
    .pizza-item {
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
      padding: 14px 18px;
      margin: 8px 0;
      border-radius: 10px;
      border-left: 4px solid hsl(25 95% 53%);
      box-shadow: 0 2px 6px rgba(0,0,0,0.05);
    }
    
    .pizza-name {
      font-weight: 700;
      color: #1f2937;
      font-size: 1.3em;
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
    
    .restore-actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 2px solid #f3f4f6;
    }
    
    .restore-btn {
      flex: 1;
      padding: 16px 24px;
      border: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 1.05em;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    .restore-btn.to-prep {
      background: linear-gradient(135deg, #7c2d12 0%, #991b1b 100%);
    }
    
    .restore-btn.to-prep:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(124, 45, 18, 0.4);
    }
    
    .restore-btn.to-progress {
      background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
    }
    
    .restore-btn.to-progress:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(30, 64, 175, 0.4);
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
      color: hsl(25 95% 53%);
      padding: 14px 28px;
      border-radius: 12px;
      font-size: 1em;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.2s ease;
      text-transform: none;
      letter-spacing: 0.5px;
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
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Historia Zamówień</h1>
      <p class="subtitle">Ostatnie 15 Gotowych Zamówień</p>
    </div>
    <div style="display: flex; gap: 12px; align-items: center;">
      <a href="/kuchnia" class="refresh-btn" style="text-decoration: none;">
         Panel Kuchni
      </a>
      <button class="refresh-btn" onclick="loadHistory()">
        Odśwież
      </button>
    </div>
  </div>
  
  <div class="orders-container" id="ordersContainer">
    <div class="empty-state">
      <div class="empty-state-icon">📦</div>
      <p>Ładowanie historii...</p>
    </div>
  </div>
  
  <script>
    let allSkladniki = [];
    let allPizzaSkladnik = [];
    
    async function loadHistory() {
      try {
        console.log('Ładowanie historii...');
        const response = await fetch('/api/kuchnia/historia');
        const data = await response.json();
        console.log('Otrzymano zamówień:', data.orders.length);
        
        allSkladniki = data.skladniki || [];
        allPizzaSkladnik = data.pizzaSkladnik || [];
        
        renderOrders(data.orders, data.pizzas);
      } catch (error) {
        console.error('Błąd ładowania historii:', error);
        document.getElementById('ordersContainer').innerHTML = '<div class="empty-state"><div class="empty-state-icon"></div><p>Błąd ładowania: ' + error.message + '</p></div>';
      }
    }
    
    function renderOrders(orders, pizzas) {
      const container = document.getElementById('ordersContainer');
      console.log('Renderowanie zamówień:', orders.length);
      
      if (orders.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"></div><p>Brak zamówień w historii</p></div>';
        return;
      }
      
      try {
        container.innerHTML = orders.map(order => renderOrderCard(order, pizzas)).join('');
        console.log('Zamówienia wyrenderowane');
      } catch (error) {
        console.error('Błąd renderowania:', error);
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"></div><p>Błąd: ' + error.message + '</p></div>';
      }
    }
    
    function renderOrderCard(order, pizzas) {
      try {
        const typeMap = { 'na_miejscu': 'Na miejscu', 'na_wynos': 'Na wynos', 'dowoz': 'Dowóz' };
        const orderTime = new Date(order.created_at).toLocaleString('pl-PL');
        const finishedTime = new Date(order.updated_at).toLocaleString('pl-PL');
        
        let pizzaHtml = '';
        if (order.pizze) {
          try {
            const pizzeArray = JSON.parse(order.pizze);
            
            // Parsuj modyfikacje z pola skladniki (format: "NAZWA_PIZZY: +skladnik1, -skladnik2" lub "[PIZZA1: mod] [PIZZA2: mod]")
            let modyfikacjeMap = {};
            if (order.skladniki && typeof order.skladniki === 'string' && order.skladniki.trim() !== '') {
              const modLines = order.skladniki.split(';');
              modLines.forEach(line => {
                line = line.trim();
                
                // FORMAT MIESZANY: "NAZWA1 / NAZWA2 (pół na pół): [PIZZA: mods]" lub "[PIZZA1: mods] [PIZZA2: mods]"
                // Użyj . zamiast dokładnych polskich znaków (pół = p + 2 dowolne znaki)
                const mixedPolNaPolMatch = line.match(/^(.+?)\\s*\\/\\s*(.+?)\\s*\\(p..\\s+na\\s+p..\\):\\s*(.+)$/i);
                if (mixedPolNaPolMatch) {
                  const pizza1Name = mixedPolNaPolMatch[1].trim();
                  const pizza2Name = mixedPolNaPolMatch[2].trim();
                  const modsString = mixedPolNaPolMatch[3].trim();
                  const fullPizzaName = pizza1Name + '|' + pizza2Name;
                  
                  // Sprawdź czy są nawiasy kwadratowe w modyfikacjach
                  const bracketsMatch = modsString.match(/\\[(.+?):\\s*(.+?)\\](?:\\s*\\[(.+?):\\s*(.+?)\\])?/);
                  if (bracketsMatch) {
                    // Format z nawiasami: [PIZZA1: mods] lub [PIZZA1: mods] [PIZZA2: mods]
                    const modPizzaName1 = bracketsMatch[1].trim();
                    const mod1Text = bracketsMatch[2].trim();
                    const modPizzaName2 = bracketsMatch[3] ? bracketsMatch[3].trim() : null;
                    const mod2Text = bracketsMatch[4] ? bracketsMatch[4].trim() : null;
                    
                    // Przypisz modyfikacje do właściwych stron na podstawie nazw pizz
                    const mods1 = modPizzaName1.toUpperCase() === pizza1Name.toUpperCase() ? mod1Text : (modPizzaName2 && modPizzaName2.toUpperCase() === pizza1Name.toUpperCase() ? mod2Text : '');
                    const mods2 = modPizzaName1.toUpperCase() === pizza2Name.toUpperCase() ? mod1Text : (modPizzaName2 && modPizzaName2.toUpperCase() === pizza2Name.toUpperCase() ? mod2Text : '');
                    
                    modyfikacjeMap[fullPizzaName.toUpperCase()] = {
                      isPolNaPol: true,
                      left: mods1 ? { name: pizza1Name, mods: mods1 } : null,
                      right: mods2 ? { name: pizza2Name, mods: mods2 } : null
                    };
                  } else {
                    // Stary format bez nawiasów - modyfikacje dla obu stron
                    modyfikacjeMap[fullPizzaName.toUpperCase()] = {
                      isPolNaPol: true,
                      left: { name: pizza1Name, mods: modsString },
                      right: { name: pizza2Name, mods: modsString }
                    };
                  }
                } else {
                  // NOWY FORMAT: "NAZWA: [PIZZA1: mods]" lub "NAZWA: [PIZZA1: mods] [PIZZA2: mods]"
                  const polNaPolFullMatch = line.match(/^(.+?):\\s*\\[(.+?):\\s*(.+?)\\](?:\\s*\\[(.+?):\\s*(.+?)\\])?$/i);
                  if (polNaPolFullMatch) {
                    const pizzaName = polNaPolFullMatch[1].trim();
                    const pizza1Name = polNaPolFullMatch[2].trim();
                    const pizza1Mods = polNaPolFullMatch[3].trim();
                    const pizza2Name = polNaPolFullMatch[4] ? polNaPolFullMatch[4].trim() : null;
                    const pizza2Mods = polNaPolFullMatch[5] ? polNaPolFullMatch[5].trim() : null;
                    
                    modyfikacjeMap[pizzaName.toUpperCase()] = {
                      isPolNaPol: true,
                      left: pizza1Name ? { name: pizza1Name, mods: pizza1Mods } : null,
                      right: pizza2Name ? { name: pizza2Name, mods: pizza2Mods } : null
                    };
                  } else {
                    // Standardowy format: "NAZWA_PIZZY: +skladnik1, -skladnik2"
                    const match = line.match(/^(.+?):\\s*(.+)$/);
                    if (match) {
                      const pizzaNazwa = match[1].trim().toUpperCase();
                      const mods = match[2].trim();
                      // Użyj tablicy dla pizz o tej samej nazwie
                      if (!modyfikacjeMap[pizzaNazwa]) {
                        modyfikacjeMap[pizzaNazwa] = [];
                      }
                      modyfikacjeMap[pizzaNazwa].push({ isPolNaPol: false, mods: mods });
                    }
                  }
                }
              });
            }
            
            // Liczniki dla pizz o tej samej nazwie (aby obsłużyć wiele pizz tego samego typu)
            const pizzaCounters = {};
            // Śledzenie użytych modyfikacji pizz pół na pół (aby nie przypisywać ich do zwykłych pizz)
            const usedPolNaPolMods = new Set();
            
            pizzaHtml = pizzeArray.map((pizza, idx) => {
              const pizzaData = pizzas.find(p => p.id === pizza.id);
              const pizzaName = pizzaData ? pizzaData.nazwa : 'Pizza ID:' + pizza.id;
              
              // Sprawdź czy to pizza pół na pół
              const isPolNaPol = pizza.polNaPol && pizza.polNaPol.id;
              
              if (isPolNaPol) {
                // Pizza pół na pół - renderuj jako jedną pizzę
                const pizza2Data = pizzas.find(p => p.id === pizza.polNaPol.id);
                const pizza2Name = pizza2Data ? pizza2Data.nazwa : 'Pizza ID:' + pizza.polNaPol.id;
                
                // Nazwa pizzy pół na pół
                const polNaPolName = pizzaName + ' / ' + pizza2Name + ' (pół na pół)';
                
                // Znajdź modyfikacje dla obu stron
                let modsArray = [];
                
                const pizzaNazwa1Upper = pizzaName.toUpperCase();
                const pizzaNazwa2Upper = pizza2Name.toUpperCase();
                
                for (const key in modyfikacjeMap) {
                  const mapEntry = modyfikacjeMap[key];
                  if (mapEntry.isPolNaPol) {
                    if (mapEntry.left && mapEntry.left.name.toUpperCase() === pizzaNazwa1Upper) {
                      modsArray.push(pizzaName.toUpperCase() + ': ' + mapEntry.left.mods);
                      // Oznacz tę modyfikację jako użytą
                      usedPolNaPolMods.add(key + '_left');
                    }
                    if (mapEntry.right && mapEntry.right.name.toUpperCase() === pizzaNazwa2Upper) {
                      modsArray.push(pizza2Name.toUpperCase() + ': ' + mapEntry.right.mods);
                      // Oznacz tę modyfikację jako użytą
                      usedPolNaPolMods.add(key + '_right');
                    }
                  }
                }
                
                const modsHtml = modsArray.length > 0 
                  ? '<div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 6px 10px; border-radius: 6px; font-size: 1.3em; font-weight: 700; margin-top: 6px; line-height: 1.4;">' + modsArray.join('; ') + '</div>'
                  : '';
                
                // Sprawdź czy pizza jest za kupony
                const kuponyHtml = pizza.isKupony 
                  ? '<span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 4px 12px; border-radius: 6px; font-size: 0.85em; font-weight: 700; margin-left: 10px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">🎟️ ZA KUPONY</span>'
                  : '';
                
                return '<div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 14px 18px; margin: 8px 0; border-radius: 10px; border-left: 4px solid hsl(25 95% 53%); box-shadow: 0 2px 6px rgba(0,0,0,0.05);">' +
                  '<div style="font-weight: 700; color: hsl(25 95% 53%); font-size: 1.4em; margin-bottom: 4px;">' + polNaPolName + ' - ' + pizza.rozmiar + kuponyHtml + '</div>' +
                  modsHtml +
                '</div>';
              }
              
              // Zwykła pizza - stary kod
              const pizzaData2 = pizzas.find(p => p.id === pizza.id);
              const pizzaName2 = pizzaData2 ? pizzaData2.nazwa : 'Pizza ID:' + pizza.id;
              
              // Pobierz składniki dla tej pizzy
              let skladnikiHtml = '';
              if (pizzaData2 && allPizzaSkladnik.length > 0) {
                const pizzaSkladnikiIds = allPizzaSkladnik
                  .filter(ps => ps.id_pizza === pizzaData2.id)
                  .map(ps => ps.id_skladnik);
                const pizzaSkladniki = allSkladniki
                  .filter(s => pizzaSkladnikiIds.includes(s.id))
                  .map(s => s.nazwa);
                if (pizzaSkladniki.length > 0) {
                  skladnikiHtml = '<div style="font-size: 1.3em; color: #6b7280; margin-top: 4px; line-height: 1.4;">' + pizzaSkladniki.join(', ') + '</div>';
                }
              }
              
              // Sprawdź czy są modyfikacje dla tej pizzy
              let modyfikacjeHtml = '';
              const pizzaNazwaUpper = pizzaName2.toUpperCase();
              
              // Inicjalizuj licznik dla tej nazwy pizzy jeśli jeszcze nie istnieje
              if (!pizzaCounters[pizzaNazwaUpper]) {
                pizzaCounters[pizzaNazwaUpper] = 0;
              }
              
              // Najpierw sprawdź czy to zwykła pizza - użyj licznika dla pizz o tej samej nazwie
              let modsData = null;
              const modsArray = modyfikacjeMap[pizzaNazwaUpper];
              if (Array.isArray(modsArray) && modsArray.length > pizzaCounters[pizzaNazwaUpper]) {
                modsData = modsArray[pizzaCounters[pizzaNazwaUpper]];
                pizzaCounters[pizzaNazwaUpper]++;
              }
              
              // Jeśli nie znaleziono, sprawdź czy ta pizza jest częścią pizzy pół na pół
              if (!modsData) {
                for (const key in modyfikacjeMap) {
                  const mapEntry = modyfikacjeMap[key];
                  if (mapEntry && mapEntry.isPolNaPol) {
                    // Sprawdź czy nazwa pizzy pasuje do lewej lub prawej strony
                    if (mapEntry.left && mapEntry.left.name.toUpperCase() === pizzaNazwaUpper && !usedPolNaPolMods.has(key + '_left')) {
                      modsData = { isPolNaPol: true, side: 'left', data: mapEntry.left, fullKey: key };
                      break;
                    }
                    if (mapEntry.right && mapEntry.right.name.toUpperCase() === pizzaNazwaUpper && !usedPolNaPolMods.has(key + '_right')) {
                      modsData = { isPolNaPol: true, side: 'right', data: mapEntry.right, fullKey: key };
                      break;
                    }
                  }
                }
              }
              
              if (modsData) {
                if (modsData.isPolNaPol && modsData.side) {
                  // Pizza pół na pół - pokaż tylko modyfikacje dla tej strony
                  const bgColor = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                  const textColor = 'white';
                  const arrow = modsData.side === 'left' ? '← ' : ' →';
                  modyfikacjeHtml = '<div style="background: ' + bgColor + '; color: ' + textColor + '; padding: 8px 14px; border-radius: 8px; font-size: 1.3em; font-weight: 700; line-height: 1.5; box-shadow: 0 2px 6px rgba(0,0,0,0.2); max-width: 220px; word-wrap: break-word;">';
                  modyfikacjeHtml += '<div style="font-size: 1.1em; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">PÓŁ NA PÓŁ ' + arrow + ':</div>';
                  modyfikacjeHtml += modsData.data.mods;
                  modyfikacjeHtml += '</div>';
                } else if (modsData.isPolNaPol) {
                  // Pokazanie pełnej pizzy pół na pół (nie powinno się zdarzyć, ale dla bezpieczeństwa)
                  modyfikacjeHtml = '<div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 8px 14px; border-radius: 8px; font-size: 1.3em; font-weight: 600; line-height: 1.5; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3); max-width: 250px; word-wrap: break-word;">';
                  // Nagłówek ZMIANY: usunięty
                  if (modsData.left) {
                    modyfikacjeHtml += '<div style="background: rgba(220, 38, 38, 0.3); padding: 4px 8px; border-radius: 4px; margin: 4px 0;"><span style="color: white;">← ' + modsData.left.name + ':</span> ' + modsData.left.mods + '</div>';
                  }
                  if (modsData.right) {
                    modyfikacjeHtml += '<div style="background: rgba(220, 38, 38, 0.3); padding: 4px 8px; border-radius: 4px; margin: 4px 0;"><span style="color: white;">' + modsData.right.name + ' →:</span> ' + modsData.right.mods + '</div>';
                  }
                  modyfikacjeHtml += '</div>';
                } else {
                  // Zwykła pizza
                  modyfikacjeHtml = '<div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 8px 14px; border-radius: 8px; font-size: 1.3em; font-weight: 600; line-height: 1.5; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3); max-width: 200px; word-wrap: break-word;">' + modsData.mods + '</div>';
                }
              }
              
              // Obsługa dodanych składników z JSON (fallback)
              if (!modyfikacjeHtml && pizza.dodane && Array.isArray(pizza.dodane) && pizza.dodane.length > 0) {
                const dodaneNazwy = pizza.dodane.map(idSkladnik => {
                  const skladnik = allSkladniki.find(s => s.id === idSkladnik);
                  return skladnik ? skladnik.nazwa : 'ID:' + idSkladnik;
                });
                modyfikacjeHtml = '<div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 8px 14px; border-radius: 8px; font-size: 1.3em; font-weight: 600; line-height: 1.5; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3); max-width: 200px; word-wrap: break-word;">+ ' + dodaneNazwy.join(', ') + '</div>';
              }
              
              // Obsługa usuniętych składników z JSON (fallback)
              if (!modyfikacjeHtml && pizza.usuniete && Array.isArray(pizza.usuniete) && pizza.usuniete.length > 0) {
                const usunietaNazwy = pizza.usuniete.map(idSkladnik => {
                  const skladnik = allSkladniki.find(s => s.id === idSkladnik);
                  return skladnik ? skladnik.nazwa : 'ID:' + idSkladnik;
                });
                modyfikacjeHtml = '<div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 8px 14px; border-radius: 8px; font-size: 1.3em; font-weight: 600; line-height: 1.5; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3); max-width: 200px; word-wrap: break-word;">- ' + usunietaNazwy.join(', ') + '</div>';
              }
              
              // Sprawdź czy pizza jest za kupony
              const kuponyBadge = pizza.isKupony 
                ? '<span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 3px 10px; border-radius: 5px; font-size: 0.75em; font-weight: 700; margin-left: 8px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3); vertical-align: middle;">🎟️ ZA KUPONY</span>'
                : '';
              
              return '<div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 14px 18px; margin: 8px 0; border-radius: 10px; border-left: 4px solid hsl(25 95% 53%); box-shadow: 0 2px 6px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;"><div style="flex: 1;"><div><span style="font-weight: 700; color: #1f2937; font-size: 1.3em;">' + pizzaName2 + '</span><span style="color: #6b7280; font-size: 0.9em; margin-left: 10px; font-weight: 600;">[' + pizza.rozmiar + ']</span>' + kuponyBadge + '</div>' + skladnikiHtml + '</div>' + modyfikacjeHtml + '</div>';
            }).join('');
          } catch (e) {
            console.error('Błąd parsowania pizze:', e);
            pizzaHtml = '<div class="pizza-item">Błąd odczytu pizzy</div>';
          }
        }
        
        let addressHtml = '';
        if (order.typ_zamowienia === 'dowoz') {
          addressHtml = '<div class="detail-row"><span class="detail-label">Telefon:</span> ' + (order.telefon || '-') + '</div>' +
                        '<div class="detail-row"><span class="detail-label">Adres:</span> ' + (order.adres || '-') + '</div>';
        }
        
        // Informacja o sosach
        let sosyHtml = '';
        if (order.sosy) {
          try {
            const sosy = JSON.parse(order.sosy);
            if (sosy.pom > 0 || sosy.czos > 0) {
              const sosyItems = [];
              if (sosy.pom > 0) sosyItems.push('Pomidorowy: ' + sosy.pom);
              if (sosy.czos > 0) sosyItems.push('Czosnkowy: ' + sosy.czos);
              sosyHtml = '<div class="detail-row" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 5px 7px; border-radius: 6px; margin: 4px 0; border-left: 3px solid #f59e0b; font-size: 1em;"><span class="detail-label" style="color: #92400e; font-weight: 700;">Sosy:</span> <span style="color: #78350f; font-weight: 600;">' + sosyItems.join(', ') + '</span></div>';
            }
          } catch (e) {
            console.error('Błąd parsowania sosów:', e);
          }
        }
        
        return '<div class="order-card">' +
          '<div class="order-header">' +
            '<div class="order-id">#' + order.id + '</div>' +
            '<div>' +
              '<div class="order-time">Utworzono: ' + orderTime + '</div>' +
              '<div class="finished-time">✅ Gotowe: ' + finishedTime + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="order-type ' + order.typ_zamowienia + '">' + (typeMap[order.typ_zamowienia] || order.typ_zamowienia) + '</div>' +
          '<div class="order-details">' +
            addressHtml +
            '<div class="pizza-list">' + pizzaHtml + '</div>' +
            sosyHtml +
            '<div class="detail-row"><span class="detail-label">Cena:</span> ' + order.cena_calkowita + ' PLN</div>' +
            '<div class="detail-row"><span class="detail-label">Płatność:</span> ' + order.platnosc + '</div>' +
          '</div>' +
          '<div class="restore-actions">' +
            '<button class="restore-btn to-prep" onclick="restoreOrder(' + order.id + ', \\'do_przygotowania\\')">⬅️ Do Przygotowania</button>' +
            '<button class="restore-btn to-progress" onclick="restoreOrder(' + order.id + ', \\'w_trakcie\\')">⬅️ W Trakcie</button>' +
          '</div>' +
        '</div>';
      } catch (error) {
        console.error('Błąd renderowania karty zamówienia ID ' + order.id + ':', error);
        return '<div class="order-card"><div class="order-content">Błąd: ' + error.message + '</div></div>';
      }
    }
    
    async function restoreOrder(orderId, newStatus) {
      if (!confirm('Czy na pewno chcesz przywrócić to zamówienie?')) {
        return;
      }
      
      try {
        const response = await fetch('/api/kuchnia/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, status: newStatus })
        });
        
        if (response.ok) {
          showToast('Zamówienie przywrócone do panelu kuchni!', 'success');
          loadHistory();
        } else {
          showToast('Błąd przywracania zamówienia', 'error');
        }
      } catch (error) {
        console.error('Błąd:', error);
        showToast('Błąd połączenia', 'error');
      }
    }
    
    // Initial load
    loadHistory();
  </script>
</body>
</html>
    `;
    res.end(historiaHtml);
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
            const GS = 0x1D;////////////////////////////////////////////////////////
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
              receipt.push(...LEFT, ...SIZE_DOUBLE, ...BOLD_ON);
              receipt.push(...Buffer.from(toAscii(`Tel: ${order.telefon || '-'}\n`), 'utf-8'));
              receipt.push(LF);
              receipt.push(...BOLD_OFF, ...SIZE_NORMAL);
              receipt.push(...Buffer.from(toAscii(`Adres: ${order.adres || '-'}\n`), 'utf-8'));
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
            receipt.push(LF, LF, LF, LF); // Kilka linii pustych (brak automatycznego cięcia)
            
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
  
  // Endpoint drukowania ostatniego zamówienia
  if (pathname === '/api/print-latest') {
    // Obsługa CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
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
      
      // Pobierz ostatnie zamówienie
      const [orders] = await connection.execute(
        `SELECT z.*, k.nazwa as kierowca_nazwa 
         FROM zamowienia z
         LEFT JOIN sesje s ON z.sesja_id = s.id
         LEFT JOIN kierowcy k ON s.kierowca_id = k.id
         ORDER BY z.created_at DESC
         LIMIT 1`
      );
      
      if (!orders || orders.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Brak zamówień' }));
        if (connection) await connection.end();
        return;
      }
      
      // Pobierz dane pizz i napojów
      const [pizzas] = await connection.execute('SELECT * FROM menu_pizza');
      const [napoje] = await connection.execute('SELECT * FROM napoje');
      const [pozycjeExtra] = await connection.execute('SELECT * FROM pozycje_extra');
      
      // Funkcja drukowania (ta sama co w /print-receipt)
      const printReceipt = (order) => {
        return new Promise((resolve, reject) => {
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
          
          const printerPath = process.env.PRINTER_PORT || '/dev/usb/lp0';
          console.log(`Drukowanie ostatniego zamówienia na: ${printerPath}`);
          
          if (!fs.existsSync(printerPath)) {
            const error = new Error(`Drukarka nie znaleziona: ${printerPath}`);
            console.error(error.message);
            reject(error);
            return;
          }
          
          const ESC = 0x1B;
          const GS = 0x1D;
          const LF = 0x0A;
          const CENTER = [ESC, 0x61, 0x01];
          const LEFT = [ESC, 0x61, 0x00];
          const BOLD_ON = [ESC, 0x45, 0x01];
          const BOLD_OFF = [ESC, 0x45, 0x00];
          const SIZE_NORMAL = [GS, 0x21, 0x00];
          const SIZE_DOUBLE = [GS, 0x21, 0x11];
          
          let receipt = [];
          receipt.push(ESC, 0x40);
          receipt.push(...CENTER, ...SIZE_DOUBLE, ...BOLD_ON);
          receipt.push(...Buffer.from('PizzApp13\n', 'utf-8'));
          receipt.push(...BOLD_OFF, ...SIZE_NORMAL);
          receipt.push(...Buffer.from('================================\n', 'utf-8'));
          
          const orderDate = new Date(order.created_at).toLocaleString('pl-PL');
          receipt.push(...Buffer.from(`Data: ${orderDate}\n`, 'utf-8'));
          receipt.push(...Buffer.from('================================\n', 'utf-8'));
          
          const typMap = { 'na_miejscu': 'Na miejscu', 'na_wynos': 'Na wynos', 'dowoz': 'Dowoz' };
          receipt.push(...Buffer.from(`Typ: ${typMap[order.typ_zamowienia] || order.typ_zamowienia}\n`, 'utf-8'));
          
          receipt.push(...LEFT, ...SIZE_DOUBLE, ...BOLD_ON);
          receipt.push(...Buffer.from(toAscii(`Tel: ${order.telefon || '-'}\n`), 'utf-8'));
          receipt.push(LF);
          receipt.push(...BOLD_OFF, ...SIZE_NORMAL);
          receipt.push(...Buffer.from(toAscii(`Adres: ${order.adres || '-'}\n`), 'utf-8'));
          receipt.push(...Buffer.from('================================\n', 'utf-8'));
          
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
          
          if (order.skladniki) {
            receipt.push(...BOLD_ON);
            receipt.push(...Buffer.from('Modyfikacje:\n', 'utf-8'));
            receipt.push(...BOLD_OFF);
            receipt.push(...Buffer.from(toAscii(`  ${order.skladniki.replace(/<br>/g, '\n  ')}\n`), 'utf-8'));
          }
          
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
          receipt.push(...CENTER);
          receipt.push(...Buffer.from('Smacznego!\n', 'utf-8'));
          receipt.push(LF, LF, LF, LF);
          
          try {
            const buffer = Buffer.from(receipt);
            fs.writeFileSync(printerPath, buffer);
            console.log(` Wydrukowano paragon dla zamówienia #${order.id}`);
            resolve();
          } catch (err) {
            console.error(' Błąd wysyłania do drukarki:', err.message);
            reject(err);
          }
        });
      };
      
      // Drukuj zamówienie
      await printReceipt(orders[0]);
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, orderId: orders[0].id }));
      
      if (connection) await connection.end();
    } catch (error) {
      console.error('Błąd drukowania ostatniego zamówienia:', error);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
      if (connection) await connection.end();
    }
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
    const [pozycjeExtra] = await connection.execute('SELECT * FROM pozycje_extra');
    
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
    
    // Helper function do formatowania dodatków
    const formatDodatkiInfo = (dodatkiJson) => {
      if (!dodatkiJson) return '-';
      try {
        const dodatkiIds = JSON.parse(dodatkiJson);
        if (Array.isArray(dodatkiIds)) {
          if (dodatkiIds.length === 0) return '-';
          return dodatkiIds.map(id => {
            const extraData = pozycjeExtra.find(e => e.id == id);
            return extraData ? extraData.nazwa : `ID:${id}`;
          }).join('<br>');
        }
        return '-';
      } catch (e) {
        return dodatkiJson;
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
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      background: #f3f4f6;
      min-height: 100vh;
      padding: 20px;
    }
    table { 
      border-collapse: collapse; 
      width: 100%; 
      background: rgba(255, 255, 255, 0.95);
      
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
      border-radius: 20px;
      overflow: hidden;
      table-layout: fixed;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    th, td { 
      border: 1px solid #e5e7eb; 
      padding: 16px 18px; 
      text-align: left; 
      font-size: 15px;
      line-height: 1.6;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    th { 
      background: hsl(25 95% 53%);
      color: white;
      font-weight: 700;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-left: 2px solid white;
      border-right: 2px solid white;
      white-space: nowrap;
    }
    th:first-child {
      border-left: none;
    }
    th:last-child {
      border-right: none;
    }
    td {
      color: #1f2937;
    }
    tr:hover {
      background-color: #f9fafb;
      transition: background-color 0.2s ease;
    }
    .refresh-btn { 
      background: linear-gradient(135deg, hsl(25 95% 53%) 0%, hsl(25 95% 45%) 100%);
      color: white; 
      padding: 14px 24px; 
      border: none; 
      border-radius: 12px; 
      cursor: pointer;
      font-size: 15px;
      font-weight: 700;
      box-shadow: 0 6px 20px rgba(255, 123, 0, 0.4);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .refresh-btn:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 10px 30px rgba(255, 123, 0, 0.5);
    }
    .filters-container {
      background: rgba(255, 255, 255, 0.95);
      
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
      gap: 3px;
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
      font-size: 14px;
      transition: all 0.3s ease;
      background: white;
      font-weight: 500;
    }
    .filter-group select:focus,
    .filter-group input:focus {
      outline: none;
      border-color: hsl(25 95% 53%);
      box-shadow: 0 0 0 3px rgba(255, 123, 0, 0.1);
    }
    .search-input {
      width: 220px;
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
      background: #404040;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      position: relative;
      overflow: hidden;
    }
    .apply-btn:hover {
      background: #505050;
      transform: translateY(-3px) scale(1.02);
    }
    .apply-btn:active {
      transform: translateY(-1px) scale(0.98);
    }
    .edit-btn {
      background: linear-gradient(135deg, hsl(25 95% 53%) 0%, hsl(25 95% 45%) 100%);
      color: white;
      padding: 10px 18px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      margin-bottom: 3px;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(255, 123, 0, 0.3);
    }
    .edit-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(255, 123, 0, 0.4);
    }
    .delete-btn {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 10px 18px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
    }
    .delete-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    }
    .save-btn {
      background: linear-gradient(135deg, hsl(25 95% 53%) 0%, hsl(25 95% 45%) 100%);
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
      margin-right: 4px;
      font-weight: 700;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(255, 123, 0, 0.3);
    }
    .save-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(255, 123, 0, 0.4);
    }
    .cancel-btn {
      background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 700;
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
      padding: 12px;
      font-size: 15px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      width: 100%;
      margin-bottom: 8px;
      font-weight: 500;
    }
    select.payment-select:focus {
      outline: none;
      border-color: hsl(25 95% 53%);
      box-shadow: 0 0 0 3px rgba(255, 123, 0, 0.1);
    }
    input.edit-input {
      padding: 12px;
      font-size: 15px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      width: 100%;
      margin-bottom: 8px;
      font-weight: 500;
    }
    /* Ukryj strzałki w polach numerycznych */
    input.edit-input::-webkit-outer-spin-button,
    input.edit-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    input.edit-input[type=number] {
      -moz-appearance: textfield;
    }
    input.edit-input:focus {
      outline: none;
      border-color: hsl(25 95% 53%);
      box-shadow: 0 0 0 3px rgba(255, 123, 0, 0.1);
    }
    .print-btn {
      background: linear-gradient(135deg, hsl(25 95% 53%) 0%, hsl(25 95% 45%) 100%);
      color: white;
      padding: 16px 32px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 700;
      box-shadow: 0 6px 20px rgba(255, 123, 0, 0.4);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 20px;
    }
    .print-btn:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 10px 30px rgba(255, 123, 0, 0.5);
    }
    .print-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    .order-checkbox {
      width: 22px;
      height: 22px;
      cursor: pointer;
      accent-color: hsl(25 95% 53%);
    }
    #select-all-checkbox {
      width: 22px;
      height: 22px;
      cursor: pointer;
      accent-color: hsl(25 95% 53%);
    }
    
    /* Klawiatura ekranowa */
    #screen-keyboard {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%);
      padding: 20px;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: none;
      border-top: 3px solid hsl(25 95% 53%);
    }
    #screen-keyboard.visible {
      display: block;
      animation: slideUp 0.3s ease-out;
    }
    @keyframes slideUp {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }
    .keyboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 2px solid #444;
    }
    .keyboard-title {
      color: hsl(25 95% 53%);
      font-size: 18px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .keyboard-close {
      background: #dc2626;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s;
    }
    .keyboard-close:hover {
      background: #b91c1c;
      transform: scale(1.05);
    }
    .keyboard-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      justify-content: center;
    }
    .keyboard-key {
      background: linear-gradient(180deg, #404040 0%, #2a2a2a 100%);
      color: white;
      border: 1px solid #555;
      padding: 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 18px;
      font-weight: 600;
      min-width: 55px;
      text-align: center;
      transition: all 0.15s;
      user-select: none;
    }
    .keyboard-key:hover {
      background: linear-gradient(180deg, #505050 0%, #3a3a3a 100%);
      border-color: hsl(25 95% 53%);
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(255, 123, 0, 0.3);
    }
    .keyboard-key:active {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(255, 123, 0, 0.2);
    }
    .keyboard-key.space {
      flex: 1;
      max-width: 400px;
    }
    .keyboard-key.backspace {
      background: linear-gradient(180deg, #dc2626 0%, #b91c1c 100%);
      min-width: 100px;
    }
    .keyboard-key.backspace:hover {
      background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
    }
    .keyboard-key.enter {
      background: linear-gradient(180deg, #16a34a 0%, #15803d 100%);
      min-width: 80px;
    }
    .keyboard-key.enter:hover {
      background: linear-gradient(180deg, #22c55e 0%, #16a34a 100%);
    }
    .keyboard-key.clear {
      background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
      min-width: 100px;
    }
    .keyboard-key.clear:hover {
      background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%);
    }
    .keyboard-key.arrow {
      background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
      min-width: 60px;
    }
    .keyboard-key.arrow:hover {
      background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%);
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
    
    let activeInput = null;
    
    function showKeyboard() {
      const keyboard = document.getElementById('screen-keyboard');
      keyboard.classList.add('visible');
    }
    
    function hideKeyboard() {
      const keyboard = document.getElementById('screen-keyboard');
      keyboard.classList.remove('visible');
      activeInput = null;
    }
    
    function typeKey(key) {
      if (!activeInput) return;
      
      const start = activeInput.selectionStart || activeInput.value.length;
      const end = activeInput.selectionEnd || activeInput.value.length;
      const value = activeInput.value;
      
      // Wstaw znak w pozycji kursora
      const newValue = value.substring(0, start) + key + value.substring(end);
      activeInput.value = newValue;
      
      // Ustaw kursor zaraz po wstawionym znaku
      const newPos = start + key.length;
      activeInput.setSelectionRange(newPos, newPos);
      activeInput.focus();
    }
    
    function typeBackspace() {
      if (!activeInput) return;
      
      const start = activeInput.selectionStart;
      const end = activeInput.selectionEnd;
      const value = activeInput.value;
      
      if (start !== end) {
        // Usuń zaznaczony tekst
        activeInput.value = value.substring(0, start) + value.substring(end);
        activeInput.selectionStart = activeInput.selectionEnd = start;
      } else if (start > 0) {
        // Usuń jeden znak przed kursorem
        activeInput.value = value.substring(0, start - 1) + value.substring(start);
        activeInput.selectionStart = activeInput.selectionEnd = start - 1;
      }
      activeInput.focus();
    }
    
    function clearField() {
      if (!activeInput) return;
      activeInput.value = '';
      activeInput.focus();
    }
    
    function moveLeft() {
      if (!activeInput) return;
      const pos = activeInput.selectionStart;
      if (pos > 0) {
        activeInput.selectionStart = activeInput.selectionEnd = pos - 1;
      }
      activeInput.focus();
    }
    
    function moveRight() {
      if (!activeInput) return;
      const pos = activeInput.selectionStart;
      if (pos < activeInput.value.length) {
        activeInput.selectionStart = activeInput.selectionEnd = pos + 1;
      }
      activeInput.focus();
    }
    
    function clearField() {
      if (!activeInput) return;
      activeInput.value = '';
      activeInput.focus();
    }
    
    function moveLeft() {
      if (!activeInput) return;
      const pos = activeInput.selectionStart;
      if (pos > 0) {
        activeInput.selectionStart = activeInput.selectionEnd = pos - 1;
      }
      activeInput.focus();
    }
    
    function moveRight() {
      if (!activeInput) return;
      const pos = activeInput.selectionStart;
      if (pos < activeInput.value.length) {
        activeInput.selectionStart = activeInput.selectionEnd = pos + 1;
      }
      activeInput.focus();
    }
    
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
        <input type="text" id="price-input-\${orderId}" class="edit-input" value="\${currentPrice}" inputmode="decimal" pattern="[0-9]*\\.?[0-9]*">
      \`;
      
      // Edycja płatności
      const paymentSelect = document.createElement('select');
      paymentSelect.id = 'payment-select-' + orderId;
      paymentSelect.className = 'payment-select';
      paymentSelect.innerHTML = \`
        <option value="gotowka" \${currentPayment === 'gotowka' ? 'selected' : ''}>Gotówka</option>
        <option value="karta" \${currentPayment === 'karta' ? 'selected' : ''}>Karta</option>
        <option value="online" \${currentPayment === 'online' ? 'selected' : ''}>Online</option>
      \`;
      paymentCell.innerHTML = '';
      paymentCell.appendChild(paymentSelect);
      
      // Edycja kierowcy
      const kierowcaSelect = document.createElement('select');
      kierowcaSelect.id = 'kierowca-select-' + orderId;
      kierowcaSelect.className = 'payment-select';
      
      // Pobierz aktywne sesje dla dropdownu kierowców
      fetch('/api/sesje/aktywne')
        .then(res => res.json())
        .then(sesje => {
          // Jeśli więcej niż jedna sesja, dodaj opcję "Wybierz kierowcę"
          if (sesje.length > 1) {
            kierowcaSelect.innerHTML = '<option value="-1">Wybierz kierowcę</option>';
          } else {
            kierowcaSelect.innerHTML = '<option value="-1">-- Brak --</option>';
          }
          
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
      
      // Dodaj event listenery do pól input
      setTimeout(() => {
        const telefonInput = document.getElementById('telefon-input-' + orderId);
        const adresInput = document.getElementById('adres-input-' + orderId);
        const priceInput = document.getElementById('price-input-' + orderId);
        
        // Event listener dla telefonu
        telefonInput.addEventListener('focus', function() {
          activeInput = this;
          showKeyboard();
        });
        
        // Event listener dla adresu
        adresInput.addEventListener('focus', function() {
          activeInput = this;
          showKeyboard();
        });
        
        // Event listener dla ceny
        priceInput.addEventListener('focus', function() {
          activeInput = this;
          showKeyboard();
        });
        
        // Przesuń kursor na koniec przy każdym kliknięciu
        priceInput.addEventListener('click', function() {
          setTimeout(() => {
            const len = this.value.length;
            this.setSelectionRange(len, len);
          }, 10);
        });
        
        // Pokaż klawiaturę i ustaw focus na telefon
        telefonInput.focus();
        activeInput = telefonInput;
        showKeyboard();
      }, 100);
    }
    
    function saveOrder(orderId) {
      // Ukryj klawiaturę
      hideKeyboard();
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
        showToast('Nie zaznaczono żadnych zamówień do wydruku', 'warning');
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
          showToast('Pomyslnie wydrukowano ' + result.printed + ' paragonow', 'success');
          // Odznacz wszystkie checkboxy
          checkboxes.forEach(cb => cb.checked = false);
          document.getElementById('select-all-checkbox').checked = false;
          updatePrintButton();
        } else {
          showToast('Blad drukowania: ' + result.error, 'error');
        }
      } catch (error) {
        showToast('Blad polaczenia: ' + error.message, 'error');
      } finally {
        printBtn.disabled = false;
        updatePrintButton();
      }
    }

    // Toast notification function
    function showToast(message, type) {
      const toast = document.createElement('div');
      let bgColor = 'hsl(25 95% 53%)';
      if (type === 'error') bgColor = '#ef4444';
      if (type === 'warning') bgColor = '#404040';
      
      toast.style.position = 'fixed';
      toast.style.top = '50%';
      toast.style.left = '50%';
      toast.style.transform = 'translate(-50%, -50%)';
      toast.style.background = bgColor;
      toast.style.color = 'white';
      toast.style.padding = '24px 32px';
      toast.style.borderRadius = '12px';
      toast.style.fontSize = '16px';
      toast.style.fontWeight = '500';
      toast.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.3)';
      toast.style.zIndex = '10000';
      toast.style.maxWidth = '90%';
      toast.style.textAlign = 'center';
      toast.style.animation = 'slideIn 0.3s ease-out';
      
      toast.textContent = message;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    // Add animation styles if not already present
    if (!document.getElementById('toast-animations')) {
      const style = document.createElement('style');
      style.id = 'toast-animations';
      style.textContent = '@keyframes slideIn { from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } } @keyframes slideOut { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } }';
      document.head.appendChild(style);
    }
  </script>
</head>
<body>
  <div style="max-width: 1600px; margin: 0 auto;">
    <h1 style="color: #1f2937; font-size: 2.2em; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 20px;">Panel obsługi zamówień</h1>
    
    <div style="display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: nowrap;">
      <button class="apply-btn" onclick="window.location.href='http://localhost:3000'" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); box-shadow: 0 6px 20px rgba(249, 115, 22, 0.4); padding: 16px 28px; font-size: 15px;">
        Formularz zamówienia
      </button>
      <button class="apply-btn" onclick="window.location.href='/kuchnia'" style="background: linear-gradient(135deg, hsl(25 95% 53%) 0%, hsl(25 95% 45%) 100%); box-shadow: 0 6px 20px rgba(249, 115, 22, 0.4); padding: 16px 28px; font-size: 15px;">
        Panel Kuchni
      </button>
      <button class="apply-btn" onclick="window.location.href='/customer-dashboard'" style="background: linear-gradient(135deg, hsl(25 95% 53%) 0%, hsl(25 95% 45%) 100%); box-shadow: 0 6px 20px rgba(249, 115, 22, 0.4); padding: 16px 28px; font-size: 15px;">
        Statystyki Klientów
      </button>
      <button class="apply-btn" onclick="window.location.href='/sesja'" style="background: linear-gradient(135deg, hsl(25 95% 53%) 0%, hsl(25 95% 45%) 100%); box-shadow: 0 6px 20px rgba(249, 115, 22, 0.4); padding: 16px 28px; font-size: 15px;">
        Sesja
      </button>
      <button class="apply-btn" onclick="window.location.href='/rozliczenie'" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4); padding: 16px 28px; font-size: 15px;">
        Rozliczenie Pizzerii
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
    
    <div class="filter-group" style="grid-column: span 2;">
      <label>&nbsp;</label>
      <div style="display: flex; gap: 10px;">
        <button class="apply-btn" onclick="applyFilters()">Zastosuj filtry</button>
        <button class="apply-btn" onclick="resetFilters()" style="background: #404040; min-width: 120px;">Resetuj</button>
      </div>
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
      <th style="width: 100px;">Typ</th>
      <th style="width: 150px;">Telefon</th>
      <th style="width: 180px;">Adres</th>
      <th style="width: 220px;">Pizze</th>
      <th style="width: 160px;">Modyfikacje</th>
      <th style="width: 90px;">Sosy</th>
      <th style="width: 90px;">Napój</th>
      <th style="width: 110px;">Dodatki</th>
      <th style="width: 100px;">Cena</th>
      <th style="width: 90px;">Kupony</th>
      <th style="width: 120px;">Płatność</th>
      <th style="width: 110px;">Kierowca</th>
      <th style="width: 150px;">Data</th>
      <th style="width: 240px;">Akcje</th>
    </tr>
    ${orders.map((order, i) => `
    <tr id="row-${order.id}" style="vertical-align: top;">
      <td style="text-align: center;">
        <input type="checkbox" class="order-checkbox" value="${order.id}" onchange="updatePrintButton()">
      </td>
      <td>${formatTypZamowienia(order.typ_zamowienia)}</td>
      <td id="telefon-${order.id}" class="editable-cell">${order.telefon || '-'}</td>
      <td id="adres-${order.id}" class="editable-cell">${order.adres || '-'}</td>
      <td style="max-width: 220px; word-wrap: break-word; font-size: 11px;">${formatPizzaInfo(order.pizze || order.pizza)}</td>
      <td style="max-width: 160px; word-wrap: break-word; font-size: 10px;">${order.skladniki || '-'}</td>
      <td style="font-size: 11px; line-height: 1.3;">${formatSosyInfo(order.sosy)}</td>
      <td style="font-size: 11px;">${formatNapojInfo(order.napoj)}</td>
      <td style="font-size: 11px;">${formatDodatkiInfo(order.pozycje_extra || order.dodatki)}</td>
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
  
  <!-- Klawiatura ekranowa -->
  <div id="screen-keyboard">
    <div class="keyboard-header">
      <span class="keyboard-title">⌨ Klawiatura ekranowa</span>
      <button class="keyboard-close" onclick="hideKeyboard()">✕ Zamknij</button>
    </div>
    <div class="keyboard-row">
      <button class="keyboard-key" onclick="typeKey('1')">1</button>
      <button class="keyboard-key" onclick="typeKey('2')">2</button>
      <button class="keyboard-key" onclick="typeKey('3')">3</button>
      <button class="keyboard-key" onclick="typeKey('4')">4</button>
      <button class="keyboard-key" onclick="typeKey('5')">5</button>
      <button class="keyboard-key" onclick="typeKey('6')">6</button>
      <button class="keyboard-key" onclick="typeKey('7')">7</button>
      <button class="keyboard-key" onclick="typeKey('8')">8</button>
      <button class="keyboard-key" onclick="typeKey('9')">9</button>
      <button class="keyboard-key" onclick="typeKey('0')">0</button>
    </div>
    <div class="keyboard-row">
      <button class="keyboard-key" onclick="typeKey('q')">q</button>
      <button class="keyboard-key" onclick="typeKey('w')">w</button>
      <button class="keyboard-key" onclick="typeKey('e')">e</button>
      <button class="keyboard-key" onclick="typeKey('r')">r</button>
      <button class="keyboard-key" onclick="typeKey('t')">t</button>
      <button class="keyboard-key" onclick="typeKey('y')">y</button>
      <button class="keyboard-key" onclick="typeKey('u')">u</button>
      <button class="keyboard-key" onclick="typeKey('i')">i</button>
      <button class="keyboard-key" onclick="typeKey('o')">o</button>
      <button class="keyboard-key" onclick="typeKey('p')">p</button>
    </div>
    <div class="keyboard-row">
      <button class="keyboard-key" onclick="typeKey('a')">a</button>
      <button class="keyboard-key" onclick="typeKey('s')">s</button>
      <button class="keyboard-key" onclick="typeKey('d')">d</button>
      <button class="keyboard-key" onclick="typeKey('f')">f</button>
      <button class="keyboard-key" onclick="typeKey('g')">g</button>
      <button class="keyboard-key" onclick="typeKey('h')">h</button>
      <button class="keyboard-key" onclick="typeKey('j')">j</button>
      <button class="keyboard-key" onclick="typeKey('k')">k</button>
      <button class="keyboard-key" onclick="typeKey('l')">l</button>
    </div>
    <div class="keyboard-row">
      <button class="keyboard-key" onclick="typeKey('z')">z</button>
      <button class="keyboard-key" onclick="typeKey('x')">x</button>
      <button class="keyboard-key" onclick="typeKey('c')">c</button>
      <button class="keyboard-key" onclick="typeKey('v')">v</button>
      <button class="keyboard-key" onclick="typeKey('b')">b</button>
      <button class="keyboard-key" onclick="typeKey('n')">n</button>
      <button class="keyboard-key" onclick="typeKey('m')">m</button>
      <button class="keyboard-key" onclick="typeKey('.')">.</button>
      <button class="keyboard-key" onclick="typeKey(',')">,</button>
      <button class="keyboard-key" onclick="typeKey('/')">/</button>
    </div>
    <div class="keyboard-row">
      <button class="keyboard-key arrow" onclick="moveLeft()">←</button>
      <button class="keyboard-key arrow" onclick="moveRight()">→</button>
      <button class="keyboard-key space" onclick="typeKey(' ')">Spacja</button>
      <button class="keyboard-key clear" onclick="clearField()">🗑 Wyczyść</button>
      <button class="keyboard-key backspace" onclick="typeBackspace()">⌫ Usuń</button>
    </div>
  </div>
  
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