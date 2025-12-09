# 🍕 Smart Pizza App - T3 - 📱 **Główna aplikacja**: http://localhost:3002tack

Aplikacja do zamawiania pizzy stworzona na podstawie istniejącej bazy danych.

## 🚀 Funkcjonalności

- ✅ **Automatyczne przeliczanie ceny** z funkcją "pół na pół" (+4 PLN)
- ✅ **Podpowiedzi adresów** z istniejącej bazy ulic
- ✅ **Składanie zamówień** - zapisuje do bazy danych
- ✅ **Przeglądanie zamówień** - osobny serwer do monitorowania
- ✅ **Prisma Studio** - narzędzie do zarządzania bazą danych

## 📊 Dane w bazie

- 🍕 **40 pizz** z trzema rozmiarami (mała/średnia/duża)
- 🥤 **7 napojów**
- 🏠 **531 ulic** do podpowiedzi adresów
- 📝 **Zamówienia** zapisywane w tabeli `Zamówienia`

## 🛠️ Uruchomienie

### Opcja 1: Automatyczne uruchomienie (Windows)
Kliknij dwukrotnie na plik `start-app.bat`

### Opcja 2: Manualne uruchomienie

1. **Główna aplikacja** (zamawianie pizzy):
   ```bash
   npm run dev -- -p 3002
   ```
   Dostępna na: http://localhost:3002

2. **Przeglądarka zamówień**:
   ```bash
   node orders-viewer.cjs
   ```
   Dostępna na: http://localhost:3001

3. **Prisma Studio** (opcjonalnie):
   ```bash
   npx prisma studio
   ```
   Dostępna na: http://localhost:5555

## 🗄️ Baza danych

- **Plik**: `smartpizzapp13-T3.db` (SQLite)
- **Tabele**: Pizza, Napoje, Ulica, Zamówienia, PozycjaExtra
- **Struktura**: Zachowana oryginalna struktura z poprzedniej aplikacji

## 💰 Cennik i funkcje specjalne

### Pizza "pół na pół"
- Możliwość wybrania dwóch różnych pizz na jednym cieście
- Dodatkowa opłata: **+4 PLN**
- Cena = (cena_pizza1 + cena_pizza2) / 2 + 4 PLN

### Rozmiary pizzy
- **Mała**: cena bazowa
- **Średnia**: +7 PLN
- **Duża**: +14 PLN

## 📁 Struktura projektu

```
smartpizzapp-T3/
├── src/
│   ├── pages/
│   │   └── index.tsx          # Główny interfejs aplikacji
│   ├── server/
│   │   └── api/
│   │       └── routers/
│   │           └── pizza.ts   # API backend
│   └── utils/
│       └── api.ts             # Klient tRPC
├── prisma/
│   └── schema.prisma          # Schema bazy danych
├── smartpizzapp13-T3.db       # Baza danych SQLite
├── orders-viewer.cjs          # Serwer do przeglądania zamówień
├── start-app.bat              # Skrypt uruchamiający (Windows)
└── package.json
```

## 🔧 Technologie

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **tRPC** - Type-safe API
- **Prisma** - Database ORM
- **SQLite** - Database
- **Tailwind CSS** - Styling

## 📝 Notatki deweloperskie

- Tabela `Zamówienia` nie ma PRIMARY KEY - używamy raw SQL
- Kompatybilność z oryginalną strukturą bazy zachowana
- Dane zmigrowane z poprzedniej aplikacji
- Prisma Studio może nie wyświetlać tabeli Zamówienia z powodu braku PRIMARY KEY

## 🐛 Rozwiązywanie problemów

1. **Brak pizz na stronie**: Sprawdź połączenie z bazą danych
2. **Błąd Prisma Client**: Uruchom `npx prisma generate`
3. **Port zajęty**: Zmień port w package.json lub zamknij inne aplikacje

## 📞 Kontakt

Aplikacja stworzona dla wydajnego zarządzania zamówieniami pizzy.