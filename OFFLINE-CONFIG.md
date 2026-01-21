# 🔧 Konfiguracja Offline - Aplikacja Działa Bez Internetu

## ⚠️ WAŻNE - Problem z DNS

**Problem**: Przeglądarka nie może rozwiązać "localhost" gdy brak internetu, ponieważ system próbuje użyć zewnętrznych serwerów DNS (9.9.9.9, 1.1.1.1, 8.8.8.8).

**Rozwiązanie**: Użyj adresu IP `127.0.0.1` zamiast `localhost`

## 🚀 Jak uruchomić aplikację OFFLINE

### Metoda 1: Automatyczny skrypt (ZALECANE)
```bash
./START-OFFLINE.sh
```
Ten skrypt automatycznie:
- Sprawdza i uruchamia MariaDB
- Uruchamia Next.js
- Otwiera przeglądarkę z prawidłowym adresem IP

### Metoda 2: Ręcznie
```bash
# 1. Uruchom serwer
npm run dev

# 2. Otwórz przeglądarkę i wpisz:
http://127.0.0.1:3000
```

## ⚠️ KRYTYCZNE: Używaj adresu IP

| ❌ NIE DZIAŁA bez internetu | ✅ DZIAŁA bez internetu |
|----------------------------|------------------------|
| http://localhost:3000      | http://127.0.0.1:3000  |

## ✅ Zmiany wprowadzone do działania offline

### 1. **Konfiguracja tRPC i React Query** (`src/utils/api.ts`)
- ✅ Usunięto sprawdzanie `VERCEL_URL` (zewnętrznego URL)
- ✅ Wymuszone używanie tylko `localhost` w trybie SSR
- ✅ Dodano konfigurację React Query z optymalizacją dla lokalnej sieci:
  - Krótsze czasy retry (2 próby zamiast domyślnych 3)
  - Cache na dłużej (60 minut)
  - Wyłączone automatyczne refetch przy focus/reconnect
  - Timeout 10 sekund dla lokalnych połączeń

### 2. **Next.js Config** (`next.config.js`)
- ✅ Konfiguracja webpack z wyłączonymi zewnętrznymi połączeniami
- ✅ Fallback dla `fs`, `net`, `tls`, `dns` w przeglądarce
- ✅ Telemetria Next.js wyłączona

### 3. **Zmienne środowiskowe** (`.env.local`)
```bash
NEXT_TELEMETRY_DISABLED=1
VERCEL_URL=
```

### 4. **NPM Config** (`.npmrc`)
```bash
audit=false
fund=false
update-notifier=false
prefer-offline=true
```

### 5. **Skrypt startowy** (`START-OFFLINE.sh`)
- ✅ Automatyczne uruchamianie z adresem IP
- ✅ Sprawdzanie statusu MariaDB
- ✅ Otwieranie przeglądarki z prawidłowym adresem

## 📊 Status

- ✅ **Baza danych**: MariaDB działa lokalnie (127.0.0.1:3306)
- ✅ **API**: tRPC działa lokalnie (127.0.0.1:3000/api/trpc)
- ✅ **Frontend**: Next.js serwuje stronę lokalnie
- ✅ **Konfiguracja offline**: Wszystkie zewnętrzne połączenia wyłączone
- ✅ **DNS**: Używa adresu IP zamiast nazwy domenowej

## 🔍 Testowanie

1. **Sprawdź status bazy danych:**
```bash
systemctl status mariadb
```

2. **Test API (używaj IP!):**
```bash
curl http://127.0.0.1:3000/api/trpc/pizza.getAllPizzas
```

3. **Otwórz aplikację w przeglądarce:**
```
http://127.0.0.1:3000
```

## 💡 Dlaczego nie działało?

1. **Problem DNS**: Przeglądarka próbowała rozwiązać "localhost" przez zewnętrzne serwery DNS
2. System DNS wymaga internetu do rozwiązania nawet lokalnych nazw
3. Gdy DNS nie odpowiada, przeglądarka uznaje że serwer nie istnieje

## ✅ Rozwiązanie

Używaj **adresu IP 127.0.0.1** zamiast "localhost". Adres IP nie wymaga DNS i działa zawsze, nawet bez internetu.

## 🛠️ Dodatkowe rozwiązanie (opcjonalne)

Jeśli chcesz używać "localhost", możesz wyłączyć systemd-resolved i użyć prostego /etc/hosts:

```bash
# NIE ZALECANE - może wpłynąć na inne aplikacje
sudo systemctl disable systemd-resolved
sudo systemctl stop systemd-resolved
```

**Lepiej użyj po prostu 127.0.0.1!**

---

**Data naprawy**: 2026-01-14  
**Status**: ✅ Działa bez internetu (używając 127.0.0.1)
