@echo off
echo 🍕 Uruchamianie Smart Pizza App - T3 Stack
echo.

echo ⚡ Zatrzymywanie poprzednich procesów...
taskkill /f /im node.exe >nul 2>&1

echo 🔧 Generowanie Prisma Client...
npx prisma generate

echo 🚀 Uruchamianie głównej aplikacji (port 3002)...
start "Pizza App" cmd /k "cd /d \"%~dp0\" && npm run dev -- -p 3002"

echo ⏳ Czekam 5 sekund na uruchomienie głównej aplikacji...
timeout /t 5 /nobreak >nul

echo 📋 Uruchamianie przeglądarki zamówień (port 3001)...
start "Orders Viewer" cmd /k "cd /d \"%~dp0\" && node orders-viewer.cjs"

echo.
echo ✅ Wszystkie aplikacje uruchomione!
echo.
echo 🌐 DOSTĘPNE STRONY:
echo 📱 Główna aplikacja: http://localhost:3002
echo 📋 Przeglądarka zamówień: http://localhost:3001
echo 🗄️  Prisma Studio: uruchom "npx prisma studio"
echo 🧪 Debug API: http://localhost:8080/debug
echo.
echo 💡 Funkcjonalności:
echo    ✅ Automatyczne przeliczanie ceny
echo    ✅ Funkcja "pół na pół" (+4 PLN)
echo    ✅ Składanie zamówień
echo    ✅ Podpowiedzi adresów
echo    ✅ Przycisk czyszczenia formularza
echo.
pause