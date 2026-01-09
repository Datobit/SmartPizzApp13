# Instrukcja Uruchomienia SmartPizzApp13

## Wymagania
- Node.js zainstalowany
- MariaDB uruchomiona (hasło: Pepperoni13)
- Drukarka termiczna podłączona (opcjonalnie)

## Pierwsze uruchomienie (tylko raz)

### 1. Zbuduj aplikację:
```bash
npm run build
```

To polecenie przygotuje aplikację do użycia produkcyjnego. Zajmie 1-2 minuty.

## Codzienne uruchamianie aplikacji

### Opcja A: Automatyczny start (ZALECANE)

Kliknij dwukrotnie na plik:
```
start-smartpizzapp.sh
```

Lub w terminalu:
```bash
./start-smartpizzapp.sh
```

To uruchomi:
- Formularz zamówień na http://localhost:3000
- Panel zamówień na http://localhost:3006
- Panel kuchni na http://localhost:3006/kuchnia

### Opcja B: Ręczny start

#### 1. Uruchom główną aplikację (formularz):
```bash
npm start
```
Aplikacja będzie dostępna na: **http://localhost:3000**

#### 2. W nowym terminalu uruchom panel zamówień:
```bash
node orders-viewer.cjs
```
Panel dostępny na: **http://localhost:3006**

## Adresy aplikacji

| Funkcja | Adres |
|---------|-------|
| **Formularz zamówień** | http://localhost:3000 |
| **Panel zamówień (orders viewer)** | http://localhost:3006 |
| **Panel kuchni** | http://localhost:3006/kuchnia |

## Zatrzymanie aplikacji

Naciśnij `Ctrl + C` w terminalu gdzie działa aplikacja.

Lub użyj skryptu:
```bash
./stop-smartpizzapp.sh
```

## Troubleshooting

### Problem: "Port 3000 already in use"
```bash
pkill -f "next"
npm start
```

### Problem: "Port 3006 already in use"
```bash
pkill -f "orders-viewer"
node orders-viewer.cjs
```

### Problem: Baza danych nie działa
```bash
sudo systemctl start mariadb
```

### Problem: Drukarka nie drukuje
Sprawdź czy jest podłączona:
```bash
ls -la /dev/usb/lp0
```

## Aktualizacja aplikacji z GitHub

```bash
git pull
npm install
npm run build
```

Następnie uruchom ponownie aplikację.
