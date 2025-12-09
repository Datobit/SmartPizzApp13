const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  if (req.url === '/debug' || req.url === '/debug.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const html = fs.readFileSync(path.join(__dirname, 'debug-api.html'), 'utf8');
    res.end(html);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <h1>🍕 Pizza Debug Server</h1>
      <p><a href="/debug">🧪 Debug API Tests</a></p>
      <p><a href="http://localhost:3002" target="_blank">📱 Main App</a></p>
      <p><a href="http://localhost:3001" target="_blank">📋 Orders Viewer</a></p>
    `);
  }
});

server.listen(8080, () => {
  console.log('🧪 Debug server running at http://localhost:8080');
});