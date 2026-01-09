# Migracja z SQLite do MariaDB

## Wymagania

1. **MariaDB** zainstalowana i uruchomiona
2. **Użytkownik root** z hasłem: `Pepperoni13`
3. **Node.js** i npm zainstalowane
4. **Pakiet mysql2** zainstalowany: `npm install mysql2`

## Automatyczna migracja (ZALECANE)

Uruchom jeden skrypt, który wykona wszystkie kroki automatycznie:

```bash
node full-migration.cjs
```

Ten skrypt:
-  Sprawdzi połączenie z MariaDB
-  Utworzy bazę danych `SmartPizzApp13`
-  Wyeksportuje dane z SQLite
-  Utworzy strukturę tabel w MariaDB
-  Zaimportuje wszystkie dane
-  Wygeneruje Prisma Client

## Ręczna migracja (krok po kroku)

Jeśli wolisz kontrolować każdy krok:

### 1. Eksport danych z SQLite

```bash
node migrate-to-mariadb.cjs
```

To utworzy plik `migration-data.sql` z danymi.

### 2. Inicjalizacja bazy MariaDB

```bash
node init-mariadb.cjs
```

### 3. Wygeneruj Prisma Client

```bash
npx prisma generate
```

### 4. Utwórz strukturę tabel

```bash
npx prisma db push
```

### 5. Importuj dane

```bash
node import-data-to-mariadb.cjs
```

## Weryfikacja migracji

Po zakończeniu migracji:

```bash
# Sprawdź dane w Prisma Studio
npx prisma studio

# Uruchom aplikację
npm run dev
```

## Zmiany w aplikacji

### Schema Prisma

- **Provider**: zmieniony z `sqlite` na `mysql`
- **Connection string**: `mysql://root:Pepperoni13@localhost:3306/SmartPizzApp13`
- **Model Zamowienie**: dodany klucz główny `id` (wymagane w MySQL)

### Pliki zaktualizowane

- `prisma/schema.prisma` - zmiana providera i dodanie modelu Zamowienie
- `.env` - dodany plik z DATABASE_URL
- Wszystkie skrypty używające `sqlite3` będą wymagały aktualizacji

## Connection String

Aplikacja używa teraz:

```
DATABASE_URL="mysql://root:Pepperoni13@localhost:3306/SmartPizzApp13"
```

## Troubleshooting

### Błąd: "Cannot connect to MariaDB"

- Sprawdź czy MariaDB jest uruchomiona
- Sprawdź hasło root: `Pepperoni13`
- Sprawdź port: `3306`

### Błąd: "Database already exists"

Usuń bazę i spróbuj ponownie:

```sql
DROP DATABASE SmartPizzApp13;
```

### Błąd przy imporcie danych

Sprawdź plik `migration-data.sql` - może być problem z kodowaniem znaków.

## Różnice SQLite vs MySQL/MariaDB

1. **AUTOINCREMENT** → **AUTO_INCREMENT**
2. **INTEGER** → **INT**
3. **TEXT** → może być **TEXT** lub **VARCHAR**
4. **Wymagany PRIMARY KEY** w każdej tabeli
5. **DATETIME** zamiast tekstowych dat

## Backup

Przed migracją warto zrobić backup:

```bash
# Backup SQLite
cp prisma/smartpizzapp13-T3.db prisma/smartpizzapp13-T3.db.backup
```

## Po migracji

Możesz bezpiecznie usunąć:
- `prisma/smartpizzapp13-T3.db` (stara baza SQLite)
- Pakiety: `sqlite3`, `better-sqlite3` (jeśli nie są używane)

```bash
npm uninstall sqlite3 better-sqlite3
```
