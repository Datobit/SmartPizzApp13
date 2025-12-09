const Database = require('better-sqlite3');
const path = require('path');
const http = require('http');

const dbPath = path.join(__dirname, 'prisma', 'smartpizzapp13-T3.db');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });

  try {
    const db = new Database(dbPath);
    
    // Pobierz wszystkie zamówienia
    const allOrders = db.prepare(`
      SELECT * FROM zamowienia 
      ORDER BY created_at DESC
    `).all();

    // Pobierz pizze z menu do mapowania nazw
    const pizzas = db.prepare('SELECT * FROM menu_pizza').all();
    
    // Funkcje pomocnicze do filtrowania danych
    const getOrdersInRange = (days) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      return allOrders.filter(order => {
        if (!order.created_at) return false;
        const orderDate = new Date(order.created_at);
        return orderDate >= cutoffDate;
      });
    };

    // KPI - dzisiejsza sprzedaż
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = allOrders.filter(order => {
      if (!order.created_at) return false;
      const orderDate = String(order.created_at);
      return orderDate.startsWith(today);
    });
    const todayRevenue = todayOrders.reduce((sum, order) => 
      sum + (parseFloat(order.cena_calkowita) || 0), 0
    );

    // Średnie z ostatnich okresów
    const calculateAverage = (days) => {
      const orders = getOrdersInRange(days);
      const total = orders.reduce((sum, order) => 
        sum + (parseFloat(order.cena_calkowita) || 0), 0
      );
      return days > 0 ? total / days : 0;
    };

    const avg7days = calculateAverage(7);
    const avg30days = calculateAverage(30);
    const avg90days = calculateAverage(90);
    const avg365days = calculateAverage(365);

    // KPI dla typów zamówień
    const calculateRevenueByType = (type, days) => {
      const orders = days === 1 ? todayOrders : getOrdersInRange(days);
      const filteredOrders = orders.filter(order => order.typ_zamowienia === type);
      const total = filteredOrders.reduce((sum, order) => 
        sum + (parseFloat(order.cena_calkowita) || 0), 0
      );
      return days > 1 ? total / days : total;
    };

    // Na miejscu
    const naMiejscuToday = calculateRevenueByType('na_miejscu', 1);
    const naMiejscu7avg = calculateRevenueByType('na_miejscu', 7);
    const naMiejscu30avg = calculateRevenueByType('na_miejscu', 30);
    const naMiejscu90avg = calculateRevenueByType('na_miejscu', 90);
    const naMiejscu365avg = calculateRevenueByType('na_miejscu', 365);

    // Na wynos
    const naWynosToday = calculateRevenueByType('na_wynos', 1);
    const naWynos7avg = calculateRevenueByType('na_wynos', 7);
    const naWynos30avg = calculateRevenueByType('na_wynos', 30);
    const naWynos90avg = calculateRevenueByType('na_wynos', 90);
    const naWynos365avg = calculateRevenueByType('na_wynos', 365);

    // Dowóz
    const dowozToday = calculateRevenueByType('dowoz', 1);
    const dowoz7avg = calculateRevenueByType('dowoz', 7);
    const dowoz30avg = calculateRevenueByType('dowoz', 30);
    const dowoz90avg = calculateRevenueByType('dowoz', 90);
    const dowoz365avg = calculateRevenueByType('dowoz', 365);

    // Histogram godzin (11-23) - domyślnie wszystkie zamówienia
    const getHourlyData = (days) => {
      const orders = days > 0 ? getOrdersInRange(days) : allOrders;
      const hourlyData = {};
      for (let h = 11; h <= 23; h++) {
        hourlyData[h] = 0;
      }
      
      orders.forEach(order => {
        if (!order.created_at) return;
        const date = new Date(order.created_at);
        const hour = date.getHours();
        if (hour >= 11 && hour <= 23) {
          hourlyData[hour]++;
        }
      });
      
      return hourlyData;
    };

    const hourlyData = getHourlyData(0); // 0 = wszystkie

    // Wykres kołowy - top pizze (domyślnie ostatnie 30 dni)
    const getPizzaStats = (days) => {
      const orders = days > 0 ? getOrdersInRange(days) : allOrders;
      const pizzaCount = {};
      
      orders.forEach(order => {
        if (!order.pizze) return;
        try {
          const pizzeArray = JSON.parse(order.pizze);
          pizzeArray.forEach(pizza => {
            const pizzaData = pizzas.find(p => p.id === pizza.id);
            const nazwa = pizzaData ? pizzaData.nazwa : `Pizza ID:${pizza.id}`;
            pizzaCount[nazwa] = (pizzaCount[nazwa] || 0) + 1;
          });
        } catch (e) {
          // Ignoruj błędy parsowania
        }
      });
      
      return pizzaCount;
    };

    const pizzaStats30days = getPizzaStats(30);

    db.close();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Dashboard - Pizza Analytics</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 30px;
      font-size: 2.5em;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    .kpi-section {
      background: white;
      border-radius: 15px;
      padding: 25px;
      margin-bottom: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    .kpi-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .kpi-header h2 {
      margin: 0;
      color: #333;
    }
    .range-selector {
      padding: 8px 15px;
      border: 2px solid #667eea;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      background: white;
      color: #667eea;
      font-weight: bold;
    }
    .range-selector:hover {
      background: #667eea;
      color: white;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }
    .kpi-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      border-radius: 12px;
      color: white;
      text-align: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    .kpi-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 10px;
    }
    .kpi-value {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .kpi-comparison {
      font-size: 14px;
      opacity: 0.9;
    }
    .kpi-positive {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    }
    .kpi-negative {
      background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
    }
    .chart-section {
      background: white;
      border-radius: 15px;
      padding: 25px;
      margin-bottom: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .chart-header h2 {
      margin: 0;
      color: #333;
    }
    .chart-container {
      position: relative;
      height: 400px;
      margin-top: 20px;
    }
    .refresh-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 25px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      transition: transform 0.2s;
    }
    .refresh-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🍕 Dashboard Analytics</h1>
    
    <!-- KPI Section -->
    <div class="kpi-section">
      <div class="kpi-header">
        <h2>📊 Wyniki Sprzedaży</h2>
        <select id="kpiRange" class="range-selector" onchange="updateKPI()">
          <option value="7">Ostatnie 7 dni</option>
          <option value="30" selected>Ostatnie 30 dni</option>
          <option value="90">Ostatnie 90 dni</option>
          <option value="365">Ostatnie 365 dni</option>
        </select>
      </div>
      <div class="kpi-grid" id="kpiGrid">
        <!-- KPI cards will be inserted here -->
      </div>
    </div>

    <!-- KPI Na Miejscu -->
    <div class="kpi-section">
      <div class="kpi-header">
        <h2>🏪 Sprzedaż NA MIEJSCU</h2>
        <select id="naMiejscuRange" class="range-selector" onchange="updateNaMiejscuKPI()">
          <option value="7">Ostatnie 7 dni</option>
          <option value="30" selected>Ostatnie 30 dni</option>
          <option value="90">Ostatnie 90 dni</option>
          <option value="365">Ostatnie 365 dni</option>
        </select>
      </div>
      <div class="kpi-grid" id="naMiejscuGrid">
        <!-- KPI cards will be inserted here -->
      </div>
    </div>

    <!-- KPI Na Wynos -->
    <div class="kpi-section">
      <div class="kpi-header">
        <h2>📦 Sprzedaż NA WYNOS</h2>
        <select id="naWynosRange" class="range-selector" onchange="updateNaWynosKPI()">
          <option value="7">Ostatnie 7 dni</option>
          <option value="30" selected>Ostatnie 30 dni</option>
          <option value="90">Ostatnie 90 dni</option>
          <option value="365">Ostatnie 365 dni</option>
        </select>
      </div>
      <div class="kpi-grid" id="naWynosGrid">
        <!-- KPI cards will be inserted here -->
      </div>
    </div>

    <!-- KPI Dowóz -->
    <div class="kpi-section">
      <div class="kpi-header">
        <h2>🚗 Sprzedaż DOWÓZ</h2>
        <select id="dowozRange" class="range-selector" onchange="updateDowozKPI()">
          <option value="7">Ostatnie 7 dni</option>
          <option value="30" selected>Ostatnie 30 dni</option>
          <option value="90">Ostatnie 90 dni</option>
          <option value="365">Ostatnie 365 dni</option>
        </select>
      </div>
      <div class="kpi-grid" id="dowozGrid">
        <!-- KPI cards will be inserted here -->
      </div>
    </div>

    <!-- Histogram Section -->
    <div class="chart-section">
      <div class="chart-header">
        <h2>⏰ Rozkład Zamówień w Ciągu Dnia</h2>
        <select id="hourlyRange" class="range-selector" onchange="updateHourlyChart()">
          <option value="1">Dzisiaj</option>
          <option value="7">Ostatnie 7 dni</option>
          <option value="30">Ostatnie 30 dni</option>
          <option value="90">Ostatnie 90 dni</option>
          <option value="365">Ostatnie 365 dni</option>
          <option value="0" selected>Wszystkie dane</option>
        </select>
      </div>
      <div class="chart-container">
        <canvas id="hourlyChart"></canvas>
      </div>
    </div>

    <!-- Pizza Pie Chart Section -->
    <div class="chart-section">
      <div class="chart-header">
        <h2>🍕 Najpopularniejsze Pizze</h2>
        <select id="pizzaRange" class="range-selector" onchange="updatePizzaChart()">
          <option value="1">Dzisiaj</option>
          <option value="7">Ostatnie 7 dni</option>
          <option value="30" selected>Ostatnie 30 dni</option>
          <option value="90">Ostatnie 90 dni</option>
          <option value="365">Ostatnie 365 dni</option>
        </select>
      </div>
      <div class="chart-container">
        <canvas id="pizzaChart"></canvas>
      </div>
    </div>
  </div>

  <script>
    // Data from server
    const data = {
      today: ${todayRevenue.toFixed(2)},
      avg7: ${avg7days.toFixed(2)},
      avg30: ${avg30days.toFixed(2)},
      avg90: ${avg90days.toFixed(2)},
      avg365: ${avg365days.toFixed(2)},
      hourly: ${JSON.stringify(hourlyData)},
      allOrders: ${JSON.stringify(allOrders.map(o => ({
        created_at: o.created_at,
        pizze: o.pizze,
        cena_calkowita: o.cena_calkowita,
        typ_zamowienia: o.typ_zamowienia
      })))},
      pizzas: ${JSON.stringify(pizzas)},
      naMiejscu: {
        today: ${naMiejscuToday.toFixed(2)},
        avg7: ${naMiejscu7avg.toFixed(2)},
        avg30: ${naMiejscu30avg.toFixed(2)},
        avg90: ${naMiejscu90avg.toFixed(2)},
        avg365: ${naMiejscu365avg.toFixed(2)}
      },
      naWynos: {
        today: ${naWynosToday.toFixed(2)},
        avg7: ${naWynos7avg.toFixed(2)},
        avg30: ${naWynos30avg.toFixed(2)},
        avg90: ${naWynos90avg.toFixed(2)},
        avg365: ${naWynos365avg.toFixed(2)}
      },
      dowoz: {
        today: ${dowozToday.toFixed(2)},
        avg7: ${dowoz7avg.toFixed(2)},
        avg30: ${dowoz30avg.toFixed(2)},
        avg90: ${dowoz90avg.toFixed(2)},
        avg365: ${dowoz365avg.toFixed(2)}
      }
    };

    // Update KPI cards
    function updateKPI() {
      const range = document.getElementById('kpiRange').value;
      let avgRevenue;
      switch(range) {
        case '7': avgRevenue = data.avg7; break;
        case '30': avgRevenue = data.avg30; break;
        case '90': avgRevenue = data.avg90; break;
        case '365': avgRevenue = data.avg365; break;
      }
      
      const difference = data.today - avgRevenue;
      const percentChange = avgRevenue > 0 ? ((difference / avgRevenue) * 100) : 0;
      const isPositive = difference >= 0;
      
      const kpiHTML = \`
        <div class="kpi-card">
          <div class="kpi-label">Dzisiaj</div>
          <div class="kpi-value">\${data.today.toFixed(2)} PLN</div>
          <div class="kpi-comparison">\${data.today > 0 ? '🟢 Aktywny' : '⚪ Brak zamówień'}</div>
        </div>
        <div class="kpi-card \${isPositive ? 'kpi-positive' : 'kpi-negative'}">
          <div class="kpi-label">Porównanie do średniej (\${range} dni)</div>
          <div class="kpi-value">\${isPositive ? '+' : ''}\${difference.toFixed(2)} PLN</div>
          <div class="kpi-comparison">\${isPositive ? '📈' : '📉'} \${percentChange.toFixed(1)}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Średnia dzienna (\${range} dni)</div>
          <div class="kpi-value">\${avgRevenue.toFixed(2)} PLN</div>
          <div class="kpi-comparison">Okres: \${range} dni</div>
        </div>
      \`;
      document.getElementById('kpiGrid').innerHTML = kpiHTML;
    }

    // Initialize KPI
    updateKPI();

    // Update KPI for order types
    function updateNaMiejscuKPI() {
      const range = document.getElementById('naMiejscuRange').value;
      let avgRevenue;
      switch(range) {
        case '7': avgRevenue = data.naMiejscu.avg7; break;
        case '30': avgRevenue = data.naMiejscu.avg30; break;
        case '90': avgRevenue = data.naMiejscu.avg90; break;
        case '365': avgRevenue = data.naMiejscu.avg365; break;
      }
      
      const difference = data.naMiejscu.today - avgRevenue;
      const percentChange = avgRevenue > 0 ? ((difference / avgRevenue) * 100) : 0;
      const isPositive = difference >= 0;
      
      const kpiHTML = \`
        <div class="kpi-card">
          <div class="kpi-label">Dzisiaj (NA MIEJSCU)</div>
          <div class="kpi-value">\${data.naMiejscu.today.toFixed(2)} PLN</div>
          <div class="kpi-comparison">🏪 Zamówienia lokalne</div>
        </div>
        <div class="kpi-card \${isPositive ? 'kpi-positive' : 'kpi-negative'}">
          <div class="kpi-label">Porównanie do średniej (\${range} dni)</div>
          <div class="kpi-value">\${isPositive ? '+' : ''}\${difference.toFixed(2)} PLN</div>
          <div class="kpi-comparison">\${isPositive ? '📈' : '📉'} \${percentChange.toFixed(1)}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Średnia dzienna (\${range} dni)</div>
          <div class="kpi-value">\${avgRevenue.toFixed(2)} PLN</div>
          <div class="kpi-comparison">Okres: \${range} dni</div>
        </div>
      \`;
      document.getElementById('naMiejscuGrid').innerHTML = kpiHTML;
    }

    function updateNaWynosKPI() {
      const range = document.getElementById('naWynosRange').value;
      let avgRevenue;
      switch(range) {
        case '7': avgRevenue = data.naWynos.avg7; break;
        case '30': avgRevenue = data.naWynos.avg30; break;
        case '90': avgRevenue = data.naWynos.avg90; break;
        case '365': avgRevenue = data.naWynos.avg365; break;
      }
      
      const difference = data.naWynos.today - avgRevenue;
      const percentChange = avgRevenue > 0 ? ((difference / avgRevenue) * 100) : 0;
      const isPositive = difference >= 0;
      
      const kpiHTML = \`
        <div class="kpi-card">
          <div class="kpi-label">Dzisiaj (NA WYNOS)</div>
          <div class="kpi-value">\${data.naWynos.today.toFixed(2)} PLN</div>
          <div class="kpi-comparison">📦 Odbiór osobisty</div>
        </div>
        <div class="kpi-card \${isPositive ? 'kpi-positive' : 'kpi-negative'}">
          <div class="kpi-label">Porównanie do średniej (\${range} dni)</div>
          <div class="kpi-value">\${isPositive ? '+' : ''}\${difference.toFixed(2)} PLN</div>
          <div class="kpi-comparison">\${isPositive ? '📈' : '📉'} \${percentChange.toFixed(1)}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Średnia dzienna (\${range} dni)</div>
          <div class="kpi-value">\${avgRevenue.toFixed(2)} PLN</div>
          <div class="kpi-comparison">Okres: \${range} dni</div>
        </div>
      \`;
      document.getElementById('naWynosGrid').innerHTML = kpiHTML;
    }

    function updateDowozKPI() {
      const range = document.getElementById('dowozRange').value;
      let avgRevenue;
      switch(range) {
        case '7': avgRevenue = data.dowoz.avg7; break;
        case '30': avgRevenue = data.dowoz.avg30; break;
        case '90': avgRevenue = data.dowoz.avg90; break;
        case '365': avgRevenue = data.dowoz.avg365; break;
      }
      
      const difference = data.dowoz.today - avgRevenue;
      const percentChange = avgRevenue > 0 ? ((difference / avgRevenue) * 100) : 0;
      const isPositive = difference >= 0;
      
      const kpiHTML = \`
        <div class="kpi-card">
          <div class="kpi-label">Dzisiaj (DOWÓZ)</div>
          <div class="kpi-value">\${data.dowoz.today.toFixed(2)} PLN</div>
          <div class="kpi-comparison">🚗 Dostawa do klienta</div>
        </div>
        <div class="kpi-card \${isPositive ? 'kpi-positive' : 'kpi-negative'}">
          <div class="kpi-label">Porównanie do średniej (\${range} dni)</div>
          <div class="kpi-value">\${isPositive ? '+' : ''}\${difference.toFixed(2)} PLN</div>
          <div class="kpi-comparison">\${isPositive ? '📈' : '📉'} \${percentChange.toFixed(1)}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Średnia dzienna (\${range} dni)</div>
          <div class="kpi-value">\${avgRevenue.toFixed(2)} PLN</div>
          <div class="kpi-comparison">Okres: \${range} dni</div>
        </div>
      \`;
      document.getElementById('dowozGrid').innerHTML = kpiHTML;
    }

    // Initialize type-specific KPIs
    updateNaMiejscuKPI();
    updateNaWynosKPI();
    updateDowozKPI();

    // Hourly Chart with date range selector
    let hourlyChart;

    function updateHourlyChart() {
      const days = parseInt(document.getElementById('hourlyRange').value);
      
      // Filter orders by date range
      let filteredOrders;
      if (days === 0) {
        filteredOrders = data.allOrders;
      } else {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        filteredOrders = data.allOrders.filter(order => {
          if (!order.created_at) return false;
          const orderDate = new Date(order.created_at);
          return orderDate >= cutoffDate;
        });
      }
      
      // Calculate hourly distribution
      const hourlyData = {};
      for (let h = 11; h <= 23; h++) {
        hourlyData[h] = 0;
      }
      
      filteredOrders.forEach(order => {
        if (!order.created_at) return;
        const date = new Date(order.created_at);
        const hour = date.getHours();
        if (hour >= 11 && hour <= 23) {
          hourlyData[hour]++;
        }
      });
      
      const hourlyLabels = Object.keys(hourlyData);
      const hourlyValues = Object.values(hourlyData);
      
      if (hourlyChart) {
        hourlyChart.destroy();
      }
      
      const hourlyCtx = document.getElementById('hourlyChart').getContext('2d');
      hourlyChart = new Chart(hourlyCtx, {
        type: 'bar',
        data: {
          labels: hourlyLabels.map(h => h + ':00'),
          datasets: [{
            label: 'Liczba zamówień',
            data: hourlyValues,
            backgroundColor: 'rgba(102, 126, 234, 0.8)',
            borderColor: 'rgba(102, 126, 234, 1)',
            borderWidth: 2,
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top'
            },
            title: {
              display: true,
              text: \`Rozkład zamówień według godzin (11:00 - 23:00)\${days > 0 ? ' - ostatnie ' + days + ' dni' : ' - wszystkie dane'}\`
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1
              },
              title: {
                display: true,
                text: 'Liczba zamówień'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Godzina'
              }
            }
          }
        }
      });
    }

    // Initialize hourly chart
    updateHourlyChart();

    // Pizza Chart
    let pizzaChart;
    
    function updatePizzaChart() {
      const days = parseInt(document.getElementById('pizzaRange').value);
      
      // Filter orders by date range
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const filteredOrders = data.allOrders.filter(order => {
        if (!order.created_at) return false;
        const orderDate = new Date(order.created_at);
        return orderDate >= cutoffDate;
      });
      
      // Count pizzas
      const pizzaCount = {};
      filteredOrders.forEach(order => {
        if (!order.pizze) return;
        try {
          const pizzeArray = JSON.parse(order.pizze);
          pizzeArray.forEach(pizza => {
            const pizzaData = data.pizzas.find(p => p.id === pizza.id);
            const nazwa = pizzaData ? pizzaData.nazwa : \`Pizza ID:\${pizza.id}\`;
            pizzaCount[nazwa] = (pizzaCount[nazwa] || 0) + 1;
          });
        } catch (e) {
          // Ignore parsing errors
        }
      });
      
      // Sort and take top 10
      const sortedPizzas = Object.entries(pizzaCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      const labels = sortedPizzas.map(([name]) => name);
      const values = sortedPizzas.map(([, count]) => count);
      
      // Generate colors
      const colors = [
        'rgba(255, 99, 132, 0.8)',
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)',
        'rgba(199, 199, 199, 0.8)',
        'rgba(83, 102, 255, 0.8)',
        'rgba(255, 99, 255, 0.8)',
        'rgba(99, 255, 132, 0.8)'
      ];
      
      if (pizzaChart) {
        pizzaChart.destroy();
      }
      
      const pizzaCtx = document.getElementById('pizzaChart').getContext('2d');
      pizzaChart = new Chart(pizzaCtx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderColor: 'white',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                padding: 15,
                font: {
                  size: 12
                }
              }
            },
            title: {
              display: true,
              text: \`Top 10 pizz (ostatnie \${days === 1 ? 'dzisiaj' : days + ' dni'})\`,
              font: {
                size: 16
              }
            }
          }
        }
      });
    }
    
    // Initialize pizza chart
    updatePizzaChart();
  </script>
</body>
</html>`;

    res.end(html);
  } catch (error) {
    res.end(`<h1>Błąd</h1><p>${error.message}</p><pre>${error.stack}</pre>`);
  }
});

const PORT = 3007;
server.listen(PORT, () => {
  console.log(`📊 Dashboard działa na http://localhost:${PORT}`);
});
