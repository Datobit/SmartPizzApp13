const mysql = require('mysql2/promise');
const path = require('path');
const http = require('http');
const url = require('url');
const querystring = require('querystring');
require('dotenv').config();

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;
  
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
        
        connection = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: 'Pepperoni13',
          database: 'SmartPizzApp13'
        });
        
        await connection.execute(
          'UPDATE zamowienia SET platnosc = ? WHERE id = ?',
          [platnosc, orderId]
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
    let query = 'SELECT * FROM zamowienia WHERE 1=1';
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
    }
    .edit-btn:hover {
      background: #218838;
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
    }
  </style>
  <script>
    function editOrder(orderId, currentPayment) {
      const row = document.getElementById('row-' + orderId);
      const cell = document.getElementById('payment-' + orderId);
      
      const select = document.createElement('select');
      select.className = 'payment-select';
      select.innerHTML = \`
        <option value="gotowka" \${currentPayment === 'gotowka' ? 'selected' : ''}>Gotówka</option>
        <option value="karta" \${currentPayment === 'karta' ? 'selected' : ''}>Karta</option>
      \`;
      
      const saveBtn = document.createElement('button');
      saveBtn.textContent = '💾 Zapisz';
      saveBtn.className = 'save-btn';
      saveBtn.onclick = () => saveOrder(orderId, select.value);
      
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '✖ Anuluj';
      cancelBtn.className = 'cancel-btn';
      cancelBtn.onclick = () => location.reload();
      
      cell.innerHTML = '';
      cell.appendChild(select);
      cell.appendChild(document.createElement('br'));
      cell.appendChild(saveBtn);
      cell.appendChild(cancelBtn);
    }
    
    function saveOrder(orderId, payment) {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/update-order';
      
      const idInput = document.createElement('input');
      idInput.type = 'hidden';
      idInput.name = 'id';
      idInput.value = orderId;
      
      const paymentInput = document.createElement('input');
      paymentInput.type = 'hidden';
      paymentInput.name = 'platnosc';
      paymentInput.value = payment;
      
      form.appendChild(idInput);
      form.appendChild(paymentInput);
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
      <th style="width: 30px;">#</th>
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
      <th style="width: 140px;">Data</th>
      <th style="width: 80px;">Akcje</th>
    </tr>
    ${orders.map((order, i) => `
    <tr id="row-${order.id}" style="vertical-align: top;">
      <td>${i + 1}</td>
      <td>${order.id || order.rowid || '-'}</td>
      <td>${formatTypZamowienia(order.typ_zamowienia)}</td>
      <td>${order.telefon || '-'}</td>
      <td>${order.adres || '-'}</td>
      <td>${(typeof order.is_kupony !== 'undefined' && order.is_kupony === 1) ? 'KUPONY' : '-'}</td>
      <td style="max-width: 250px; word-wrap: break-word;">${formatPizzaInfo(order.pizze || order.pizza)}</td>
      <td style="max-width: 200px; word-wrap: break-word; font-size: 12px;">${order.skladniki || '-'}</td>
      <td>${order.sosy || '-'}</td>
      <td>${formatNapojInfo(order.napoj)}</td>
      <td>${order.pozycje_extra || order.dodatki || '-'}</td>
      <td>${order.cena_calkowita || order.cena || '-'} PLN</td>
      <td id="payment-${order.id}" class="editable-cell">
        ${order.platnosc || '-'}
      </td>
      <td>${formatPolishTime(order.created_at || order.godzina_otrzymania)}</td>
      <td>
        <button class="edit-btn" onclick="editOrder(${order.id}, '${order.platnosc || ''}')">✏️ Edytuj</button>
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