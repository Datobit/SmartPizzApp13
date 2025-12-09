const Database = require('better-sqlite3');
const path = require('path');
const http = require('http');

const dbPath = path.join(__dirname, 'smartpizzapp13-T3.db');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });

  try {
    // Sprawdź która baza istnieje i ma zamówienia
    let db, orders, pizzas, napoje;
    
    try {
      // Pierwsza próba: baza Prisma z nową strukturą
      db = new Database(path.join(__dirname, 'prisma', 'smartpizzapp13-T3.db'));
      orders = db.prepare(`
        SELECT * FROM zamowienia 
        ORDER BY id DESC 
        LIMIT 50
      `).all();
      
      // Pobierz również dane pizz i napojów do wyświetlania nazw
      pizzas = db.prepare('SELECT * FROM menu_pizza').all();
      napoje = db.prepare('SELECT * FROM napoje').all();
    } catch {
      // Druga próba: główna baza ze starą strukturą
      db = new Database(dbPath)
          ]      orders = db.prepare(`
        SELECT * FROM [Zamówienia] 
        ORDER BY rowid DESC 
        LIMIT 50
      `).all();
      
      // Pobierz również dane pizz i napojów do wyświetlania nazw - w głównej bazie
      try {
        pizzas = db.prepare('SELECT * FROM menu_pizza').all();
        napoje = db.prepare('SELECT * FROM napoje').all();
      } catch (e) {
        // Fallback - może mieć inne nazwy tabel
        console.log("Nie można pobrać danych pizz/napojów:", e.message);
        pizzas = [];
        napoje = [];
      }
    }
    
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
  </style>
</head>
<body>
  <h1>🍕 Zamówienia Pizza App</h1>
  <button class="refresh-btn" onclick="location.reload()">🔄 Odśwież</button>
  
  <p><strong>Liczba zamówień:</strong> ${orders.length}</p>
  
  <table>
    <tr>
      <th style="width: 30px;">#</th>
      <th style="width: 50px;">ID</th>
      <th style="width: 100px;">Typ</th>
      <th style="width: 100px;">Telefon</th>
      <th style="width: 150px;">Adres</th>
      <th style="width: 60px;">Kupony</th>
      <th style="width: 250px;">Pizze (szczegóły)</th>
      <th style="width: 100px;">Sosy</th>
      <th style="width: 120px;">Napój</th>
      <th style="width: 120px;">Dodatki</th>
      <th style="width: 80px;">Cena</th>
      <th style="width: 80px;">Płatność</th>
      <th style="width: 140px;">Data</th>
    </tr>
    ${orders.map((order, i) => `
    <tr style="vertical-align: top;">
      <td>${i + 1}</td>
      <td>${order.id || order.rowid || '-'}</td>
      <td>${formatTypZamowienia(order.typ_zamowienia)}</td>
      <td>${order.telefon || '-'}</td>
      <td>${order.adres || '-'}</td>
      <td>${(typeof order.is_kupony !== 'undefined' && order.is_kupony === 1) ? 'KUPONY' : '-'}</td>
      <td style="max-width: 250px; word-wrap: break-word;">${formatPizzaInfo(order.pizze || order.pizza)}</td>
      <td>${order.sosy || '-'}</td>
      <td>${formatNapojInfo(order.napoj)}</td>
      <td>${order.pozycje_extra || order.dodatki || '-'}</td>
      <td>${order.cena_calkowita || order.cena || '-'} PLN</td>
      <td>${order.platnosc || '-'}</td>
      <td>${formatPolishTime(order.created_at || order.godzina_otrzymania)}</td>
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
    db.close();
  } catch (error) {
    res.end(`<h1>Błąd</h1><p>${error.message}</p>`);
  }
});

const PORT = 3006;
server.listen(PORT, () => {
  console.log(`🍕 Serwer zamówień działa na http://localhost:${PORT}`);
});