#!/bin/bash

# Kolorowy nagłówek
echo -e "\033[1;31m"
echo "╔════════════════════════════════════╗"
echo "║    🛑 PIZZERIA - STOP 🛑          ║"
echo "╚════════════════════════════════════╝"
echo -e "\033[0m"
echo ""

echo "🛑 Zatrzymuję aplikacje..."
echo ""

# Zatrzymaj Next.js
pkill -f "next start" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Formularz zamówień zatrzymany"
else
    echo "ℹ️  Formularz zamówień nie był uruchomiony"
fi

# Zatrzymaj orders-viewer
pkill -f "orders-viewer" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Panel zamówień zatrzymany"
else
    echo "ℹ️  Panel zamówień nie był uruchomiony"
fi

sleep 1

echo ""
echo -e "\033[1;32m"
echo "╔════════════════════════════════════╗"
echo "║   ✅ PIZZERIA ZATRZYMANA! ✅       ║"
echo "╚════════════════════════════════════╝"
echo -e "\033[0m"
echo ""
echo "💡 Aby uruchomić ponownie:"
echo "   Uruchom plik: START-PIZZERIA.sh"
echo ""
echo "Naciśnij ENTER aby zamknąć..."
read
