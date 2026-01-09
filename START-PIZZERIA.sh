#!/bin/bash

# Kolorowy nagłówek
echo -e "\033[1;32m"
echo "╔════════════════════════════════════╗"
echo "║    🍕 PIZZERIA - START 🍕         ║"
echo "╔════════════════════════════════════╗"
echo -e "\033[0m"
echo ""

cd /home/pizzapp13/Documents/PizzApp13/SmartPizzApp13

# Sprawdź czy MariaDB działa
if ! systemctl is-active --quiet mariadb; then
    echo "⚠️  MariaDB nie działa. Uruchamiam..."
    sudo systemctl start mariadb
    sleep 2
fi

# Sprawdź czy aplikacja została zbudowana
if [ ! -d ".next" ]; then
    echo "⚠️  Pierwsze uruchomienie - buduję aplikację..."
    echo "📦 To zajmie 1-2 minuty. Poczekaj..."
    npm run build
fi

echo "🚀 Uruchamiam aplikacje..."
echo ""

# Zatrzymaj stare procesy
pkill -f "next start" 2>/dev/null
pkill -f "orders-viewer" 2>/dev/null
sleep 1

# Uruchom Next.js app
echo "▶️  Uruchamiam formularz zamówień..."
nohup npm start > /dev/null 2>&1 &

sleep 3

# Uruchom orders-viewer
echo "▶️  Uruchamiam panel zamówień..."
nohup node orders-viewer.cjs > orders-viewer.log 2>&1 &

sleep 2

echo ""
echo -e "\033[1;32m"
echo "╔════════════════════════════════════╗"
echo "║     ✅ PIZZERIA URUCHOMIONA! ✅    ║"
echo "╚════════════════════════════════════╝"
echo -e "\033[0m"
echo ""
echo "📱 Otwórz w przeglądarce:"
echo ""
echo "   🌐 Formularz zamówień:"
echo "      http://localhost:3000"
echo ""
echo "   📊 Panel zamówień:"
echo "      http://localhost:3006"
echo ""
echo "   👨‍🍳 Panel kuchni:"
echo "      http://localhost:3006/kuchnia"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Aby zatrzymać aplikację:"
echo "   Uruchom plik: STOP-PIZZERIA.sh"
echo ""
echo "⚠️  NIE ZAMYKAJ tego okna!"
echo "   Aplikacja działa dopóki okno jest otwarte"
echo ""
echo "Naciśnij ENTER aby zamknąć (aplikacja będzie działać w tle)..."
read

echo "✅ Okno zamknięte. Aplikacja działa w tle."
