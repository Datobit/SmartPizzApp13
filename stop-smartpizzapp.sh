#!/bin/bash

echo "======================================"
echo "   SmartPizzApp13 - STOP"
echo "======================================"
echo ""

echo "🛑 Zatrzymuję aplikacje..."

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
echo "======================================"
echo "✅ Wszystkie aplikacje zatrzymane"
echo "======================================"
