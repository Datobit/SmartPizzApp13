#!/bin/bash

echo "======================================"
echo "   SmartPizzApp13 - START"
echo "======================================"
echo ""

# Sprawdź czy MariaDB działa
if ! systemctl is-active --quiet mariadb; then
    echo "⚠️  MariaDB nie działa. Uruchamiam..."
    sudo systemctl start mariadb
    sleep 2
fi

# Sprawdź czy Node.js jest zainstalowany
if ! command -v node &> /dev/null; then
    echo "❌ Node.js nie jest zainstalowany!"
    exit 1
fi

# Sprawdź czy aplikacja została zbudowana
if [ ! -d ".next" ]; then
    echo "⚠️  Aplikacja nie została jeszcze zbudowana."
    echo "📦 Buduję aplikację... (to zajmie 1-2 minuty)"
    npm run build
fi

echo "🚀 Uruchamiam aplikacje..."
echo ""

# Zatrzymaj stare procesy jeśli działają
pkill -f "next start" 2>/dev/null
pkill -f "orders-viewer" 2>/dev/null
sleep 1

# Uruchom Next.js app w tle
echo "▶️  Uruchamiam formularz zamówień (port 3000)..."
nohup npm start > /dev/null 2>&1 &
NEXTJS_PID=$!

# Poczekaj aż Next.js się uruchomi
sleep 3

# Uruchom orders-viewer w tle
echo "▶️  Uruchamiam panel zamówień (port 3006)..."
nohup node orders-viewer.cjs > orders-viewer.log 2>&1 &
VIEWER_PID=$!

sleep 2

echo ""
echo "======================================"
echo "✅ Aplikacja uruchomiona!"
echo "======================================"
echo ""
echo "📱 Formularz zamówień:"
echo "   http://localhost:3000"
echo ""
echo "📊 Panel zamówień:"
echo "   http://localhost:3006"
echo ""
echo "👨‍🍳 Panel kuchni:"
echo "   http://localhost:3006/kuchnia"
echo ""
echo "======================================"
echo ""
echo "ℹ️  Logi panelu zamówień: orders-viewer.log"
echo ""
echo "🛑 Aby zatrzymać aplikację:"
echo "   ./stop-smartpizzapp.sh"
echo "   lub naciśnij Ctrl+C w tym terminalu"
echo ""

# Funkcja czyszczenia przy wyjściu
cleanup() {
    echo ""
    echo "🛑 Zatrzymuję aplikację..."
    kill $NEXTJS_PID 2>/dev/null
    kill $VIEWER_PID 2>/dev/null
    pkill -f "next start" 2>/dev/null
    pkill -f "orders-viewer" 2>/dev/null
    echo "✅ Aplikacja zatrzymana"
    exit 0
}

# Przechwytuj Ctrl+C
trap cleanup INT TERM

# Czekaj w tle (aplikacja działa dalej)
echo "⏳ Aplikacja działa w tle. Naciśnij Ctrl+C aby zatrzymać."
wait
