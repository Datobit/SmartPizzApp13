# Konfiguracja Drukarki Xprinter

## Parametry drukarki
- **Model**: Xprinter V20A_E
- **Nazwa modułu**: Printer001
- **Port szeregowy**: SERIAL 9600,n,8,1
  - Prędkość: 9600 baud
  - Parzystość: none (n)
  - Bity danych: 8
  - Bity stopu: 1

## Szybka konfiguracja (zalecane)

```bash
# Uruchom skrypt automatycznej konfiguracji
./setup-printer.sh
```

Skrypt sprawdzi:
- Czy jesteś w grupie dialout
- Jakie porty szeregowe są dostępne
- Automatycznie wykryje port drukarki

## Konfiguracja ręczna

### 1. Znajdź port drukarki
```bash
# Sprawdź dostępne porty szeregowe
ls -l /dev/ttyS* /dev/ttyUSB* /dev/ttyACM* 2>/dev/null

# Typowe porty:
# /dev/ttyS0    - Fizyczny port COM1 (RS-232)
# /dev/ttyUSB0  - Adapter USB-to-Serial
# /dev/ttyACM0  - Niektóre drukarki USB
```

### 2. Ustaw uprawnienia
```bash
# Sprawdź nazwę grupy dla portów szeregowych
ls -l /dev/ttyS0
# Jeśli widzisz 'uucp' - używaj uucp
# Jeśli widzisz 'dialout' - używaj dialout

# Dla Arch Linux / Manjaro (grupa uucp):
sudo usermod -a -G uucp $USER

# Dla Debian / Ubuntu (grupa dialout):
sudo usermod -a -G dialout $USER

# WAŻNE: Wyloguj się i zaloguj ponownie lub zrestartuj komputer!

# Sprawdź czy jesteś w grupie
groups | grep -E 'uucp|dialout'
```

### 3. Konfiguracja portu w .env
Edytuj plik `.env` i ustaw port drukarki:

```bash
# Dla portu COM (RS-232)
PRINTER_PORT="/dev/ttyS0"

# LUB dla USB
PRINTER_PORT="/dev/ttyUSB0"

# LUB dla ACM
PRINTER_PORT="/dev/ttyACM0"
```

## Testowanie drukarki

### Automatyczny test
```bash
# Test połączenia i wydruk testowy
node test-printer.cjs
```

Skrypt automatycznie:
- Wykryje dostępne porty
- Wybierze odpowiedni port (priorytet: PRINTER_PORT > USB > ttyS0)
- Wydrukuje testowy paragon

### Test ręczny
```bash
# Test czy drukarka odpowiada (może nie wydrukować nic czytelnego)
echo "Test drukarki" > /dev/ttyS0
```

### Uruchomienie serwera
```bash
node orders-viewer.cjs
```

### Użycie w interfejsie
1. Otwórz http://localhost:3006
2. Zaznacz checkboxy przy zamówieniach do wydruku
3. Kliknij przycisk " Drukuj zaznaczone"

## Format ESC/POS
Drukarka używa komend ESC/POS do formatowania:
- Centrowanie tekstu
- Pogrubienie
- Podwójna wielkość
- Cięcie papieru

## Rozwiązywanie problemów

### Błąd "Cannot open /dev/ttyUSB0"
- Sprawdź czy drukarka jest podłączona: `ls -l /dev/ttyUSB*`
- Sprawdź uprawnienia: `ls -l /dev/ttyUSB0`
- Dodaj się do grupy dialout i zrestartuj sesję

### Błąd "Port is not open"
- Upewnij się że żaden inny program nie korzysta z portu
- Sprawdź czy drukarka jest włączona

### Nieprawidłowe kodowanie znaków
- System używa UTF-8 dla polskich znaków
- Jeśli znaki się nie wyświetlają, sprawdź czy drukarka obsługuje UTF-8
- Alternatywnie można użyć kodowania Windows-1250 lub ISO-8859-2
