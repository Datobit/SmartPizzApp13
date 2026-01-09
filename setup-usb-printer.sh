#!/bin/bash

echo ""
echo "   KONFIGURACJA STAŁYCH UPRAWNIEŃ DO DRUKARKI USB          "
echo ""
echo ""

# Sprawdź czy drukarka jest podłączona
if [ ! -e /dev/usb/lp0 ]; then
    echo "[X] Drukarka nie jest podłączona (/dev/usb/lp0 nie istnieje)"
    echo ""
    echo "[TIP] Podłącz drukarkę i uruchom ponownie ten skrypt"
    exit 1
fi

echo "[OK] Drukarka znaleziona: /dev/usb/lp0"
echo ""

# Sprawdź aktualne uprawnienia
echo "[LISTA] Aktualne uprawnienia:"
ls -l /dev/usb/lp0
echo ""

# Sprawdź czy użytkownik jest w grupie lp
if ! groups | grep -q "\blp\b"; then
    echo "[TIP] Dodaję użytkownika do grupy 'lp' (wymagane dla drukarek)..."
    sudo usermod -a -G lp $USER
    
    if [ $? -eq 0 ]; then
        echo "[OK] Dodano do grupy lp"
        echo "[!]  WAŻNE: Wyloguj się i zaloguj ponownie aby zmiany weszły w życie!"
    else
        echo "[X] Błąd podczas dodawania do grupy"
    fi
else
    echo "[OK] Jesteś już w grupie 'lp'"
fi
echo ""

# Utwórz regułę udev dla trwałych uprawnień
echo "[TIP] Tworzę regułę udev dla trwałych uprawnień..."

UDEV_RULE='# Xprinter USB - automatyczne uprawnienia
SUBSYSTEM=="usb", ATTRS{idVendor}=="0483", ATTRS{idProduct}=="070b", MODE="0666", GROUP="lp"
KERNEL=="lp[0-9]*", MODE="0666", GROUP="lp"'

UDEV_FILE="/etc/udev/rules.d/99-xprinter.rules"

echo "$UDEV_RULE" | sudo tee $UDEV_FILE > /dev/null

if [ $? -eq 0 ]; then
    echo "[OK] Utworzono: $UDEV_FILE"
    echo ""
    echo "[LISTA] Zawartość reguły:"
    cat $UDEV_FILE
    echo ""
    
    # Przeładuj reguły udev
    echo "[RELOAD] Przeładowuję reguły udev..."
    sudo udevadm control --reload-rules
    sudo udevadm trigger
    
    echo "[OK] Reguły przeładowane!"
    echo ""
    echo "[TIP] Od teraz drukarka będzie automatycznie miała odpowiednie uprawnienia"
    echo "   po każdym podłączeniu i po każdym restarcie systemu."
else
    echo "[X] Błąd podczas tworzenia reguły udev"
    echo ""
    echo "[TIP] Możesz ręcznie ustawić uprawnienia przy każdym uruchomieniu:"
    echo "   sudo chmod 666 /dev/usb/lp0"
fi

echo ""
echo ""
echo "   KONFIGURACJA ZAKOŃCZONA                                  "
echo ""
echo ""
echo "[TEST] Przetestuj drukarkę:"
echo "   node test-usb-printer.cjs"
echo ""
echo "[START] Uruchom serwer zamówień:"
echo "   node orders-viewer.cjs"
echo ""
