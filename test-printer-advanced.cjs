const { SerialPort } = require('serialport');
require('dotenv').config();

// Test różnych konfiguracji portu
async function testPrinterConfigurations() {
  console.log('');
  console.log('   TEST RÓŻNYCH KONFIGURACJI DRUKARKI   ');
  console.log('\n');
  
  const portPath = process.env.PRINTER_PORT || '/dev/ttyS4';
  console.log(`Testuję port: ${portPath}\n`);
  
  // Konfiguracje do przetestowania
  const configs = [
    {
      name: 'Standard 9600 bez flow control',
      config: {
        path: portPath,
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        rtscts: false,
        xon: false,
        xoff: false
      }
    },
    {
      name: 'Standard 9600 z RTS/CTS',
      config: {
        path: portPath,
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        rtscts: true
      }
    },
    {
      name: 'Standard 9600 z XON/XOFF',
      config: {
        path: portPath,
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        xon: true,
        xoff: true
      }
    }
  ];
  
  for (let i = 0; i < configs.length; i++) {
    const test = configs[i];
    console.log(`\n`);
    console.log(`Test ${i + 1}: ${test.name}`);
    console.log(``);
    
    await testWithConfig(test.config);
    
    // Czekaj 2 sekundy między testami
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n\n');
  console.log('   TESTY ZAKOŃCZONE                     ');
  console.log('');
  console.log('\n[WSKAZOWKA] Sprawdź czy drukarka wydrukowała którykolwiek z testów.');
  console.log('   Jeśli tak - zanotuj który test zadziałał!');
}

function testWithConfig(config) {
  return new Promise((resolve) => {
    const port = new SerialPort(config);
    
    port.on('open', () => {
      console.log('[OK] Port otwarty');
      console.log('[WYSYLAM] Wysyłam test 1: Prosty tekst ASCII...');
      
      // Test 1: Najprostszy możliwy tekst
      const simpleText = 'TEST DRUKARKI\n\n\n\n\n\n';
      port.write(simpleText, (err) => {
        if (err) {
          console.log('[BLAD] Błąd wysyłania tekstu:', err.message);
        } else {
          console.log('[OK] Tekst wysłany');
        }
        
        setTimeout(() => {
          console.log('[WYSYLAM] Wysyłam test 2: Komendy ESC/POS...');
          
          // Test 2: Podstawowe komendy ESC/POS
          const ESC = 0x1B;
          const LF = 0x0A;
          
          const escPos = [
            ESC, 0x40,  // Initialize printer
            ...Buffer.from('TEST ESC/POS\n', 'ascii'),
            LF, LF, LF, LF, LF
          ];
          
          port.write(Buffer.from(escPos), (err) => {
            if (err) {
              console.log('[BLAD] Błąd wysyłania ESC/POS:', err.message);
            } else {
              console.log('[OK] Komendy ESC/POS wysłane');
            }
            
            setTimeout(() => {
              console.log('[WYSYLAM] Wysyłam test 3: ESC/POS z cięciem...');
              
              // Test 3: Z komendą cięcia
              const GS = 0x1D;
              const escPosCut = [
                ESC, 0x40,  // Initialize
                ...Buffer.from('TEST Z CIECIEM\n', 'ascii'),
                LF, LF, LF,
                GS, 0x56, 0x00  // Cut paper
              ];
              
              port.write(Buffer.from(escPosCut), (err) => {
                if (err) {
                  console.log('[BLAD] Błąd wysyłania:', err.message);
                } else {
                  console.log('[OK] Wysłano z komendą cięcia');
                }
                
                setTimeout(() => {
                  port.close();
                  console.log('[ZAMKNIETO] Port zamknięty');
                  resolve();
                }, 1000);
              });
            }, 500);
          });
        }, 500);
      });
    });
    
    port.on('error', (err) => {
      console.log('[BLAD] Błąd portu:', err.message);
      resolve();
    });
  });
}

testPrinterConfigurations();
