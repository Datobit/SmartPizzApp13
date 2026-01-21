#!/bin/bash

# Skrypt do uruchamiania aplikacji PizzApp13 w trybie OFFLINE
# Używa adresu IP zamiast localhost aby działać bez internetu

echo "=============================================="
echo "  ____  _            _                _ _____ "
echo " |  _ \(_)________  / \   _ __  _ __ / |___ / "
echo " | |_) | |_  /_  / / _ \ | '_ \| '_ \| | |_ \ "
echo " |  __/| |/ / / / / ___ \| |_) | |_) | |___) |"
echo " |_|   |_/___/___/_/   \_\ .__/| .__/|_|____/ "
echo "                         |_|   |_|            "
echo "=============================================="

# Sprawdź czy MariaDB działa
echo "1. Sprawdzanie MariaDB..."
if systemctl is-active --quiet mariadb; then
    echo "   ✓ MariaDB działa"
else
    echo "   ✗ MariaDB nie działa!"
    echo "   Uruchamiam MariaDB..."
    sudo systemctl start mariadb
    sleep 2
fi

# Przejdź do katalogu aplikacji
cd "$(dirname "$0")"

# Zatrzymaj stary proces jeśli działa
echo ""
echo "2. Zatrzymywanie starych procesów..."
pkill -f "next dev" 2>/dev/null
pkill -f "orders-viewer.cjs" 2>/dev/null
sleep 1

# Uruchom orders-viewer.cjs w tle (port 3006)
echo ""
echo "3. Uruchamianie orders-viewer (sesje i statystyki)..."
node orders-viewer.cjs > /tmp/pizzapp-orders.log 2>&1 &
ORDERS_PID=$!
sleep 2

if curl -s http://127.0.0.1:3006/ > /dev/null 2>&1; then
    echo "   ✓ Orders-viewer gotowy (port 3006)"
else
    echo "   ⚠ Orders-viewer może nie działać - sprawdź logi: /tmp/pizzapp-orders.log"
fi

# Uruchom Next.js w tle
echo ""
echo "4. Uruchamianie serwera Next.js..."
NEXT_TELEMETRY_DISABLED=1 npm run dev > /tmp/pizzapp-next.log 2>&1 &
NEXT_PID=$!

# Czekaj aż serwer będzie gotowy
echo "   Czekam na uruchomienie serwera..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:3000/ > /dev/null 2>&1; then
        echo "   ✓ Serwer gotowy!"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# Wyświetl informacje
echo ""
echo "======================================"
echo "  ✓ Aplikacja działa!"
echo "======================================"
echo ""
echo "Dostępne adresy:"
echo ""
echo "  Główna aplikacja:"
echo "    http://127.0.0.1:3000"
echo ""
echo "  Sesje kierowców:"
echo "    http://127.0.0.1:3006/sesja"
echo ""
echo "  Statystyki klientów:"
echo "    http://127.0.0.1:3006/customer-dashboard"
echo ""
echo "WAŻNE: Bez internetu używaj IP: 127.0.0.1"
echo ""
echo "Aby zatrzymać serwery:"
echo "  ./STOP-PIZZERIA.sh"
echo ""
echo "Logi:"
echo "  Next.js: tail -f /tmp/pizzapp-next.log"
echo "  Orders:  tail -f /tmp/pizzapp-orders.log"
echo ""

# Automatycznie otwórz przeglądarkę z adresem IP
if command -v xdg-open > /dev/null; then
    echo "Otwieram przeglądarkę..."
    sleep 2
    xdg-open "http://127.0.0.1:3000" 2>/dev/null &
fi

# Pozostaw terminal otwarty
echo "Naciśnij Ctrl+C aby zatrzymać monitoring logów..."
tail -f /tmp/pizzapp-next.log
