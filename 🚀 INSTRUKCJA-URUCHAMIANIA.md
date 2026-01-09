# 🍕 JAK URUCHOMIĆ PIZZERIĘ - INSTRUKCJA KROK PO KROKU

## 📂 KROK 1: Otwórz folder aplikacji

Przejdź do:
```
/home/pizzapp13/Documents/PizzApp13/SmartPizzApp13
```

W tym folderze zobaczysz pliki:
- `START-PIZZERIA.sh` ⬅️ TEN plik uruchamia pizzerię
- `STOP-PIZZERIA.sh` ⬅️ TEN plik zatrzymuje pizzerię

---

## ▶️ KROK 2: Uruchom pizzerię

### Sposób 1: Dwukrotne kliknięcie (może nie zadziałać)
Kliknij **2 razy** na plik `START-PIZZERIA.sh`

### Sposób 2: Prawy przycisk myszy (ZALECANE)
1. Kliknij **PRAWYM** przyciskiem na `START-PIZZERIA.sh`
2. Wybierz opcję:
   - **"Uruchom jako program"** LUB
   - **"Run as a Program"** LUB  
   - **"Execute"**

### Sposób 3: Terminal (zawsze działa)
1. Otwórz terminal w tym folderze:
   - Kliknij prawym w pustym miejscu w folderze
   - Wybierz "Otwórz w terminalu" / "Open in Terminal"
2. Wpisz:
   ```bash
   ./START-PIZZERIA.sh
   ```
3. Naciśnij ENTER

---

## ✅ Co się stanie po uruchomieniu:

Zobaczysz okno z komunikatami:
```
╔════════════════════════════════════╗
║    🍕 PIZZERIA - START 🍕         ║
╚════════════════════════════════════╝

▶️  Uruchamiam formularz zamówień...
▶️  Uruchamiam panel zamówień...

╔════════════════════════════════════╗
║     ✅ PIZZERIA URUCHOMIONA! ✅    ║
╚════════════════════════════════════╝

📱 Otwórz w przeglądarce:

   🌐 Formularz zamówień:
      http://localhost:3000
   
   📊 Panel zamówień:
      http://localhost:3006
   
   👨‍🍳 Panel kuchni:
      http://localhost:3006/kuchnia
```

**Naciśnij ENTER** - okno się zamknie, ale aplikacja dalej działa!

---

## 🌐 KROK 3: Otwórz w przeglądarce

Otwórz przeglądarkę (Chrome/Firefox) i wpisz:

| Co chcesz zrobić | Wpisz w przeglądarkę |
|-----------------|---------------------|
| Przyjąć zamówienie | `localhost:3000` |
| Zobaczyć zamówienia | `localhost:3006` |
| Panel kuchni | `localhost:3006/kuchnia` |

---

## 🛑 KROK 4: Zatrzymaj pizzerię (na koniec dnia)

### Sposób 1: Prawy przycisk (ZALECANE)
1. Kliknij **PRAWYM** na `STOP-PIZZERIA.sh`
2. Wybierz "Uruchom jako program" / "Run as a Program"

### Sposób 2: Terminal
```bash
./STOP-PIZZERIA.sh
```

Zobaczysz:
```
╔════════════════════════════════════╗
║    🛑 PIZZERIA - STOP 🛑          ║
╚════════════════════════════════════╝

✅ Formularz zamówień zatrzymany
✅ Panel zamówień zatrzymany

╔════════════════════════════════════╗
║   ✅ PIZZERIA ZATRZYMANA! ✅       ║
╚════════════════════════════════════╝
```

---

## 🔧 TROUBLESHOOTING - Gdy coś nie działa

### ❌ Problem: "Nie mogę kliknąć pliku"

**Rozwiązanie - nadaj uprawnienia:**
1. Kliknij **PRAWYM** na `START-PIZZERIA.sh`
2. Wybierz **"Właściwości"** / **"Properties"**
3. Zakładka **"Uprawnienia"** / **"Permissions"**
4. ✅ Zaznacz: **"Zezwól na wykonywanie pliku jako programu"**
5. Kliknij **OK**
6. Spróbuj ponownie

### ❌ Problem: "Port zajęty" lub "Już działa"

**Rozwiązanie:**
1. Uruchom `STOP-PIZZERIA.sh`
2. Poczekaj 5 sekund
3. Uruchom ponownie `START-PIZZERIA.sh`

### ❌ Problem: "MariaDB nie działa"

**Rozwiązanie - uruchom bazę danych:**
```bash
sudo systemctl start mariadb
```
Podaj hasło, potem uruchom ponownie pizzerię.

---

## 📋 SZYBKA ŚCIĄGAWKA

```
🟢 URUCHOMIENIE:
   Prawy przycisk na START-PIZZERIA.sh 
   → "Uruchom jako program"

🌐 OTWÓRZ:
   localhost:3000  (Formularze)
   localhost:3006  (Zamówienia)
   localhost:3006/kuchnia  (Kuchnia)

🔴 ZATRZYMANIE:
   Prawy przycisk na STOP-PIZZERIA.sh
   → "Uruchom jako program"
```

---

## ⚡ PIERWSZE URUCHOMIENIE

**UWAGA:** Pierwsze uruchomienie trwa **2-3 minuty** (budowanie aplikacji).
Kolejne uruchomienia będą szybkie (5-10 sekund)!

---

## 💡 WAŻNE ZASADY

✅ **ZAWSZE zatrzymuj aplikację przed wyłączeniem komputera**
   - Uruchom STOP-PIZZERIA.sh
   - Poczekaj na potwierdzenie
   - Dopiero wyłącz komputer

✅ **Nie zamykaj okna terminala** jeśli się otworzy
   - Aplikacja działa w tle
   - Możesz nacisnąć ENTER aby zamknąć okno
   - Aplikacja dalej będzie działać

✅ **Przed rozpoczęciem pracy**
   - Uruchom START-PIZZERIA.sh
   - Poczekaj 10 sekund
   - Otwórz przeglądarkę

---

## 🎯 TO WSZYSTKO!

Teraz już wiesz jak:
1. ▶️ Uruchomić pizzerię
2. 🌐 Otworzyć aplikację
3. 🛑 Zatrzymać pizzerię

**Wszystko przez kliknięcie prawym przyciskiem!** 🎉
