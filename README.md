# Schovka 🧭

**Live:** [https://schovka.onrender.com](https://schovka.onrender.com) · **Repo:** [github.com/palcinkoo/schovka](https://github.com/palcinkoo/schovka)

GPS navigácia a záznam trás v prehliadači. Zapneš záznam, ideš sa prejsť/bežať/cykliť,
aplikácia kreslí tvoju trasu na mapu, počíta čas, vzdialenosť, tempo a po zastavení trasu
uloží do histórie. Odtiaľ si ju vieš znova zobraziť alebo exportovať ako **GPX**.

**Stack:** Vite 5 + React 18 + Leaflet (react-leaflet 4) + OpenRouteService (trasy) + Supabase (uložisko).

---

## Funkcie

**Záznam trasy**
- sledovanie polohy cez `watchPosition` s vysokou presnosťou
- živé vykresľovanie trasy na mapu (modrá čiara) + „sleduj ma“ režim
- **Štart / Pauza / Pokračovať / Stop** – čas sa počas pauzy zastaví
- filtrovanie šumu: ignorujú sa body bližšie ako 3 m a body s presnosťou horšou ako 60 m
- živé štatistiky: čas, vzdialenosť, priemerné tempo, rýchlosť, počet bodov, presnosť GPS

**História**
- zoznam uložených trás s dátumom, dĺžkou, časom, tempom a priemernou rýchlosťou
- klik na trasu → zobrazí sa na mape (oranžová čiara + značky štart/cieľ)
- premenovanie, mazanie a **export do GPX** (súbor na stiahnutie, funguje offline)
- súhrn: počet trás, celková vzdialenosť, celkový čas

**Navigácia k cieľu**
- klik na mapu nastaví cieľ 🎯, aplikácia dopočíta trasu
- profily: 🚶 pešo, 🚴 bicykel, 🚗 auto
- zobrazenie vzdialenosti, odhadovaného času a inštrukcií krok za krokom
- bez API kľúča sa použije **priama čiara** a vzdušná vzdialenosť (appka funguje aj offline)

---

## Rýchly štart

```bash
npm install
npm run dev          # http://localhost:5173
```

Bez ďalšieho nastavenia beží aplikácia v **lokálnom režime** – trasy sa ukladajú do
`localStorage` prehliadača a trasy sa počítajú ako priama čiara. Na reálny záznam je potrebný
prehliadač s povolenou geolokáciou (HTTPS alebo `localhost`) a ideálne mobil s GPS.

## Voliteľné napojenia

### 1. OpenRouteService (skutočné trasy po cestách/chodníkoch)

1. Registrácia zdarma: [openrouteservice.org/dev/#/signup](https://openrouteservice.org/dev/#/signup)
2. Vytvor token a skopíruj ho do `.env`:

   ```env
   VITE_ORS_API_KEY=tvoj-ors-kľúč
   ```

Bez kľúča aplikácia padá späť na priamu čiaru – nič sa nerozbije.

> **Kľúč nikdy necommituj.** Patrí len do `.env` (ktoré je v `.gitignore`) alebo do
> environment premenných hostingu. Free tier: 40 požiadaviek/min, 2000/deň – pri prekročení
> aplikácia automaticky zobrazí priamu čiaru s varovaním.
> Inštrukcie ORS sú anglické, aplikácia ich prekladá do slovenčiny v `src/lib/routing.js`.

### 2. Supabase (trasy mimo prehliadača)

1. Vytvor projekt na [supabase.com](https://supabase.com).
2. V **SQL Editori** spusť celý súbor [`supabase/schema.sql`](supabase/schema.sql).
3. Do `.env` doplň:

   ```env
   VITE_SUPABASE_URL=https://tvoj-projekt.supabase.co
   VITE_SUPABASE_ANON_KEY=tvoj-anon-public-key
   ```

Po nastavení sa v pätičke zobrazí `Úložisko: Supabase`. Súbor `.env` je v `.gitignore`.

> **Bezpečnosť:** aplikácia nemá prihlásenie, preto `schema.sql` povoľuje anonymný zápis/čítanie
> trás. Pre produkciu pridaj prihlásenie a prepni sa na politiky `auth.uid() = user_id`
> (pripravené, zakomentované na konci `schema.sql`).

## Build a deploy

```bash
npm run build        # výstup do dist/
npm run preview      # lokálny náhľad buildu
```

### Render (statický hosting)

Repozitár obsahuje [`render.yaml`](render.yaml): v Renderi zvoľ **New → Blueprint** a doplň
environment premenné. Build: `npm ci && npm run build`, publikuje sa `dist`.

Aktuálny deploy beží na **https://schovka.onrender.com** (statický web, HTTPS → geolokácia
funguje na mobile). Premenné sú nastavené priamo v Renderi (`VITE_ORS_API_KEY`), nie v repozitári.

> Premenné `VITE_*` sa vkladajú do kódu **pri builde** – po zmene je nutný redeploy.
> Geolokácia na webe vyžaduje zabezpečený kontext (HTTPS), čo Render spĺňa.

---

## Štruktúra projektu

```
.
├── index.html              # vstupná stránka (Vite)
├── preview.html            # alternatívny statický náhľad
├── manifest.json           # PWA manifest
├── render.yaml             # Render Blueprint (statický deploy)
├── vite.config.js
├── supabase/
│   └── schema.sql          # tabuľka tracks + RLS politiky
└── src/
    ├── main.jsx
    ├── App.jsx             # stavy, mapa, navigácia, história
    ├── styles.css
    ├── lib/
    │   ├── useTracker.js   # hook: GPS záznam, čas, vzdialenosť
    │   ├── geo.js          # haversine, tempo, formátovanie, geolokácia
    │   ├── routing.js      # OpenRouteService + fallback priama čiara
    │   ├── store.js        # uložisko trás: Supabase ↔ localStorage
    │   ├── gpx.js          # export trasy do GPX
    │   └── supabaseClient.js
    └── components/
        ├── MapView.jsx       # Leaflet mapa, čiary, značky, klik
        ├── TrackerPanel.jsx  # ovládanie záznamu + živé štatistiky
        └── TrackHistory.jsx  # história trás, premenovanie, GPX
```

## Formát uloženej trasy

```jsonc
{
  "name": "Trasa 17. 09. 16:20",
  "started_at": "2026-09-17T14:20:00.000Z",
  "finished_at": "2026-09-17T14:48:12.000Z",
  "duration_s": 1692,
  "distance_m": 2410,
  "avg_speed_kmh": 5.13,
  "points": [{ "lat": 48.8103, "lng": 17.1631, "acc": 8, "t": 1789... }, ...]
}
```

## Poznámky

- Mapové dlaždice sa sťahujú z OpenStreetMap – aplikácia potrebuje internet aspoň na ich prvé načítanie.
- Ikony na mape sú čisté CSS/`divIcon` (emoji), nepotrebujú žiadny externý obrázok.
- Záznam beží len kým je stránka otvorená (nahrávanie na pozadí by vyžadovalo PWA/service worker).
- Dlhé trasy môžu mať tisíce bodov; zváž zjednodušenie (napr. ukladať každý 3. bod).
- Balík má ~533 kB (154 kB gzip) – najmä Leaflet + Supabase klient; rozdelenie je možné cez
  `build.rollupOptions.output.manualChunks`.

## Licencia

MIT
