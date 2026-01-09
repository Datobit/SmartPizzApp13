const { SerialPort } = require('serialport');
require('dotenv').config();

// Test połączenia z drukarką Xprinter
async function testPrinter() {
  console.log('[SZUKAM] Szukam dostępnych portów szeregowych...\n');
  
  try {
    // Lista dostępnych portów
    const ports = await SerialPort.list();
    
    if (ports.length === 0) {
      console.log('[BLAD] Nie znaleziono żadnych portów szeregowych!');
      console.log('   Sprawdź czy drukarka jest podłączona.');
      return;
    }
    
    console.log('[LISTA] Dostępne porty:');
    ports.forEach((port, index) => {
      console.log(`   ${index + 1}. ${port.path}`);
      if (port.manufacturer) console.log(`      Producent: ${port.manufacturer}`);
      if (port.vendorId) console.log(`      Vendor ID: ${port.vendorId}`);
      if (port.productId) console.log(`      Product ID: ${port.productId}`);
    });
    
    // Próba połączenia z pierwszym dostępnym portem USB lub ze zmiennej środowiskowej
    const configuredPort = process.env.PRINTER_PORT;
    
    // Priorytety: skonfigurowany port > porty z Vendor ID > ttyS0
    let selectedPort;
    if (configuredPort && ports.find(p => p.path === configuredPort)) {
      selectedPort = ports.find(p => p.path === configuredPort);
      console.log(`[INFO] Używam skonfigurowanego portu z .env: ${configuredPort}`);
    } else if (ports.find(p => p.path.includes('USB'))) {
      selectedPort = ports.find(p => p.path.includes('USB'));
      console.log('[INFO] Znaleziono port USB');
    } else if (ports.find(p => p.vendorId)) {
      // Port z vendorId może być urządzeniem USB na ttyS
      selectedPort = ports.find(p => p.vendorId);
      console.log(`[INFO] Znaleziono port z Vendor ID: ${selectedPort.path}`);
    } else {
      selectedPort = ports.find(p => p.path === '/dev/ttyS0') || ports[0];
      console.log('[INFO] Używam domyślnego portu');
    }
    
    if (!selectedPort) {
      console.log('\n[BLAD] Nie znaleziono żadnego portu do testowania');
      console.log('[WSKAZOWKA] Dostępne porty:');
      ports.forEach(p => console.log(`   - ${p.path}`));
      return;
    }
    
    const portPath = selectedPort.path;
    console.log(`\n[PORT] Próbuję połączyć się z: ${portPath}`);
    
    const port = new SerialPort({
      path: portPath,
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1
    });
    
    port.on('open', () => {
      console.log('[OK] Port otwarty pomyślnie!');
      console.log('[DOKUMENT] Wysyłam testowy paragon...\n');
      
      // Komendy ESC/POS
      const ESC = 0x1B;
      const GS = 0x1D;
      const LF = 0x0A;
      const CENTER = [ESC, 0x61, 0x01];
      const LEFT = [ESC, 0x61, 0x00];
      const BOLD_ON = [ESC, 0x45, 0x01];
      const BOLD_OFF = [ESC, 0x45, 0x00];
      const SIZE_DOUBLE = [GS, 0x21, 0x11];
      const SIZE_NORMAL = [GS, 0x21, 0x00];
      const CUT = [GS, 0x56, 0x00];
      
      // Przygotuj testowy paragon
      let receipt = [];
      
      // Reset drukarki
      receipt.push(ESC, 0x40);
      
      // Nagłówek
      receipt.push(...CENTER, ...SIZE_DOUBLE, ...BOLD_ON);
      receipt.push(...Buffer.from('TEST DRUKARKI\\n', 'utf-8'));
      receipt.push(...BOLD_OFF, ...SIZE_NORMAL);
      receipt.push(...Buffer.from('================================\\n', 'utf-8'));
      receipt.push(LF);
      
      // Informacje
      receipt.push(...LEFT);
      receipt.push(...Buffer.from('Xprinter V20A_E\\n', 'utf-8'));
      receipt.push(...Buffer.from('Port: 9600,n,8,1\\n', 'utf-8'));
      receipt.push(...Buffer.from(`Data: ${new Date().toLocaleString('pl-PL')}\\n`, 'utf-8'));
      receipt.push(...Buffer.from('================================\\n', 'utf-8'));
      receipt.push(LF);
      
      // Test znaków polskich
      receipt.push(...BOLD_ON);
      receipt.push(...Buffer.from('Test znakow polskich:\\n', 'utf-8'));
      receipt.push(...BOLD_OFF);
      receipt.push(...Buffer.from('ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ\\n', 'utf-8'));
      receipt.push(LF);
      
      // Stopka
      receipt.push(...CENTER);
      receipt.push(...Buffer.from('Test zakończony pomyślnie!\\n', 'utf-8'));
      receipt.push(LF, LF, LF);
      
      // Cięcie papieru
      receipt.push(...CUT);
      
      // Wyślij do drukarki
      const buffer = Buffer.from(receipt);
      port.write(buffer, (err) => {
        if (err) {
          console.error('[BLAD] Błąd wysyłania:', err.message);
        } else {
          console.log('[OK] Testowy paragon wysłany!');
        }
        
        setTimeout(() => {
          port.close();
          console.log('[ZAMKNIETO] Port zamknięty');
          process.exit(0);
        }, 1000);
      });
    });
    
    port.on('error', (err) => {
      console.error('[BLAD] Błąd portu:', err.message);
      console.log('\n[WSKAZOWKA] Sprawdź:');
      console.log('   1. Czy drukarka jest podłączona i włączona');
      console.log('   2. Czy masz uprawnienia do portu (sudo usermod -a -G dialout $USER)');
      console.log('   3. Czy żaden inny program nie korzysta z portu');
      process.exit(1);
    });
    
  } catch (error) {
    console.error('[BLAD] Błąd:', error.message);
    process.exit(1);
  }
}

console.log('');
console.log('   TEST DRUKARKI XPRINTER V20A_E        ');
console.log('\n');

testPrinter();
