# DCS Radar - Stav projektu a Předávací protokol (Session Handoff)

Tento dokument slouží pro okamžité navázání práce s AI asistentem Antigravity (nebo vývojářem) na libovolném dalším počítači. Obsahuje přesný stav codebase, vyřešené problémy, konfiguraci a doporučené další kroky.

Poslední aktualizace: **23. října 2026**  
Stav: **Všechny jednotky (33), 24 kruhů dosahu PVO/AAA, filtry, 2D a 3D zobrazení plně funkční a otestované v browseru (0 chyb)**  
Docker kontejner: **`dcs-radar` běží na `http://localhost:8080` (rebuilt & healthy)**

---

## 1. Vyřešené problémy v této relaci

1. **Oprava nezobrazování jednotek ve 2D i 3D (Vite Web Worker & Browser Cache & Cesium Shader Crash):**
   - **Příčina A (MapLibre Worker):** MapLibre GL v6 vyžaduje explicitní web worker bundle. Při produkčním buildu ve Vite házel MapLibre výjimku `Error: Worker failed to load. Check that the worker URL is correct.` V [web/src/main.tsx](file:///C:/_dev/gemini/dcs-radar/web/src/main.tsx) nakonfigurován worker URL pomocí Vite parametru `?worker&url`:
     ```ts
     import * as maplibregl from 'maplibre-gl';
     import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
     maplibregl.setWorkerUrl(maplibreWorkerUrl);
     ```
   - **Příčina B (Browser Disk Cache):** Go server dříve posílal `index.html` bez no-cache hlaviček, takže prohlížeč načítal starý hash bundle z diskové mezipaměti. V [server/api/server.go](file:///C:/_dev/gemini/dcs-radar/server/api/server.go) přidáno:
     ```go
     w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
     ```
   - **Příčina C (Pád Cesium WebGL Fragment Shaderu):** Cesium ve výchozím stavu kompilovalo sluneční glow shader (`addBurst` v `globe.enableLighting = true`), který na některých GPU a WebGL vrstvách selhával s chybou `RuntimeError: Fragment shader failed to compile` a trvale zastavil renderovací smyčku (`An error occurred while rendering. Rendering has stopped`). Vypnutím atmosférické sluneční záře (`skyAtmosphere: false`, `sun.show = false`, `enableLighting = false`) se tento nestabilní shader nekompiluje a Cesium běží 100% stabilně.
   - **Příčina D (Kamera ve 3D a zanoření jednotek):** Výchozí sklon kamery ve 3D byl nastaven na pitch -35° s výškou z orbity, což z Kavkazu mířilo 1500 km na sever k Moskvě. Zároveň chyběl parametr `disableDepthTestDistance: Number.POSITIVE_INFINITY`, takže lodě a pozemní jednotky na nulové nadmořské výšce byly skryty pod 3D povrchem elipsoidu. Upraven sklon na taktických -75° přímo nad Kavkaz a nastaveno `disableDepthTestDistance: Number.POSITIVE_INFINITY` na body i štítky.

2. **Kompletní přepracování 2D taktického zobrazení (DOM Markery + Kruhy dosahu PVO/AAA):**
   - **Jednotky jako interaktivní taktické SVG DOM Markery:**
     - Každá jednotka má taktickou SVG siluetu podle kategorie (stíhací letoun, vrtulník, válečná loď, pozemní technika/PVO, navigační bod, raketa/střela).
     - Letouny a lodě se dynamicky natáčejí ve směru kurzu (`heading`).
     - Barevné odlišení koalic: Modrá `#38bdf8`, Červená `#f87171`, Neutrální `#4ade80`, Zbraně `#fbbf24`.
     - Taktické zvýraznění vybraného cíle (cyan box) a referenčního bodu (zlatý kruh).
     - Taktický štítek s názvem, výškou a rychlostí pod každou jednotkou.
     - Kliknutím na jednotku se ihned otevře detailní telemetrický panel.
   - **Kruhy dosahu PVO/AAA (SAM Threat Rings):**
     - Databáze [web/src/utils/samDatabase.ts](file:///C:/_dev/gemini/dcs-radar/web/src/utils/samDatabase.ts) rozšířena o 14 chybějících systémů včetně kanónové PVO (M163 Vulcan, ZU-23, Shilka, Gepard), námořních PVO systémů (Ticonderoga SM-2, Moskva SA-N-6, Perry SM-1, Neustrashimy SA-N-9, Nimitz Sea Sparrow, Kuznetsov) i radarů včasné výstrahy (55G6 Nebo, AN/FPS-117).
     - Každý systém má na mapě vykreslen poloprůhledný polygon s čárkovaným obvodem a na severním okraji kruhu taktický štítek s názvem a dosahem v NM (např. `MIM-23 HAWK • 24 NM`, `Vulcan (AAA) • 1.35 NM`).
     - Ve 3D Cesium glóbu přidány odpovídající 3D cylindry ohrožení.
   - **Taktické měření BRAA:**
     - Propojení referenčního a vybraného objektu žlutou čárkovanou linií s HUD odpočtem uprostřed spojnice: `BRAA: Bearing° / Range NM / Alt ft • Aspect`.
   - **Ověření filtrů:**
     - Filtry koalic a kategorií reagují okamžitě (např. vypnutí pozemních sil ihned sníží počet markerů z 33 na 14 námořních a navigačních jednotek).

3. **Odstranění falešné detekce pozastavené mise (`paused`):**
   - V [server/telemetry/tcp_source.go](file:///C:/_dev/gemini/dcs-radar/server/telemetry/tcp_source.go) a [server/api/rest.go](file:///C:/_dev/gemini/dcs-radar/server/api/rest.go):
     - Pokud ze socketu Tacview přicházejí data (`timeSinceRecv <= 15s`), stav je VŽDY `connected` a nikdy se nehlásí `paused`.
     - Stav `paused` se aktivuje výhradně tehdy, pokud je socket Tacview neaktivní po dobu >15 s A ZÁROVEŇ DCS-gRPC potvrdí, že se čas mise zastavil na více než 35 s.

4. **Kavkazské souřadnice (`ReferenceLongitude` & `ReferenceLatitude`):**
   - Vyřešena chyba umístění jednotek v Africe. Souřadnice jsou nyní přesně v Černém moři a na Kavkazu (37.3° – 45.0° E, 41.5° – 45.1° N).

5. **Automatické ověření přes Chrome DevTools Protocol (CDP Headless Edge):**
   - Vizuálně zachyceny a zkontrolovány snímky obrazovky:
     - `final_2d.png`: 33 jednotek, 24 SAM odznaků s kruhy dosahu, lodě a radary na Kavkazu.
     - `final_3d.png`: 3D Cesium glóbus centrovaný nad Kavkazem se zářícími body jednotek, štítky a 3D cylindry dosahu PVO.
     - Zaznamenaných konzolových chyb: **0**.

---

## 2. Architektura projektu

```
dcs-radar/
├── config.yaml                     # Konfigurace serveru (host.docker.internal, porty, mapy)
├── docker-compose.yml              # Produkční orchestrace kontejneru
├── Dockerfile                      # Multi-stage build (Node.js 22 + Go 1.26 + Alpine)
├── GEMINI.md                       # Automatická instrukce pro Antigravity AI
├── SESSION_STATE.md                # TENTO SOUBOR - stav předání
├── server/                         # Backend v jazyce Go (Go 1.26)
│   ├── main.go                     # Vstupní bod, inicializace služeb
│   ├── config/                     # Načítání a validace config.yaml
│   ├── models/                     # Datové struktury (Object, Transform, Event)
│   ├── telemetry/                  # Klienti Tacview TCP (RTT) a DCS-gRPC
│   ├── acmi/                       # Parser ACMI textového streamu a transformace
│   ├── state/                      # Paměťový správce stavu jednotek v reálném čase
│   ├── history/                    # Retence a SQLite úložiště
│   └── api/                        # REST API a WebSocket server (/ws, /api/*)
└── web/                            # Frontend (React 19 + TypeScript + Vite)
    └── src/
        ├── components/
        │   ├── Common/ErrorBoundary.tsx    # Ochrana proti pádu aplikace
        │   ├── Map/TacticalMap2D.tsx       # 2D mapa (MapLibre GL + DOM Markers + SAM rings)
        │   ├── Globe3D/TacticalGlobe3D.tsx # 3D glóbus (Cesium 1.146 + 3D SAM cylinders)
        │   ├── FilterPanel/FilterPanel.tsx # Panel taktických filtrů
        │   └── Header/SystemBar.tsx        # Horní stavová lišta
        └── context/RadarContext.tsx        # Globální stav a WebSocket klient
```
