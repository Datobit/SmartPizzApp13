# 🎯 SZYBKI START - Automatyczny Backup

## Co zostało utworzone?

✅ **3 nowe pliki:**

1. **`backup-automatyczny.mjs`** - główny skrypt backupu
2. **`setup-backup-automatyczny.sh`** - instalator (jednorazowy)
3. **`BACKUP-AUTOMATYCZNY-INSTRUKCJA.md`** - pełna dokumentacja

## 🚀 Jak uruchomić (2 kroki):

### KROK 1: Instalacja (tylko raz!)
```bash
cd /home/pizzapp13/Documents/PizzApp13/SmartPizzApp13
./setup-backup-automatyczny.sh
```

### KROK 2: Gotowe!
Backup będzie się automatycznie wykonywał **1-go dnia każdego miesiąca o 12:00** (w południe).

## 📦 Co jest backupowane?

**WSZYSTKIE dane:**
- Zamówienia (najważniejsze!)
- Menu (pizze, składniki, napoje, dodatki)
- Adresy (ulice, dzielnice)
- Kierowcy, sesje, transakcje

## 📁 Gdzie są backupy?

```
csv-export/backup-YYYY-MM-DD/
```

Każdy backup w osobnym folderze z datą.

## 🧪 Test przed pierwszym użyciem:

```bash
node backup-automatyczny.mjs
```

## ⏰ Harmonogram:

- **1 marca 2026 o 12:00** - pierwszy automatyczny backup
- **1 kwietnia 2026 o 12:00** - drugi backup
- **1 maja 2026 o 12:00** - trzeci backup
- itd.

💡 Godzina 12:00 zapewnia, że komputer jest włączony (cron nie nadrabia pominiętych zadań).

## 📊 Sprawdź czy działa:

```bash
crontab -l
```

Powinno pokazać linię z `backup-automatyczny.mjs`

---

**Więcej informacji:** Zobacz plik `BACKUP-AUTOMATYCZNY-INSTRUKCJA.md`
