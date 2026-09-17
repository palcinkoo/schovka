import { distanceMeters } from './geo';

/**
 * Trasy cez OpenRouteService (ORS v2 – GeoJSON FeatureCollection).
 * Pri chýbajúcom kľúči, chybe siete alebo prekročenom limite sa vráti
 * priama čiara s varovaním – aplikácia tak nikdy nespadne.
 */
const API_KEY = import.meta.env.VITE_ORS_API_KEY;
export const orsConfigured = Boolean(API_KEY);

export const PROFILES = {
  foot: { id: 'foot-walking', label: 'Pešo', emoji: '🚶' },
  bike: { id: 'cycling-regular', label: 'Bicykel', emoji: '🚴' },
  car: { id: 'driving-car', label: 'Auto', emoji: '🚗' },
};

// ---------------------------------------------------------------- inštrukcie
const DIRS = {
  north: 'sever',
  south: 'juh',
  east: 'východ',
  west: 'západ',
  northeast: 'severovýchod',
  northwest: 'severozápad',
  southeast: 'juhovýchod',
  southwest: 'juhozápad',
};
const SIDE = { left: 'vľavo', right: 'vpravo' };
const MOD = { sharp: 'prudko ', slight: 'mierne ' };

/** ORS vracia inštrukcie po anglicky – preložíme bežné frázy do slovenčiny. */
export function translateInstruction(text = '') {
  const s = text.trim();
  const dir = (w) => DIRS[w] || w;
  const side = (w) => SIDE[w] || (w === 'left' ? 'vľavo' : 'vpravo');

  let m;
  if (/^you have arrived/i.test(s)) return 'Prišiel si do cieľa.';
  if ((m = s.match(/^Head (north|south|east|west|northeast|northwest|southeast|southwest)$/i)))
    return `Choď smerom ${dir(m[1].toLowerCase())}`;
  if ((m = s.match(/^Turn (sharp |slight )?(left|right)( onto .+)?$/i)))
    return `Odboč ${m[1] ? MOD[m[1].trim()] : ''}${side(m[2].toLowerCase())}${m[3] ? ` na${m[3]}` : ''}`;
  if ((m = s.match(/^Keep (left|right)( onto .+)?$/i)))
    return `Drž sa ${side(m[1].toLowerCase())}${m[2] ? ` na${m[2]}` : ''}`;
  if ((m = s.match(/^Continue (onto .+|on .+)$/i))) return `Pokračuj ${m[1].replace(/^onto |^on /, 'po ')}`;
  if ((m = s.match(/^Continue$/i))) return 'Pokračuj rovno';
  if ((m = s.match(/^Enter roundabout and take the (\d+)(?:st|nd|rd|th) exit(.*)$/i)))
    return `Vojdi na kruhový objazd a choď ${m[1]}. výjazdom${m[2] ? ` ${m[2]}` : ''}`;
  if ((m = s.match(/^At roundabout,? take the (\d+)(?:st|nd|rd|th) exit(.*)$/i)))
    return `Na kruhovom objazde choď ${m[1]}. výjazdom${m[2] ? ` ${m[2]}` : ''}`;
  if ((m = s.match(/^Arrive at (.+)$/i))) return `Príchod: ${m[1]}`;
  if ((m = s.match(/^Depart from (.+)$/i))) return `Odchod z: ${m[1]}`;
  if ((m = s.match(/^Turn around(.*)$/i))) return `Otoč sa${m[1] ? ` ${m[1]}` : ''}`;
  return s;
}

// ------------------------------------------------------------------ routing
function straightRoute(from, to, warning = null) {
  return {
    geometry: [
      { lat: from.lat, lng: from.lng },
      { lat: to.lat, lng: to.lng },
    ],
    distance_m: distanceMeters(from.lat, from.lng, to.lat, to.lng),
    duration_s: null,
    steps: [],
    source: 'straight',
    warning,
  };
}

/**
 * @returns {Promise<{geometry:{lat,lng}[], distance_m:number, duration_s:number|null,
 *                    steps:{instruction:string,distance:number,name:string}[],
 *                    source:string, warning:string|null}>}
 */
export async function getRoute(from, to, profile = 'foot') {
  if (!from || !to) throw new Error('Chýba štart alebo cieľ.');
  if (!orsConfigured) return straightRoute(from, to, 'Nie je nastavený VITE_ORS_API_KEY – zobrazená je priama čiara.');

  const { id } = PROFILES[profile] || PROFILES.foot;
  const url =
    `https://api.openrouteservice.org/v2/directions/${id}` +
    `?api_key=${encodeURIComponent(API_KEY)}` +
    `&start=${from.lng},${from.lat}` +
    `&end=${to.lng},${to.lat}` +
    `&instructions=true&instructions_format=text&geometry_format=geojson`;

  try {
    const res = await fetch(url, { headers: { Accept: 'application/geo+json' } });

    if (res.status === 401 || res.status === 403) throw new Error('Neplatný alebo neautorizovaný API kľúč ORS.');
    if (res.status === 429) throw new Error('Prekročený limit ORS (free tier: 40/min, 2000/deň).');
    if (!res.ok) throw new Error(`ORS vrátilo chybu ${res.status}.`);

    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature?.geometry?.coordinates) throw new Error('Trasa sa nenašla (skús iný cieľ).');

    const steps = (feature.properties?.segments?.[0]?.steps || []).map((s) => ({
      instruction: translateInstruction(s.instruction),
      distance: s.distance,
      name: s.name,
    }));

    return {
      geometry: feature.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      distance_m: feature.properties?.summary?.distance ?? 0,
      duration_s: feature.properties?.summary?.duration ?? null,
      steps,
      source: 'ors',
      warning: null,
    };
  } catch (err) {
    // Sieť, kvóta alebo zmena API – aplikácia ostane funkčná s priamou čiarou.
    return straightRoute(from, to, err.message || 'Trasu sa nepodarilo získať.');
  }
}
