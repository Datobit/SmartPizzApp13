const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Test drukarki USB (bez SerialPort, bezpośredni zapis)
async function testUSBPrinter() {
  console.log('');
  console.log('   TEST DRUKARKI USB XPRINTER           ');
  console.log('\n');
  
  // Możliwe ścieżki do drukarki USB
  const possiblePaths = [
    '/dev/usb/lp0',
    '/dev/lp0',
    '/dev/usblp0'
  ];
  
  let printerPath = null;
  
  // Znajdź działającą ścieżkę
  for (const testPath of possiblePaths) {
    try {
      if (fs.existsSync(testPath)) {
        const stats = fs.statSync(testPath);
        console.log(`[OK] Znaleziono: ${testPath}`);
        printerPath = testPath;
        break;
      }
    } catch (err) {
      // Ignoruj błędy
    }
  }
  
  if (!printerPath) {
    console.log('[BLAD] Nie znaleziono urządzenia drukarki USB');
    console.log('[WSKAZOWKA] Sprawdź czy drukarka jest podłączona: sudo dmesg | grep -i usb');
    return;
  }
  
  console.log(`\n[DRUKARKA]  Używam: ${printerPath}\n`);
  
  try {
    // Komendy ESC/POS dla Xprinter (bez cięcia)
    const ESC = 0x1B;
    const GS = 0x1D;
    const LF = 0x0A;
    const CENTER = [ESC, 0x61, 0x01]; // Wyśrodkowanie
    const LEFT = [ESC, 0x61, 0x00];   // Do lewej
    const BOLD_ON = [ESC, 0x45, 0x01]; // Pogrubienie
    const BOLD_OFF = [ESC, 0x45, 0x00];
    const SIZE_NORMAL = [GS, 0x21, 0x00];
    const SIZE_DOUBLE = [GS, 0x21, 0x11]; // Podwójna wielkość
    
    // Przygotuj testowy paragon
    let receipt = [];
    
    // Reset drukarki
    receipt.push(ESC, 0x40);
    
    // Nagłówek
    receipt.push(...CENTER, ...SIZE_DOUBLE, ...BOLD_ON);
    receipt.push(...Buffer.from('TEST DRUKARKI\n', 'utf-8'));
    receipt.push(...BOLD_OFF, ...SIZE_NORMAL);
    receipt.push(...Buffer.from('================================\n', 'utf-8'));
    receipt.push(LF);
    
    // Informacje
    receipt.push(...LEFT);
    receipt.push(...Buffer.from('Xprinter USB\n', 'utf-8'));
    receipt.push(...Buffer.from(`Data: ${new Date().toLocaleString('pl-PL')}\n`, 'utf-8'));
    receipt.push(...Buffer.from('================================\n', 'utf-8'));
    receipt.push(LF);
    
    // Test znaków polskich
    receipt.push(...BOLD_ON);
    receipt.push(...Buffer.from('Test znakow:\n', 'utf-8'));
    receipt.push(...BOLD_OFF);
    receipt.push(...Buffer.from('Pizza Margherita\n', 'utf-8'));
    receipt.push(...Buffer.from('Cena: 25 PLN\n', 'utf-8'));
    receipt.push(LF);
    
    // Stopka
    receipt.push(...CENTER);
    receipt.push(...Buffer.from('Test zakoncony!\n', 'utf-8'));
    receipt.push(LF, LF, LF, LF, LF, LF); // Kilka linii do wycięcia ręcznego
    
    // Wyślij do drukarki
    const buffer = Buffer.from(receipt);
    
    console.log('[WYSYLAM] Wysyłam dane do drukarki...');
    fs.writeFileSync(printerPath, buffer);
    console.log('[OK] Dane wysłane!');
    console.log('\n[WSKAZOWKA] Sprawdź czy drukarka wydrukowała paragon.');
    console.log('   Jeśli tak - zapisz tę ścieżkę: ' + printerPath);
    
  } catch (error) {
    console.error('[BLAD] Błąd:', error.message);
    
    if (error.code === 'EACCES') {
      console.log('\n[WSKAZOWKA] Brak uprawnień. Spróbuj:');
      console.log(`   sudo chmod 666 ${printerPath}`);
      console.log('   lub');
      console.log('   sudo chown $USER ${printerPath}');
    }
  }
}

testUSBPrinter();
