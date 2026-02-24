# 📦 AUTOMATYCZNY BACKUP BAZY DANYCH - INSTRUKCJA

## 🎯 Cel
Automatyczne tworzenie kopii zapasowych wszystkich danych z bazy danych PizzApp13 każdego 1-go dnia miesiąca.

## 📋 Zawartość backupu

Backup obejmuje **wszystkie** tabele:

### Menu i produkty:
- `menu_pizza.csv` - wszystkie pizze z cenami
- `skladniki.csv` - lista składników
- `pizza_skladnik.csv` - powiązania pizza-składnik
- `napoje.csv` - napoje
- `pozycje_extra.csv` - dodatki

### Adresy:
- `dzielnice.csv` - dzielnice z cenami dostawy
- `ulice.csv` - ulice z numerami i przypisaniem do dzielnic

### Zamówienia i rozliczenia:
- `zamowienia.csv` - **wszystkie zamówienia** (najważniejsze!)
- `kierowcy.csv` - lista kierowców
- `sesje.csv` - sesje kierowców
- `transakcje.csv` - transakcje w sesjach

## 🚀 Instalacja (jednorazowa)

### Metoda 1: Automatyczna instalacja (ZALECANA)

```bash
cd /home/pizzapp13/Documents/PizzApp13/SmartPizzApp13
chmod +x setup-backup-automatyczny.sh
./setup-backup-automatyczny.sh
```

Skrypt automatycznie:
1. Sprawdzi czy Node.js jest zainstalowany
2. Skonfiguruje zadanie cron
3. Zaoferuje test backupu

### Metoda 2: Ręczna konfiguracja

1. Otwórz edytor cron:
```bash
crontab -e
```

2. Dodaj na końcu pliku:
```
0 12 1 * * cd /home/pizzapp13/Documents/PizzApp13/SmartPizzApp13 && /usr/bin/node backup-automatyczny.mjs >> /home/pizzapp13/Documents/PizzApp13/SmartPizzApp13/backup-cron.log 2>&1
```

3. Zapisz i zamknij (Ctrl+O, Enter, Ctrl+X)

## ⏰ Harmonogram

**Backup wykonuje się automatycznie:**
- 🗓️ **Dzień**: 1-go każdego miesiąca
- ⏰ **Godzina**: 12:00 (w południe, gdy komputer działa)
- 📊 **Pierwszy backup**: 1 marca 2026 o 12:00

## 📁 Lokalizacja backupów

Backupy są zapisywane w:
```
/home/pizzapp13/Documents/PizzApp13/SmartPizzApp13/csv-export/backup-YYYY-MM-DD/
```

Przykład:
```
csv-export/
├── backup-2026-03-01/    ← Backup z 1 marca 2026
│   ├── menu_pizza.csv
│   ├── zamowienia.csv
│   ├── kierowcy.csv
│   └── ... (wszystkie tabele)
├── backup-2026-04-01/    ← Backup z 1 kwietnia 2026
│   └── ...
└── backup-2026-05-01/    ← Backup z 1 maja 2026
    └── ...
```

## 🧪 Testowanie

### Test ręczny (bez czekania na 1-szy dzień miesiąca):

```bash
cd /home/pizzapp13/Documents/PizzApp13/SmartPizzApp13
node backup-automatyczny.mjs
```

Jeśli wszystko działa poprawnie, zobaczysz:
```
╔════════════════════════════════════════╗
║   AUTOMATYCZNY BACKUP BAZY DANYCH     ║
╚════════════════════════════════════════╝
📅 Data: 2026-02-23
📁 Folder: /home/.../csv-export/backup-2026-02-23

📋 Eksport menu i składników...
  ✅ menu_pizza.csv (25 wierszy)
  ...
  
╔════════════════════════════════════════╗
║        BACKUP ZAKOŃCZONY POMYŚLNIE    ║
╚════════════════════════════════════════╝
```

## 📊 Monitorowanie

### Sprawdź czy zadanie cron jest aktywne:
```bash
crontab -l
```

Powinno wyświetlić linię z `backup-automatyczny.mjs`

### Zobacz logi ostatnich backupów:
```bash
cat /home/pizzapp13/Documents/PizzApp13/SmartPizzApp13/backup-cron.log
```

### Zobacz ostatni backup:
```bash
ls -lt /home/pizzapp13/Documents/PizzApp13/SmartPizzApp13/csv-export/ | head
```

## 🛠️ Zarządzanie

### Wyłączenie automatycznego backupu:
```bash
crontab -e
```
Zakomentuj linię (dodaj `#` na początku) lub usuń ją.

### Zmiana harmonogramu:

Edytuj cron:
```bash
crontab -e
```

Format: `minuta godzina dzień_miesiąca miesiąc dzień_tygodnia komenda`

Przykłady:
- `0 12 1 * *` - 1-go każdego miesiąca o 12:00 (domyślne)
- `0 14 1,15 * *` - 1-go i 15-go każdego miesiąca o 14:00
- `0 12 * * 0` - każdą niedzielę o 12:00
- `0 12 * * *` - codziennie o 12:00

### Ręczne uruchomienie backupu:
```bash
cd /home/pizzapp13/Documents/PizzApp13/SmartPizzApp13
node backup-automatyczny.mjs
```

## 🔧 Rozwiązywanie problemów

### Problem: Backup się nie wykonuje

1. Sprawdź czy cron działa:
```bash
systemctl status cron
```
lub
```bash
systemctl status cronie
```

2. Sprawdź logi cron:
```bash
cat backup-cron.log
```

3. Sprawdź logi systemowe:
```bash
journalctl -u cron | tail -50
```

### Problem: Błędy podczas backupu

1. Sprawdź czy baza danych działa:
```bash
cd /home/pizzapp13/Documents/PizzApp13/SmartPizzApp13
npx prisma db pull
```

2. Sprawdź szczegóły błędu:
```bash
cat csv-export/backup-error.log
```

3. Uruchom backup ręcznie aby zobaczyć błąd:
```bash
node backup-automatyczny.mjs
```

### Problem: Brak uprawnień

```bash
chmod +x setup-backup-automatyczny.sh
chmod +x backup-automatyczny.mjs
```

## 📝 Informacje dodatkowe

- **Wielkość backupu**: Zależy od ilości zamówień (zazwyczaj 1-10 MB)
- **Czas wykonania**: 5-30 sekund
- **Format danych**: CSV (Excel/LibreOffice compatible)
- **Kodowanie**: UTF-8
- **Rozdzielacz**: przecinek (,)

## 🗂️ Przywracanie z backupu

Jeśli potrzebujesz przywrócić dane z backupu:

1. Znajdź odpowiedni folder backupu
2. Użyj narzędzi Prisma lub importuj CSV do bazy danych
3. W razie potrzeby skontaktuj się z administratorem

## ✅ Checklist po instalacji

- [ ] Uruchomiono `setup-backup-automatyczny.sh`
- [ ] Wykonano test ręczny: `node backup-automatyczny.mjs`
- [ ] Sprawdzono czy utworzył się folder w `csv-export/`
- [ ] Sprawdzono wpis cron: `crontab -l`
- [ ] Zaplanowano sprawdzenie 1-go marca 2026

---

**Ostatnia aktualizacja**: 23 lutego 2026
**Wersja**: 1.0
