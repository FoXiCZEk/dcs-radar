# DCS Radar - Stav projektu a Předávací protokol (Session Handoff)

Tento dokument slouží pro okamžité navázání práce s AI asistentem Antigravity (nebo vývojářem) na libovolném dalším počítači. Obsahuje přesný stav codebase, vyřešené problémy, konfiguraci a doporučené další kroky.

Poslední aktualizace: **22. října 2026**  
Poslední git commit: `ec39d83` (větev `main`)  
Projektové repo: `https://github.com/FoXiCZEk/dcs-radar.git`

---

## 1. Kde jsme skončili (Poslední stav)

Všechny nahlášené problémy byly úspěšně vyřešeny, zkompilovány do Dockeru a odeslány na GitHub:

1. **Oprava 2D taktické mapy (MapLibre GL):**
   - Jednotky se dříve na 2D mapě nevykreslovaly, protože MapLibre `useRef` nespouštěl reaktivní render a `map.isStyleLoaded()` vracel `false` během stahování mapových dlaždic.
   - Zaveden reaktivní stav `isMapReady`, bezpečné nahrávání dat do `units-source`, `trajectories-source`, `sam-rings-source` a `braa-vector-source`.
   - Přidán automatický auto-fit bojiště (`fitBounds`) po příchodu první telemetrie, aby jednotky v libovolném divadle (Kavkaz, Perský záliv, Sýrie, Nevada, Marianas, Sinai, Falklandy) byly okamžitě viditelné.
   - Přidán fontový endpoint pro MapLibre glyfy (`https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf`).

2. **Okamžité přepínání mapových podkladů (Dark / Satelit / Voyager / OSM):**
   - Vyřešen problém, kdy změna mapového podkladu vyžadovala F5 refresh.
   - Původní blokace přes `map.once('load')` byla odstraněna – vrstvy se nyní přepínají v reálném čase přes `map.setLayoutProperty(id, 'visibility', ...)` a `map.triggerRepaint()`.
   - Stejně tak byla optimalizována výměna vrstev na 3D Cesium glóbu přes `new Cesium.ImageryLayer(provider)`.

3. **Odstranění simulace a reálná DCS diagnostika:**
   - Falešná simulace byla kompletně odstraněna.
   - Pokud DCS neběží nebo je mise pozastavena, zobrazuje se taktický informační pruh se stavem portů:
     - **Tacview RTT port (:42674)**
     - **DCS Herní server port (:10308)**
     - **DCS-gRPC port (:40051)**
   - V případě, že je mise pozastavena (Tacview neposílá data, ale herní port žije), aplikace jasně indikuje stav: *"MISE DCS JE POZASTAVENA (stiskněte klávesu Pause v DCS)"*.

4. **Integrace DCS-gRPC klienta (`server/telemetry/grpc_client.go`):**
   - Využívá oficiální knihovnu `github.com/DCS-gRPC/go-bindings`.
   - Pravidelně dotazuje divadlo operací (theatre), počasí v DCS a aktivní hráče.

5. **Ohrožovací zóny SAM (Threat Rings):**
   - Databáze PVO systémů (`web/src/utils/samDatabase.ts`) pro systémy SA-2, SA-3, SA-6, SA-8, SA-10 (S-300), SA-11 (Buk), SA-15 (Tor), Patriot, Hawk, Roland, NASAMS apod.
   - Vykreslování polygonů dosahu na 2D mapě i 3D glóbu.

6. **Taktické BRAA & Bullseye měření:**
   - Možnost zvolit referenční jednotku (pravý klik / tlačítko) a cílovou jednotku.
   - Výpočet Bearing, Range, Altitude, Aspect (BRAA) a Bullseye koordinátů.

7. **Výstraha odpálení raket (Missile Alert):**
   - Detekce živých střel se zvukovou signalizací (syntetizátor přes Web Audio API).
   - Možnost vypnout výstrahy nebo pouze ztlumit zvuk v panelu filtrů a v horní liště.

---

## 2. Architektura projektu

```
dcs-radar/
├── config.yaml                     # Konfigurace serveru (IP, porty, mapy, retence)
├── docker-compose.yml              # Produkční orchestrace kontejneru
├── Dockerfile                      # Multi-stage build (Node.js 22 + Go 1.26 + Alpine)
├── GEMINI.md                       # Automatická instrukce pro Antigravity AI
├── SESSION_STATE.md                # TENTO SOUBOR - stav předání
├── server/                         # Backend v jazyce Go (Go 1.26)
│   ├── main.go                     # Vstupní bod, inicializace služeb
│   ├── config/                     # Načítání a validace config.yaml
│   ├── models/                     # Datové struktury (ObjectEntity, TelemetryEvent)
│   ├── telemetry/
│   │   ├── tcp_source.go           # Tacview Realtime Telemetry (RTT) TCP klient
│   │   ├── grpc_client.go          # DCS-gRPC klient (theatre, weather, players)
│   │   ├── file_source.go          # Přehrávač ACMI souborů pro testování
│   │   └── source.go               # Rozhraní pro zdroje telemetrie
│   ├── acmi/                       # Parser ACMI textového streamu a transformace
│   ├── state/                      # Paměťový správce stavu jednotek v reálném čase
│   ├── history/                    # Retence a časová osa (SQLite / memory store)
│   └── api/                        # REST API a WebSocket server (/ws, /api/*)
└── web/                            # Frontend (React 19 + TypeScript + Vite)
    ├── src/
    │   ├── components/
    │   │   ├── Map/TacticalMap2D.tsx    # 2D mapa (MapLibre GL)
    │   │   ├── Globe3D/TacticalGlobe3D.tsx # 3D glóbus (Cesium 1.146)
    │   │   ├── Header/SystemBar.tsx     # Horní stavová lišta a přepínače
    │   │   ├── FilterPanel/FilterPanel.tsx # Postranní panel filtrů a vrstev
    │   │   ├── Sidebar/ObjectDetail.tsx # Taktický detail vybrané jednotky
    │   │   ├── Alerts/MissileAlertBanner.tsx # Výstražný pruh odpálení raket
    │   │   ├── Diagnostics/DiagnosticsModal.tsx # Diagnostické okno spojení
    │   │   └── Timeline/TimelineBar.tsx # Přehrávání historie a časová osa
    │   ├── context/RadarContext.tsx     # Globální stav a WebSocket klient
    │   ├── utils/
    │   │   ├── braa.ts                  # Matematické výpočty BRAA a Bullseye
    │   │   ├── samDatabase.ts           # Specifikace SAM dosahů a GeoJSON kruhy
    │   │   └── audioAlert.ts            # Web Audio API syntezátor výstrahy
    │   └── services/                    # REST a WS API komunikace
```

---

## 3. Síťová konfigurace prostředí (DCS)

Aktuálně nastaveno v `config.yaml`:
- **DCS Server Host:** `192.168.0.120`
- **Tacview RTT Port:** `42674` (export telemetrie)
- **DCS Game Port:** `10308` (kontrola dostupnosti serveru)
- **DCS gRPC Port:** `40051` (DCS-gRPC API)
- **Web UI & API Port:** `8080` (HTTP + WebSocket)
- **Carto Basemap API Key:** `cb1_330x_1_ffa23c299bbe502ba07a7c8a`

---

## 4. Jak pokračovat na novém PC

### A. Spuštění přes Docker (doporučeno):
```bash
git clone https://github.com/FoXiCZEk/dcs-radar.git
cd dcs-radar
docker compose up -d --build
```
Aplikace běží na `http://localhost:8080`.

### B. Lokální vývoj bez Dockeru:
1. **Backend (Go 1.24+):**
   ```bash
   cd server
   go run main.go
   ```
2. **Frontend (Node 20+):**
   ```bash
   cd web
   npm install
   npm run dev
   ```

---

## 5. Doporučené další kroky (Backlog nápadů)

1. **Využití gRPC počasí na mapě:**
   - V `server/telemetry/grpc_client.go` se načítá vítr a oblačnost z DCS.
   - Zobrazit v SystemBaru nebo ve vysouvacím widgetu povětrnostní podmínky na bojišti (vítr u země/ve výšce, QNH tlak, teplota).
2. **Stav výzbroje a paliva v detailu jednotky:**
   - Z DCS-gRPC dotazovat stav munice a paliva pro vybraný letoun a zobrazit to v `ObjectDetail.tsx`.
3. **Filtrování koalic v SAM dosazích:**
   - Možnost zobrazit pouze nepřátelské (Red) nebo spojenecké (Blue) SAM zóny.
4. **Hlasové varování (SpeechSynthesis):**
   - Syntéza řeči v prohlížeči (např. *"Warning, missile launch"* nebo *"Bandit BRAA 045 for 20 miles"*).
