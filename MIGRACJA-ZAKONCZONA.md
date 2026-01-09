#  Migracja z SQLite do MariaDB - ZAKOŃCZONA

**Data:** 9 grudnia 2025  
**Status:**  SUKCES

---

## [STATS] Podsumowanie Migracji

### Dane Zmigrowane
-  **menu_pizza**: 41 rekordów
-  **skladniki**: 43 rekordów
-  **relacja_skladniki**: 258 rekordów
-  **napoje**: 14 rekordów
-  **pozycje_extra**: 4 rekordy
-  **ulice**: 531 rekordów
-  **zamowienia**: 2 rekordy

**RAZEM: 891 rekordów**

---

##  Zaktualizowane Pliki

### 1. Konfiguracja Bazy Danych
-  `prisma/schema.prisma` - zmiana provider z `sqlite` na `mysql`
-  `.env` - dodany `DATABASE_URL="mysql://root:Pepperoni13@localhost:3306/SmartPizzApp13"`
-  `package.json` - dodane skrypty migracyjne

### 2. Główne Skrypty (Zaktualizowane do MariaDB)
-  `orders-viewer.cjs` - viewer zamówień (mysql2)
-  `dashboard.cjs` - dashboard analityczny (mysql2)
-  `update_menu_sqlite.cjs` - aktualizacja menu (mysql2)
-  `check-zamowienia-structure.cjs` - sprawdzanie struktury (mysql2)

### 3. Nowe Skrypty Migracyjne
-  `migrate-to-mariadb.cjs` - eksport danych z SQLite
-  `init-mariadb.cjs` - inicjalizacja bazy MariaDB
-  `import-data-to-mariadb.cjs` - import danych do MariaDB
-  `full-migration.cjs` - pełna automatyczna migracja
-  `test-mariadb-connection.cjs` - test połączenia
-  `check-mariadb-data.cjs` - sprawdzanie danych w MariaDB

---

##  Zainstalowane Pakiety

```bash
npm install mysql2 dotenv
```

- **mysql2** - sterownik MySQL/MariaDB dla Node.js
- **dotenv** - zarządzanie zmiennymi środowiskowymi

---

##  Uruchamianie Aplikacji

### Główna Aplikacja
```bash
npm run dev
```
Aplikacja dostępna na: http://localhost:3000

### Dashboard Analityczny
```bash
node dashboard.cjs
```
Dashboard dostępny na: http://localhost:3007

### Viewer Zamówień
```bash
node orders-viewer.cjs
```
Viewer dostępny na: http://localhost:3006

---

## [SZUKAM] Skrypty Sprawdzające

### Sprawdź wszystkie dane w MariaDB
```bash
node check-mariadb-data.cjs
```

### Sprawdź strukturę tabeli zamowienia
```bash
node check-zamowienia-structure.cjs
```

### Test połączenia z bazą
```bash
npm run migrate:test
```

---

##  Informacje o Bazie Danych

### Connection String
```
mysql://root:Pepperoni13@localhost:3306/SmartPizzApp13
```

### Detale Połączenia
- **Host**: localhost
- **Port**: 3306
- **User**: root
- **Password**: Pepperoni13
- **Database**: SmartPizzApp13
- **Wersja MariaDB**: 12.1.2-MariaDB

---

##  Struktura Tabeli Zamowienia

```sql
CREATE TABLE zamowienia (
  id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  telefon TEXT NULL,
  adres TEXT NULL,
  pizze TEXT NULL,
  sosy TEXT NULL,
  napoj TEXT NULL,
  pozycje_extra TEXT NULL,
  platnosc TEXT NULL,
  cena_calkowita DOUBLE NULL,
  created_at DATETIME NULL,
  is_kupony INT(11) NULL,
  typ_zamowienia TEXT NULL,
  skladniki TEXT NULL
);
```

---

##  Komendy NPM

### Migracja
```bash
npm run migrate:test      # Test połączenia z MariaDB
npm run migrate:export    # Eksport danych z SQLite
npm run migrate:import    # Import danych do MariaDB
npm run migrate:full      # Pełna automatyczna migracja
```

### Prisma
```bash
npx prisma generate       # Generuj Prisma Client
npx prisma db push        # Synchronizuj schemat z bazą
npx prisma studio         # Otwórz Prisma Studio
```

---

##  Następne Kroki

### Zalecane
1.  **Przetestuj aplikację**: `npm run dev`
2.  **Sprawdź dashboard**: `node dashboard.cjs`
3.  **Sprawdź viewer zamówień**: `node orders-viewer.cjs`
4.  **Zaktualizuj pozostałe skrypty** (fix_db.cjs, check-*.cjs) jeśli są używane

### Opcjonalne
1.  **Usuń stare pakiety SQLite**:
   ```bash
   npm uninstall sqlite3 better-sqlite3
   ```

2.  **Zarchiwizuj starą bazę SQLite**:
   ```bash
   mkdir archive
   move smartpizzapp13-T3.db archive/
   move prisma\smartpizzapp13-T3.db archive\
   ```

3.  **Usuń stare skrypty migracyjne**:
   - Skrypty check-* korzystające ze SQLite
   - Stare skrypty testowe

---

##  Rozwiązywanie Problemów

### Błąd połączenia z bazą
```bash
# Sprawdź czy MariaDB działa
Get-Service MySQL*

# Sprawdź port
netstat -an | findstr 3306
```

### Problem z Prisma Client
```bash
# Regeneruj klienta
npx prisma generate
```

### Błędy w skryptach
```bash
# Upewnij się że wszystkie zależności są zainstalowane
npm install
```

---

##  Użyte Technologie

- **Node.js**: 22.20.0
- **Prisma**: 5.22.0
- **MariaDB**: 12.1.2
- **mysql2**: ^3.11.5
- **dotenv**: ^17.2.3
- **Next.js**: (T3 Stack)

---

##  Weryfikacja Migracji

Wszystkie testy przeszły pomyślnie:
-  Połączenie z MariaDB działa
-  Wszystkie tabele utworzone
-  Wszystkie dane zaimportowane (891 rekordów)
-  Prisma Client wygenerowany
-  Struktura tabeli zamowienia poprawna
-  Przykładowe zamówienia widoczne

---

**Migracja zakończona sukcesem! **
