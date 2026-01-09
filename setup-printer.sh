#!/bin/bash

echo ""
echo "   KONFIGURACJA UPRAWNIEŃ DO PORTU SZEREGOWEGO              "
echo ""
echo ""

# Sprawdź aktualne grupy
echo "[LISTA] Twoje aktualne grupy:"
groups
echo ""

# Wykryj nazwę grupy dla portów szeregowych (dialout lub uucp)
SERIAL_GROUP=""
if [ -e /dev/ttyS0 ]; then
    SERIAL_GROUP=$(stat -c '%G' /dev/ttyS0 2>/dev/null)
fi

if [ -z "$SERIAL_GROUP" ]; then
    # Próbuj najpierw dialout, potem uucp
    if getent group dialout > /dev/null 2>&1; then
        SERIAL_GROUP="dialout"
    elif getent group uucp > /dev/null 2>&1; then
        SERIAL_GROUP="uucp"
    fi
fi

if [ -z "$SERIAL_GROUP" ]; then
    echo "[X] Nie można znaleźć grupy dla portów szeregowych"
    echo "   Sprawdź ręcznie: ls -l /dev/ttyS0"
    exit 1
fi

echo "[SZUKAM] Wykryto grupę portów szeregowych: $SERIAL_GROUP"
echo ""

# Sprawdź czy użytkownik jest w grupie
if groups | grep -q "\b$SERIAL_GROUP\b"; then
    echo "[OK] Jesteś już w grupie '$SERIAL_GROUP'"
    echo ""
    echo "Sprawdzam dostępne porty szeregowe..."
    echo ""
    ls -l /dev/ttyS0 /dev/ttyUSB0 2>/dev/null || echo "[!]  Porty ttyS0 lub ttyUSB0 nie zostały znalezione"
    echo ""
    echo "Dostępne porty ttyS*:"
    ls -l /dev/ttyS* 2>/dev/null | head -5
else
    echo "[X] NIE jesteś w grupie '$SERIAL_GROUP'"
    echo ""
    echo "Aby uzyskać dostęp do portu szeregowego, wykonaj:"
    echo ""
    echo "  sudo usermod -a -G $SERIAL_GROUP $USER"
    echo ""
    echo "Następnie WYLOGUJ SIĘ i zaloguj ponownie (lub zrestartuj komputer)"
    echo ""
    echo "Czy chcesz dodać się do grupy $SERIAL_GROUP teraz? (t/n)"
    read -r response
    
    if [[ "$response" =~ ^([tT][aA][kK]|[tT])$ ]]; then
        echo ""
        echo "Dodaję użytkownika $USER do grupy $SERIAL_GROUP..."
        sudo usermod -a -G $SERIAL_GROUP $USER
        
        if [ $? -eq 0 ]; then
            echo "[OK] Pomyślnie dodano!"
            echo ""
            echo "[!]  WAŻNE: Musisz się WYLOGOWAĆ i zalogować ponownie"
            echo "   lub zrestartować komputer, aby zmiany zostały zastosowane."
            echo ""
            echo "Po ponownym zalogowaniu uruchom ponownie ten skrypt aby sprawdzić."
        else
            echo "[X] Błąd. Sprawdź czy masz uprawnienia sudo."
        fi
    else
        echo "Operacja anulowana."
    fi
fi

echo ""
echo ""
echo "   KONFIGURACJA PORTU DRUKARKI                              "
echo ""
echo ""
echo "Sprawdzam dostępne porty szeregowe..."
echo ""

if ls /dev/ttyUSB* 1> /dev/null 2>&1; then
    echo "[OK] Znaleziono porty USB:"
    ls -l /dev/ttyUSB*
    echo ""
    echo "[TIP] Ustaw w pliku .env:"
    echo "   PRINTER_PORT=\"/dev/ttyUSB0\""
elif ls /dev/ttyACM* 1> /dev/null 2>&1; then
    echo "[OK] Znaleziono porty ACM:"
    ls -l /dev/ttyACM*
    echo ""
    echo "[TIP] Ustaw w pliku .env:"
    echo "   PRINTER_PORT=\"/dev/ttyACM0\""
else
    echo "[!]  Nie znaleziono portów USB (ttyUSB*, ttyACM*)"
    echo ""
    echo " Dostępne porty szeregowe (ttyS*):"
    ls -l /dev/ttyS0 /dev/ttyS1 /dev/ttyS2 /dev/ttyS3 2>/dev/null || echo "   Brak"
    echo ""
    echo "[TIP] Jeśli drukarka jest podłączona przez fizyczny port COM, ustaw w .env:"
    echo "   PRINTER_PORT=\"/dev/ttyS0\""
    echo ""
    echo "[TIP] Jeśli drukarka nie jest jeszcze podłączona:"
    echo "   1. Podłącz drukarkę przez USB lub port szeregowy"
    echo "   2. Uruchom ponownie ten skrypt"
fi

echo ""
echo "Aby przetestować drukarkę po konfiguracji, uruchom:"
echo "   node test-printer.cjs"
echo ""
