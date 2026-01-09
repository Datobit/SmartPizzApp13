# SmartPizzApp13

System zarządzania zamówieniami pizzy z integracją drukarki fiskalnej.

## Funkcje

- [LISTA] Formularz zamówień z wyborem pizzy, napojów i dodatków
-  Zarządzanie sesjami kierowców
- [STATS] Statystyki klientów
-  **Drukowanie paragonów na drukarce Xprinter** (nowe!)
-  Baza danych MariaDB
-  Interfejs z Tailwind CSS

## Wymagania

- Node.js 18+
- MariaDB
- Drukarka termiczna Xprinter V20A_E (opcjonalnie)

## Instalacja

```bash
npm install
```

## Uruchomienie

### Serwer Next.js (formularz zamówień)
```bash
npm run dev
# http://localhost:3000
```

### Viewer zamówień
```bash
node orders-viewer.cjs
# http://localhost:3006
```

## Konfiguracja drukarki Xprinter

### Szybka konfiguracja (ZALECANE)
```bash
# Uruchom interaktywny skrypt konfiguracji
./setup-printer.sh
```

### Konfiguracja ręczna

### 1. Dodaj się do grupy dla portów szeregowych
```bash
# Dla Arch Linux / Manjaro:
sudo usermod -a -G uucp $USER

# Dla Debian / Ubuntu:
sudo usermod -a -G dialout $USER

# WYLOGUJ SIĘ i zaloguj ponownie!
```

### 2. Znajdź port drukarki
```bash
ls -l /dev/ttyS* /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
```

### 3. Ustaw port w .env
```bash
# Edytuj .env i dodaj:
PRINTER_PORT="/dev/ttyS0"  # lub /dev/ttyUSB0
```

### 4. Test drukarki
```bash
node test-printer.cjs
```

### 5. Użycie
1. Otwórz http://localhost:3006
2. Zaznacz zamówienia checkboxami
3. Kliknij " Drukuj zaznaczone"

### Parametry drukarki
- Port: Konfigurowalny przez PRINTER_PORT w .env
- Domyślnie: /dev/ttyS0 (port COM)
- Prędkość: 9600 baud
- Format: 8N1 (8 bitów danych, brak parzystości, 1 bit stopu)
- Protokół: ESC/POS

Więcej informacji: [PRINTER-CONFIG.md](PRINTER-CONFIG.md)

## Struktura projektu

- `/src` - Aplikacja Next.js
- `orders-viewer.cjs` - Viewer zamówień z funkcją drukowania
- `test-printer.cjs` - Test połączenia z drukarką
- `prisma/` - Schema bazy danych

## Baza danych

MariaDB z tabelami:
- `zamowienia` - Zamówienia
- `menu_pizza` - Menu pizz
- `napoje` - Napoje
- `pozycje_extra` - Dodatkowe pozycje
- `sesje` - Sesje kierowców
- `kierowcy` - Lista kierowców
- `transakcje` - Transakcje finansowe

