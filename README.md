# Schovka 🫣

Hra na schovávačku s mapou. Organizátor vyberie na mape miesto, kam sa schová, a vygeneruje
**denný kód**. Hráč po zadaní platného kódu uvidí polohu, indíciu, odpočet platnosti a
vzdialenosť od seba.

**Stack:** Vite 5 + React 18 + Leaflet (react-leaflet 4) + Supabase.

---

## Funkcie

**Hráč**
- zadanie denného kódu (veľké písmená, automaticky)
- po overení: mapa s miestom schovky, indícia, odpočet platnosti kódu
- zistenie vlastnej polohy + výpočet vzdialenosti k schovke (haversine)
- tlačidlo „Našiel som ťa!“

**Organizátor (admin)**
- prihlásenie e-mailom a heslom (Supabase Auth)
- výber miesta klikom do mapy, indícia, interná poznámka
- správa denných kódov: vytvorenie, popis, platnosť, zapnutie/vypnutie, zmazanie
- história schoviek

**Bezpečnosť:** hráč (anon) nečíta tabuľky priamo — poloha sa vracia iba cez funkciu
`redeem_code()`, ktorá overí kód, príznak `active` a `expires_at`. Tabuľky sú chránené RLS,
zapisovať môže len prihlásený používateľ.

---

## Rýchly štart

```bash
npm install
npm run dev        # http://localhost:5173
```

Bez ďalšieho nastavenia aplikácia beží v **demo režime** — dáta sa ukladajú do
`localStorage` prehliadača a prihlásenie prijme akýkoľvek e-mail/heslo.
Vyskúšaj kód `SCHOVKA` (ukážková schovka v Holíči).

## Napojenie na Supabase

1. Vytvor projekt na [supabase.com](https://supabase.com).
2. V **SQL Editori** spusti celý súbor [`supabase/schema.sql`](supabase/schema.sql)
   (vytvorí tabuľky `daily_codes`, `hides`, funkciu `redeem_code` a RLS politiky).
3. V **Authentication → Users** vytvor admin používateľa (e-mail + heslo) a potvrď ho.
   Prihlasovacie údaje sa zadávajú v UI a nie sú súčasťou zdrojového kódu.
4. Skopíruj `.env.example` na `.env` a doplň hodnoty z *Project Settings → API*:

   ```env
   VITE_SUPABASE_URL=https://tvoj-projekt.supabase.co
   VITE_SUPABASE_ANON_KEY=tvoj-anon-public-key
   ```

5. V aplikácii sa prihlás ako organizátor, vytvor kód, klikni do mapy a ulož schovku.
   Po nastavení premenných zmizne hláška o demo režime (footer ukazuje `Režim: Supabase`).

> Súbor `.env` je v `.gitignore` — nikdy sa necommituje.

## Build a deploy

```bash
npm run build      # výstup do dist/
npm run preview    # lokálny náhľad buildu
```

### Render (statický hosting)

Repozitár obsahuje [`render.yaml`](render.yaml). V Renderi zvoľ **New → Blueprint**,
potom doplň environment premenné `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY`.
Build príkaz: `npm ci && npm run build`, publikuje sa priečinok `dist`.

> Premenné `VITE_*` sa vkladajú do kódu **pri builde** — po ich zmene je nutný redeploy.

---

## Štruktúra projektu

```
.
├── index.html            # vstupná stránka (Vite)
├── preview.html          # alternatívny statický náhľad
├── manifest.json         # PWA manifest
├── render.yaml           # Render Blueprint (statický deploy)
├── vite.config.js
├── supabase/
│   └── schema.sql        # tabuľky, RPC redeem_code, RLS
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── styles.css
    ├── lib/
    │   ├── supabaseClient.js   # createClient + detekcia konfigurácie
    │   ├── store.js            # jednotné API: Supabase ↔ demo (localStorage)
    │   └── geo.js              # vzdialenosť, geolokácia
    └── components/
        ├── MapView.jsx         # Leaflet mapa, klik na výber, vlastné piny
        ├── CodeGate.jsx        # zadanie denného kódu
        ├── HideMap.jsx         # odokrytá schovka, odpočet, vzdialenosť
        ├── AdminLogin.jsx      # prihlásenie organizátora
        └── AdminPanel.jsx      # správa kódov a schoviek
```

## Poznámky

- Ikony na mape sú čisté CSS/`divIcon` (emoji) — nepotrebujú žiadny externý obrázok.
- Mapové dlaždice sa sťahujú z OpenStreetMap, takže aplikácia vyžaduje internet;
  v offline/sandboxed prostredí sa zobrazí prázdne pozadie mapy, zvyšok UI funguje.
- Väčšina balíka (530 kB) pochádza z Leaflet + Supabase klienta; pri potrebe je možné
  rozdeliť ho cez `build.rollupOptions.output.manualChunks`.

## Licencia

MIT
