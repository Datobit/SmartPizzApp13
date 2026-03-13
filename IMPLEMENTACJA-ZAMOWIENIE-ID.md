# Implementacja powiązania transakcji z zamówieniami

## Data: 2026-03-04

## Cel
Dodanie kolumny `zamowienie_id` do tabeli `transakcje` w celu:
- Lepszej integralności danych
- Rozróżnienia transakcji manualnych od automatycznych (z zamówień)
- Umożliwienia edycji tylko transakcji manualnych
- Przekierowania do POZ dla transakcji z zamówień

## Zmiany w bazie danych

### 1. Dodanie kolumny `zamowienie_id`
```sql
ALTER TABLE transakcje 
ADD COLUMN zamowienie_id INT NULL AFTER sesja_id;
```

### 2. Dodanie foreign key constraint
```sql
ALTER TABLE transakcje
ADD CONSTRAINT fk_transakcje_zamowienie
FOREIGN KEY (zamowienie_id) REFERENCES zamowienia(id)
ON DELETE SET NULL
ON UPDATE CASCADE;
```

### 3. Dodanie indeksu
```sql
CREATE INDEX idx_transakcje_zamowienie_id ON transakcje(zamowienie_id);
```

## Zmiany w kodzie

### Backend (orders-viewer.cjs)

#### 1. Aktualizacja tworzenia transakcji z zamówień
Wszystkie miejsca tworzące transakcje z zamówień teraz zapisują `zamowienie_id`:
- Linia ~170: Zmiana sesji kierowcy
- Linia ~204: Zmiana z online na gotówka/karta
- Linia ~228: Tworzenie nowej transakcji

```javascript
// Przed:
INSERT INTO transakcje (sesja_id, typ, kwota, forma_platnosci, opis)

// Po:
INSERT INTO transakcje (sesja_id, zamowienie_id, typ, kwota, forma_platnosci, opis)
```

#### 2. Nowy endpoint DELETE /api/transakcje/:id
- Sprawdza czy transakcja jest manualna (zamowienie_id === null)
- Pozwala usunąć tylko transakcje manualne
- Zwraca błąd 403 dla transakcji z zamówień

### Backend (src/server/api/routers/pizza.ts)

#### 1. Aktualizacja placeOrder
- Pobiera ID nowo utworzonego zamówienia używając `LAST_INSERT_ID()`
- Zapisuje `zamowienie_id` przy tworzeniu transakcji
- Zwraca prawdziwe ID zamówienia zamiast timestamp

```typescript
const zamowienieIdResult = await db.$queryRaw<Array<{ id: number }>>`SELECT LAST_INSERT_ID() as id`;
const zamowienieId = zamowienieIdResult[0]?.id || 0;
```

### Frontend (sesja.html)

#### 1. Rozszerzona tabela transakcji
- Dodana kolumna "Akcje"
- Dla transakcji z zamówieniem: link "📋 Edytuj w POZ"
- Dla transakcji manualnych: przyciski "✏️ Edytuj" i "🗑️ Usuń"

#### 2. Nowe funkcje JavaScript
```javascript
async function editTransakcja(transakcjaId) {
  // TODO: Modal edycji (placeholder)
}

async function deleteTransakcja(transakcjaId) {
  // Wywołuje DELETE /api/transakcje/:id
}
```

## Logika działania

### Transakcje z zamówień (zamowienie_id !== null)
- ✅ Automatycznie tworzone przy składaniu zamówienia
- ✅ Automatycznie aktualizowane przy edycji zamówienia w POZ
- ❌ NIE MOŻNA edytować bezpośrednio w sesji
- ✅ Link "Edytuj w POZ" przekierowuje do panelu obsługi zamówień

### Transakcje manualne (zamowienie_id === null)
- ✅ Tworzone ręcznie przez użytkownika
- ✅ Można edytować (funkcja w przyszłości)
- ✅ Można usunąć
- ⚠️ NIE są powiązane z zamówieniami

## Bezpieczeństwo i integralność

1. **Foreign Key**: Zapewnia że zamowienie_id odnosi się do istniejącego zamówienia
2. **ON DELETE SET NULL**: Jeśli zamówienie zostanie usunięte, transakcja pozostaje ale traci powiązanie
3. **Walidacja backendu**: Sprawdza zamowienie_id przed usunięciem transakcji
4. **Nullable kolumna**: Istniejące transakcje nie powodują błędów

## Migracja istniejących danych

Wszystkie istniejące transakcje mają `zamowienie_id = NULL`, co oznacza że:
- Są traktowane jako manualne
- Można je edytować i usuwać
- To zachowanie jest zamierzone dla bezpieczeństwa

## Testowanie

### Test 1: Nowe zamówienie
1. Złóż zamówienie przez formularz
2. Sprawdź w sesji czy transakcja ma link "Edytuj w POZ"
3. Kliknij link - powinien przekierować do POZ

### Test 2: Edycja zamówienia w POZ
1. Edytuj zamówienie (zmień cenę)
2. Sprawdź w sesji czy kwota się zaktualizowała
3. Transakcja powinna nadal mieć link do POZ

### Test 3: Transakcja manualna
1. Dodaj manualny wpływ/wydatek w sesji
2. Sprawdź czy ma przyciski Edytuj/Usuń
3. Usuń transakcję - powinna zniknąć

### Test 4: Próba usunięcia transakcji z zamówienia
1. Spróbuj usunąć transakcję z zamówieniem
2. Powinien pojawić się błąd 403

## Pliki zmodyfikowane

1. ✅ `add-zamowienie-id-to-transakcje.sql` - nowy plik migracji
2. ✅ `orders-viewer.cjs` - aktualizacja INSERT INTO transakcje
3. ✅ `src/server/api/routers/pizza.ts` - zapisywanie zamowienie_id
4. ✅ `sesja.html` - UI dla edycji/usuwania transakcji

## Następne kroki (opcjonalne)

1. Implementacja modala edycji transakcji manualnych
2. Dodanie filtrów: pokaż tylko manualne / tylko z zamówień
3. Dodanie kolumny "Typ" w tabeli (manualna/automatyczna)
4. Historia zmian transakcji (audit log)

## Stabilność

✅ Wszystkie zmiany są wstecznie kompatybilne
✅ Istniejące transakcje działają bez zmian
✅ Foreign key z ON DELETE SET NULL zapewnia bezpieczeństwo
✅ Walidacja backendu zapobiega usunięciu transakcji z zamówień
✅ Brak błędów składniowych w kodzie
