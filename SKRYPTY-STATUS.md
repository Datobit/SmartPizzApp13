# 📋 Skrypty Wymagające Aktualizacji

## ✅ ZAKTUALIZOWANE (MySQL/MariaDB)

### Główne Skrypty
- ✅ `orders-viewer.cjs` - viewer zamówień
- ✅ `dashboard.cjs` - dashboard analityczny
- ✅ `update_menu_sqlite.cjs` - aktualizacja menu
- ✅ `check-zamowienia-structure.cjs` - sprawdzanie struktury zamówień

### Skrypty Migracyjne (Już używają MySQL)
- ✅ `migrate-to-mariadb.cjs`
- ✅ `init-mariadb.cjs`
- ✅ `import-data-to-mariadb.cjs`
- ✅ `full-migration.cjs`
- ✅ `test-mariadb-connection.cjs`
- ✅ `check-mariadb-data.cjs` (nowy)

---

## ⚠️ DO AKTUALIZACJI (Nadal używają SQLite)

### Skrypty Pomocnicze
- ⚠️ `fix_db.cjs` - naprawianie bazy (171 linii)
- ⚠️ `check-tables.cjs`
- ⚠️ `check-tables-detailed.cjs`
- ⚠️ `check-table.cjs`
- ⚠️ `check-structure.cjs`
- ⚠️ `check-structure-extras.cjs`
- ⚠️ `check-sqlite-tables.cjs`
- ⚠️ `check-prisma-table.cjs`
- ⚠️ `check-extras.cjs`

### Skrypty .js (ES Modules)
- ⚠️ `check-orders-table.js`
- ⚠️ `check-table.js`
- ⚠️ `check-table-structure.js`
- ⚠️ `copy-data.js`

### Skrypty Debug/Test
- ⚠️ `debug-table-names.cjs`
- ⚠️ `debug-zamowienia.cjs`
- ⚠️ `test-direct-insert.cjs`
- ⚠️ `test-correct-table.cjs`
- ⚠️ `test-new-structure.cjs`
- ⚠️ `test-order.cjs`
- ⚠️ `test-prisma-import.cjs`
- ⚠️ `test-prisma-raw.cjs`

### Inne
- ⚠️ `fix_data_and_schema.cjs`
- ⚠️ `import_skladniki.cjs`
- ⚠️ `migrate-extras.cjs`
- ⚠️ `update_menu_prisma.cjs`

---

## 🗑️ DO USUNIĘCIA (Nieużywane / Testowe)

Większość skryptów z kategorii "Debug/Test" prawdopodobnie były używane tylko podczas rozwoju i testowania:

### Kandydaci do Usunięcia
```bash
# Skrypty testowe SQLite - można usunąć jeśli nie są używane
check-orders-table.js
check-table.js
check-table-structure.js
copy-data.js
debug-table-names.cjs
debug-zamowienia.cjs
test-direct-insert.cjs
test-correct-table.cjs
test-new-structure.cjs
test-order.cjs
test-prisma-import.cjs
test-prisma-raw.cjs
```

---

## 🔧 Akcje Zalecane

### Opcja 1: Aktualizacja Wszystkich (Najbezpieczniejsza)
Zaktualizuj wszystkie skrypty check-*.cjs aby używały MySQL/MariaDB.

### Opcja 2: Usunięcie Nieużywanych (Zalecana)
1. Usuń skrypty testowe/debug
2. Zaktualizuj tylko te, które są używane w produkcji:
   - `fix_db.cjs` (jeśli używany)
   - `import_skladniki.cjs` (jeśli używany)

### Opcja 3: Archiwizacja
```bash
mkdir archive-sqlite-scripts
move check-*.cjs archive-sqlite-scripts\
move test-*.cjs archive-sqlite-scripts\
move debug-*.cjs archive-sqlite-scripts\
```

---

## 📝 Notatki

- **Wszystkie główne skrypty używane w produkcji są już zaktualizowane**
- Pozostałe skrypty to głównie narzędzia deweloperskie/testowe
- Możesz bezpiecznie je usunąć lub zarchiwizować
- W razie potrzeby można je odtworzyć na bazie zaktualizowanych wzorców

---

## ✨ Rekomendacja

**Zamiast aktualizować wszystkie stare skrypty testowe, użyj nowych:**

```bash
# Zamiast check-tables.cjs:
node check-mariadb-data.cjs

# Zamiast check-zamowienia-structure.cjs:
node check-zamowienia-structure.cjs

# Zamiast check-sqlite-tables.cjs:
npx prisma studio
```

Nowe skrypty są prostsze i bardziej uniwersalne.
