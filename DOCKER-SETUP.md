# 🐳 Uruchomienie SmartPizzApp w Docker na OmArchy 3.2.2

## Wymagania
- Docker Engine
- Docker Compose
- LazyDocker (opcjonalne, dla łatwego zarządzania)

## Instalacja Docker na OmArchy (Arch Linux)

```bash
# Zainstaluj Docker
sudo pacman -S docker docker-compose

# Uruchom serwis Docker
sudo systemctl start docker
sudo systemctl enable docker

# Dodaj użytkownika do grupy docker
sudo usermod -aG docker $USER
# Wyloguj się i zaloguj ponownie żeby zmiany weszły w życie

# Zainstaluj LazyDocker
yay -S lazydocker
# lub
sudo pacman -S lazydocker
```

## Uruchomienie aplikacji

### Opcja 1: Tylko baza danych (development lokalny)
Jeśli chcesz kodować lokalnie, ale używać bazy z Dockera:

```bash
# Uruchom tylko MariaDB
docker-compose -f docker-compose.dev.yml up -d

# Zaktualizuj plik .env
echo 'DATABASE_URL="mysql://smartpizza:pizzapass123@localhost:3307/SmartPizzApp13"' > .env

# Uruchom migracje Prisma
npx prisma migrate deploy

# Wgraj dane (jeśli potrzebujesz)
node update-ulice-from-csv.mjs

# Uruchom aplikację lokalnie
npm run dev
```

### Opcja 2: Pełna aplikacja w Docker (production)

```bash
# Zbuduj i uruchom wszystko
docker-compose up --build -d

# Sprawdź status
docker-compose ps

# Zobacz logi
docker-compose logs -f app
```

### Opcja 3: Z LazyDocker

```bash
# Uruchom kontenery
docker-compose up -d

# Otwórz LazyDocker w terminalu
lazydocker

# W LazyDocker możesz:
# - [1-9] przełączać się między widokami
# - [x] sprawdzić logi kontenerów
# - [d] zatrzymać/usunąć kontenery
# - [r] zrestartować kontenery
# - [e] wykonać shell w kontenerze
# - [m] sprawdzić metryki (CPU, RAM)
```

## Zarządzanie

### Zatrzymanie aplikacji
```bash
docker-compose down
```

### Zatrzymanie + usunięcie volumes (UWAGA: usuwa dane!)
```bash
docker-compose down -v
```

### Przebudowanie po zmianach w kodzie
```bash
docker-compose up --build -d
```

### Wykonanie migracji Prisma w kontenerze
```bash
docker-compose exec app npx prisma migrate deploy
```

### Shell w kontenerze aplikacji
```bash
docker-compose exec app sh
```

### Shell w kontenerze bazy danych
```bash
docker-compose exec mariadb mysql -u smartpizza -p SmartPizzApp13
# Hasło: pizzapass123
```

### Zobacz logi konkretnego serwisu
```bash
docker-compose logs -f app       # Aplikacja
docker-compose logs -f mariadb   # Baza danych
```

## Import istniejącej bazy danych

Jeśli masz już istniejącą bazę danych (.sql dump):

```bash
# Skopiuj dump do kontenera
docker cp smartpizzapp13-dump.sql smartpizza-mariadb:/tmp/

# Zaimportuj
docker-compose exec mariadb mysql -u smartpizza -p SmartPizzApp13 < /tmp/smartpizzapp13-dump.sql

# Lub bezpośrednio z hosta
docker-compose exec -T mariadb mysql -u smartpizza -p SmartPizzApp13 < smartpizzapp13-dump.sql
```

## LazyDocker - Skróty klawiszowe

- `h/j/k/l` lub strzałki - nawigacja
- `[` / `]` - poprzedni/następny panel
- `x` - pokazuje menu akcji dla wybranego elementu
- `d` - usuń wybrany element
- `e` - hide/show empty elements
- `g` - top / `G` - bottom
- `s` - zatrzymaj kontener
- `r` - restart kontener
- `m` - pokaż metryki
- `]` - następny widok główny
- `[` - poprzedni widok główny
- `ESC` - powrót do głównego widoku
- `q` - wyjście z LazyDocker

## Porty

- **3000** - Aplikacja Next.js
- **3306** - MariaDB (production)
- **3307** - MariaDB (development)

## Zmienne środowiskowe

Edytuj `docker-compose.yml` aby zmienić:
- Hasła bazy danych
- Nazwa bazy danych
- Inne zmienne środowiskowe

## Troubleshooting

### Port 3306 już zajęty
```bash
# Zatrzymaj lokalną MariaDB
sudo systemctl stop mariadb

# Lub zmień port w docker-compose.yml:
ports:
  - "3307:3306"
```

### Brak połączenia z bazą danych
```bash
# Sprawdź czy kontener działa
docker-compose ps

# Sprawdź logi
docker-compose logs mariadb

# Sprawdź health check
docker inspect smartpizza-mariadb | grep Health
```

### Błędy Prisma
```bash
# Wejdź do kontenera
docker-compose exec app sh

# Sprawdź czy Prisma Client jest wygenerowany
ls -la node_modules/.prisma

# Wygeneruj ponownie
npx prisma generate

# Uruchom migracje
npx prisma migrate deploy
```

### Aplikacja nie startuje
```bash
# Zobacz dokładne logi
docker-compose logs -f app

# Sprawdź czy build przeszedł
docker-compose build app

# Sprawdź czy baza jest ready
docker-compose logs mariadb | grep "ready for connections"
```

## Backup bazy danych

```bash
# Stwórz backup
docker-compose exec mariadb mysqldump -u smartpizza -p SmartPizzApp13 > backup-$(date +%Y%m%d-%H%M%S).sql

# Przywróć z backupu
docker-compose exec -T mariadb mysql -u smartpizza -p SmartPizzApp13 < backup-20260102-123456.sql
```

## Monitoring w LazyDocker

1. Uruchom `lazydocker`
2. Przejdź do widoku "Stats" (przycisk `3`)
3. Zobacz użycie CPU, RAM, sieci dla każdego kontenera
4. Przejdź do widoku "Logs" (przycisk `2`) aby zobaczyć logi w czasie rzeczywistym
5. Użyj `/` aby wyszukać w logach
