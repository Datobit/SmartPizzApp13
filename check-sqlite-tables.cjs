const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('prisma/smartpizzapp13-T3.db');

db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Tabele w bazie SQLite:');
    rows.forEach(row => console.log(' -', row.name));
  }
  db.close();
});
