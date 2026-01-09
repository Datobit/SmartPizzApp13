const { SerialPort } = require('serialport');
require('dotenv').config();

// Funkcja testująca pojedynczy port
async function testSinglePort(portPath) {
  return new Promise((resolve) => {
    console.log(`\n[SZUKAM] Testuję: ${portPath}`);
    
    const port = new SerialPort({
      path: portPath,
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false
    });
    
    port.open((err) => {
      if (err) {
        console.log(`   [BLAD] Błąd: ${err.message}`);
        resolve({ port: portPath, success: false, error: err.message });
      } else {
        console.log(`   [OK] Port otwarty pomyślnie!`);
        port.close();
        resolve({ port: portPath, success: true });
      }
    });
    
    // Timeout po 3 sekundach
    setTimeout(() => {
      if (port.isOpen) {
        port.close();
      }
      resolve({ port: portPath, success: false, error: 'Timeout' });
    }, 3000);
  });
}

async function findWorkingPorts() {
  console.log('');
  console.log('   SZUKANIE DZIAŁAJĄCYCH PORTÓW         ');
  console.log('\n');
  
  try {
    const ports = await SerialPort.list();
    
    console.log(`Znaleziono ${ports.length} portów szeregowych\n`);
    
    // Porty z Vendor ID (prawdopodobnie prawdziwe urządzenia)
    const portsWithVendor = ports.filter(p => p.vendorId);
    
    // Standardowe porty COM
    const comPorts = ['/dev/ttyS0', '/dev/ttyS1', '/dev/ttyS2', '/dev/ttyS3'];
    
    // Najpierw testuj porty z Vendor ID
    if (portsWithVendor.length > 0) {
      console.log('[INFO] Porty z Vendor ID (prawdopodobne urządzenia sprzętowe):');
      for (const port of portsWithVendor) {
        console.log(`   ${port.path} - Vendor: ${port.vendorId}, Product: ${port.productId}`);
      }
      console.log('\n[TEST] Testuję porty z Vendor ID...');
      
      for (const port of portsWithVendor) {
        const result = await testSinglePort(port.path);
        if (result.success) {
          console.log(`\n[SUKCES] ZNALEZIONO DZIAŁAJĄCY PORT: ${port.path}`);
          console.log(`\n[WSKAZOWKA] Ustaw w pliku .env:`);
          console.log(`   PRINTER_PORT="${port.path}"`);
          return port.path;
        }
      }
    }
    
    // Jeśli nie znaleziono, testuj standardowe porty COM
    console.log('\n[TEST] Testuję standardowe porty COM...');
    for (const portPath of comPorts) {
      if (ports.find(p => p.path === portPath)) {
        const result = await testSinglePort(portPath);
        if (result.success) {
          console.log(`\n[SUKCES] ZNALEZIONO DZIAŁAJĄCY PORT: ${portPath}`);
          console.log(`\n[WSKAZOWKA] Ustaw w pliku .env:`);
          console.log(`   PRINTER_PORT="${portPath}"`);
          return portPath;
        }
      }
    }
    
    console.log('\n[BLAD] Nie znaleziono żadnego działającego portu');
    console.log('\n[WSKAZOWKA] Możliwe przyczyny:');
    console.log('   1. Drukarka nie jest podłączona');
    console.log('   2. Drukarka nie jest włączona');
    console.log('   3. Drukarka używa innego portu (sprawdź dokumentację)');
    console.log('   4. Problem z kablem lub połączeniem');
    console.log('\n[LISTA] Wszystkie wykryte porty:');
    ports.forEach(p => {
      console.log(`   ${p.path}${p.vendorId ? ` (Vendor: ${p.vendorId})` : ''}`);
    });
    
  } catch (error) {
    console.error('[BLAD] Błąd:', error.message);
  }
}

findWorkingPorts();
