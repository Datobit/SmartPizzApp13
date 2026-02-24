#!/bin/bash

# Script do konfiguracji automatycznego miesięcznego backupu bazy danych
# Backup będzie wykonywany 1-go dnia każdego miesiąca o 2:00 w nocy

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   KONFIGURACJA AUTOMATYCZNEGO BACKUPU PIZZAPP13           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Pobierz ścieżkę do projektu (katalog, w którym znajduje się ten skrypt)
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_SCRIPT="$PROJECT_DIR/backup-automatyczny.mjs"

echo "📁 Katalog projektu: $PROJECT_DIR"
echo "📄 Skrypt backupu: $BACKUP_SCRIPT"
echo ""

# Sprawdź czy skrypt backupu istnieje
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "❌ Błąd: Nie znaleziono pliku backup-automatyczny.mjs"
    exit 1
fi

# Sprawdź czy node jest zainstalowane
if ! command -v node &> /dev/null; then
    echo "❌ Błąd: Node.js nie jest zainstalowany"
    exit 1
fi

echo "✅ Node.js znaleziony: $(node --version)"
echo ""

# Utwórz wpis cron
# Każdego 1-go dnia miesiąca o 12:00 (w południe, gdy komputer na pewno działa)
CRON_COMMAND="0 12 1 * * cd $PROJECT_DIR && /usr/bin/node $BACKUP_SCRIPT >> $PROJECT_DIR/backup-cron.log 2>&1"

echo "📅 Backup będzie wykonywany: 1-go dnia każdego miesiąca o 12:00"
echo ""
echo "Wpis cron do dodania:"
echo "────────────────────────────────────────────────────────────"
echo "$CRON_COMMAND"
echo "────────────────────────────────────────────────────────────"
echo ""

# Sprawdź czy cron już istnieje
if crontab -l 2>/dev/null | grep -q "backup-automatyczny.mjs"; then
    echo "⚠️  Wykryto istniejący wpis cron dla backupu"
    read -p "Czy chcesz go zastąpić? (t/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Tt]$ ]]; then
        echo "Anulowano."
        exit 0
    fi
    # Usuń stary wpis
    crontab -l 2>/dev/null | grep -v "backup-automatyczny.mjs" | crontab -
fi

# Dodaj nowy wpis do crontab
(crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -

if [ $? -eq 0 ]; then
    echo "✅ Automatyczny backup został skonfigurowany pomyślnie!"
    echo ""
    echo "📋 Aktualne zadania cron:"
    echo "────────────────────────────────────────────────────────────"
    crontab -l | grep backup
    echo "────────────────────────────────────────────────────────────"
    echo ""
    echo "🔍 Logi backupu będą zapisywane w: $PROJECT_DIR/backup-cron.log"
    echo ""
    echo "💡 Przydatne komendy:"
    echo "   - Zobacz wszystkie zadania cron: crontab -l"
    echo "   - Edytuj zadania cron: crontab -e"
    echo "   - Usuń wszystkie zadania cron: crontab -r"
    echo "   - Zobacz logi backupu: cat $PROJECT_DIR/backup-cron.log"
    echo "   - Testuj backup ręcznie: node $BACKUP_SCRIPT"
    echo ""
else
    echo "❌ Błąd podczas konfiguracji cron"
    exit 1
fi

# Test backupu (opcjonalnie)
read -p "Czy chcesz przetestować backup teraz? (t/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Tt]$ ]]; then
    echo ""
    echo "🧪 Uruchamianie testowego backupu..."
    echo "════════════════════════════════════════════════════════════"
    node "$BACKUP_SCRIPT"
    echo "════════════════════════════════════════════════════════════"
fi

echo ""
echo "✨ Konfiguracja zakończona!"
