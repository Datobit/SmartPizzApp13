#!/bin/bash

# Skrypt do zatrzymywania aplikacji PizzApp13

echo "=============================================="
echo "  ____  _            _                _ _____ "
echo " |  _ \(_)________  / \   _ __  _ __ / |___ / "
echo " | |_) | |_  /_  / / _ \ | '_ \| '_ \| | |_ \ "
echo " |  __/| |/ / / / / ___ \| |_) | |_) | |___) |"
echo " |_|   |_/___/___/_/   \_\ .__/| .__/|_|____/ "
echo "                         |_|   |_|            "
echo "=============================================="
echo ""

# Zatrzymaj Next.js
echo "1. Zatrzymywanie serwera Next.js..."
if pkill -f "next dev" 2>/dev/null; then
    echo "   ✓ Next.js zatrzymany"
else
    echo "   ⚠ Next.js nie był uruchomiony"
fi

# Zatrzymaj orders-viewer
echo ""
echo "2. Zatrzymywanie orders-viewer..."
if pkill -f "orders-viewer.cjs" 2>/dev/null; then
    echo "   ✓ Orders-viewer zatrzymany"
else
    echo "   ⚠ Orders-viewer nie był uruchomiony"
fi

# Poczekaj na zakończenie procesów
sleep 1

# Sprawdź czy wszystko zatrzymane
echo ""
echo "3. Sprawdzanie procesów..."
NEXT_RUNNING=$(pgrep -f "next dev" | wc -l)
ORDERS_RUNNING=$(pgrep -f "orders-viewer.cjs" | wc -l)

if [ "$NEXT_RUNNING" -eq 0 ] && [ "$ORDERS_RUNNING" -eq 0 ]; then
    echo "   ✓ Wszystkie procesy zatrzymane"
else
    echo "   ⚠ Niektóre procesy nadal działają:"
    if [ "$NEXT_RUNNING" -gt 0 ]; then
        echo "     - Next.js: $NEXT_RUNNING proces(ów)"
    fi
    if [ "$ORDERS_RUNNING" -gt 0 ]; then
        echo "     - Orders-viewer: $ORDERS_RUNNING proces(ów)"
    fi
    echo ""
    echo "   Wymuś zatrzymanie komendą:"
    echo "   pkill -9 -f 'next dev'"
    echo "   pkill -9 -f 'orders-viewer.cjs'"
fi

echo ""
echo "======================================"
echo "  ✓ PizzApp13 zatrzymany!"
echo "======================================"
echo ""
echo "MariaDB pozostaje włączone."
echo "Aby uruchomić ponownie: ./START-OFFLINE.sh"
echo ""
