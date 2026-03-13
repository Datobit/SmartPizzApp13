-- Migracja: Dodanie kolumny zamowienie_id do tabeli transakcje
-- Data: 2026-03-04
-- Cel: Powiązanie transakcji z zamówieniami dla lepszej integralności danych

USE SmartPizzApp13;

-- Dodaj kolumnę zamowienie_id (nullable, aby istniejące rekordy nie powodowały błędów)
ALTER TABLE transakcje 
ADD COLUMN zamowienie_id INT NULL AFTER sesja_id;

-- Dodaj foreign key constraint (opcjonalnie, ale zalecane dla integralności)
ALTER TABLE transakcje
ADD CONSTRAINT fk_transakcje_zamowienie
FOREIGN KEY (zamowienie_id) REFERENCES zamowienia(id)
ON DELETE SET NULL  -- Jeśli zamówienie zostanie usunięte, transakcja pozostaje ale zamowienie_id = NULL
ON UPDATE CASCADE;

-- Dodaj indeks dla wydajności zapytań
CREATE INDEX idx_transakcje_zamowienie_id ON transakcje(zamowienie_id);

-- Wyświetl statystyki
SELECT 
  COUNT(*) as total_transakcje,
  SUM(CASE WHEN zamowienie_id IS NULL THEN 1 ELSE 0 END) as bez_zamowienia,
  SUM(CASE WHEN zamowienie_id IS NOT NULL THEN 1 ELSE 0 END) as z_zamowieniem
FROM transakcje;

-- Potwierdź strukturę
DESCRIBE transakcje;
