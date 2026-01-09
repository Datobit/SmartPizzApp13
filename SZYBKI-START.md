# 🍕 SmartPizzApp13 - Szybki Start

## ✅ Co zostało zrobione:

1. **Aplikacja zbudowana** - gotowa do użycia produkcyjnego
2. **Skrypty startowe** - automatyczne uruchamianie jednym kliknięciem
3. **Instrukcja** - proste kroki dla każdego

---

## 🚀 JAK URUCHOMIĆ APLIKACJĘ (dla NON-IT)

### Sposób 1: Automatyczny (NAJŁATWIEJSZY)

**W folderze aplikacji kliknij dwukrotnie:**
```
start-smartpizzapp.sh
```

**LUB otwórz terminal i wpisz:**
```bash
cd /home/pizzapp13/Documents/PizzApp13/SmartPizzApp13
./start-smartpizzapp.sh
```

### To wszystko! ✅

Aplikacja uruchomi się automatycznie i pokaże adresy:

- **Formularz zamówień**: http://localhost:3000
- **Panel zamówień**: http://localhost:3006  
- **Panel kuchni**: http://localhost:3006/kuchnia

---

## 🛑 JAK ZATRZYMAĆ APLIKACJĘ

**Kliknij dwukrotnie:**
```
stop-smartpizzapp.sh
```

**LUB w terminalu naciśnij:** `Ctrl + C`

---

## 📖 Szczegółowa instrukcja

Pełna instrukcja znajduje się w pliku:
```
INSTRUKCJA-URUCHOMIENIA.md
```

---

## ⚠️ Jeśli coś nie działa

### Problem: Aplikacja nie startuje

**Rozwiązanie:**
```bash
# 1. Zatrzymaj stare procesy
./stop-smartpizzapp.sh

# 2. Sprawdź bazę danych
sudo systemctl status mariadb

# 3. Jeśli baza nie działa:
sudo systemctl start mariadb

# 4. Uruchom ponownie
./start-smartpizzapp.sh
```

### Problem: Port zajęty (3000 lub 3006)

**Rozwiązanie:**
```bash
# Zabij procesy na portach
pkill -f "next"
pkill -f "orders-viewer"

# Uruchom ponownie
./start-smartpizzapp.sh
```

---

## 📝 WAŻNE INFORMACJE

### Co działa w trybie produkcyjnym:
✅ Formularze szybciej się ładują  
✅ Mniejsze zużycie pamięci  
✅ Stabilniejsze działanie  
✅ Automatyczne restarty przy błędach  

### Różnica między DEV a PRODUCTION:

| Funkcja | Dev Mode | Production |
|---------|----------|------------|
| **Uruchomienie** | `npm run dev` | `npm start` |
| **Szybkość** | Wolniejsze | Szybkie ⚡ |
| **Hot reload** | Tak ♻️ | Nie |
| **Dla kogo** | Programiści | Użytkownicy końcowi |

---

## 🔄 Aktualizacja z GitHuba

Jeśli pobierzesz nową wersję:
```bash
cd /home/pizzapp13/Documents/PizzApp13/SmartPizzApp13
git pull
npm install
npm run build
./start-smartpizzapp.sh
```

---

## 📞 Kontakt

Jeśli masz problem:
1. Sprawdź `orders-viewer.log` - tam są błędy serwera
2. Sprawdź konsolę terminala - tam widać błędy Next.js
3. Sprawdź czy MariaDB działa: `sudo systemctl status mariadb`

---

**Wersja:** 1.0  
**Data:** 2026-01-09  
**Build:** Production Ready ✅
