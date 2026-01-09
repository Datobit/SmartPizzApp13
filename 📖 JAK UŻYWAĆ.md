# 🍕 SmartPizzApp13 - INSTRUKCJA DLA UŻYTKOWNIKA

## ✅ JAK URUCHOMIĆ PIZZERIĘ (2 KLIKNIĘCIA!)

### 📂 Otwórz folder aplikacji:
```
/home/pizzapp13/Documents/PizzApp13/SmartPizzApp13
```

### 1️⃣ URUCHOMIENIE:

**Znajdź i kliknij dwukrotnie plik:**

```
▶️ START PIZZERIA
```

**Co się stanie:**
- Otworzy się okno terminala
- Aplikacja uruchomi się automatycznie
- Zobaczysz adresy stron:
  - http://localhost:3000 (Formularze)
  - http://localhost:3006 (Zamówienia)
  - http://localhost:3006/kuchnia (Kuchnia)

⚠️ **WAŻNE:** NIE ZAMYKAJ tego okna terminala! Aplikacja działa dopóki okno jest otwarte.

---

### 2️⃣ ZATRZYMANIE:

**Znajdź i kliknij dwukrotnie plik:**

```
⏹️ STOP PIZZERIA
```

**Co się stanie:**
- Otworzy się okno
- Aplikacja zostanie zatrzymana
- Zobaczysz komunikat "✅ Wszystkie aplikacje zatrzymane"
- Naciśnij ENTER aby zamknąć okno

---

## 🎯 TO WSZYSTKO!

Teraz możesz:
- **Uruchomić:** Dwukrotnie kliknij `▶️ START PIZZERIA`
- **Zatrzymać:** Dwukrotnie kliknij `⏹️ STOP PIZZERIA`

**Żadnych komend w terminalu! Wszystko działa przez kliknięcie!** ✨

---

## 🌐 Adresy aplikacji (otwórz w przeglądarce):

Po uruchomieniu wpisz w przeglądarce:

| Co chcesz zrobić | Adres |
|-----------------|--------|
| 📝 **Przyjąć zamówienie** | http://localhost:3000 |
| 📊 **Zobaczyć listę zamówień** | http://localhost:3006 |
| 👨‍🍳 **Panel dla kuchni** | http://localhost:3006/kuchnia |

---

## ⚠️ Co zrobić gdy coś nie działa?

### Problem: "Plik nie uruchamia się po kliknięciu"

**Rozwiązanie:**
1. Kliknij PRAWYM przyciskiem na `▶️ START PIZZERIA`
2. Wybierz "Właściwości" lub "Properties"
3. Zakładka "Uprawnienia" lub "Permissions"
4. Zaznacz: "Zezwól na wykonywanie pliku jako programu"
5. Kliknij OK
6. Spróbuj ponownie dwukrotnie kliknąć plik

### Problem: "Baza danych nie działa"

**Rozwiązanie:**
Otwórz terminal i wpisz:
```bash
sudo systemctl start mariadb
```
Podaj hasło i spróbuj ponownie uruchomić pizzerię.

### Problem: "Port 3000 lub 3006 zajęty"

**Rozwiązanie:**
1. Kliknij `⏹️ STOP PIZZERIA`
2. Poczekaj 5 sekund
3. Kliknij `▶️ START PIZZERIA`

---

## 📌 WAŻNE WSKAZÓWKI

✅ **Przed zamknięciem komputera:**
- Zawsze kliknij `⏹️ STOP PIZZERIA`
- Poczekaj aż aplikacja się zatrzyma
- Dopiero wtedy wyłącz komputer

✅ **Okno terminala:**
- NIE ZAMYKAJ okna które otworzy się po kliknięciu START
- Aplikacja działa dopóki to okno jest otwarte
- Możesz je zminimalizować

✅ **Pierwsze uruchomienie:**
- Może trwać 2-3 minuty (budowanie aplikacji)
- Kolejne uruchomienia będą szybkie (5-10 sekund)

---

## 🔄 Aktualizacja aplikacji

Jeśli programista przysłał nową wersję:

1. Kliknij `⏹️ STOP PIZZERIA`
2. Otwórz terminal w folderze aplikacji
3. Wpisz:
```bash
git pull
npm install
npm run build
```
4. Kliknij `▶️ START PIZZERIA`

---

## 📞 Pomoc

**Jeśli dalej nie działa:**
- Zrób zrzut ekranu błędu
- Sprawdź plik `orders-viewer.log` w folderze aplikacji
- Skontaktuj się z administratorem

---

**To naprawdę proste! Dwa kliknięcia i gotowe!** 🎉

```
▶️ START  →  Pracuj  →  ⏹️ STOP
```
