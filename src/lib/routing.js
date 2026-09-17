import { distanceMeters } from './geo';

/**
 * Trasy cez OpenRouteService.
 * Bez API kľúča (VITE_ORS_API_KEY) sa použije priama čiara – aplikácia funguje aj čisto offline.
 */
const API_KEY = import.meta.env.VITE_ORS_API_KEY;
export const orsConfigured = Boolean(API_KEY);

export const PROFILES = {
  foot: { id: 'foot-walking', label: 'Pešo', emoji: '🚶' },
  bike: { id: 'cycling-regular', label: 'Bicykel', emoji: '🚴' },
  car: { id: 'driving-car', label: 'Auto', emoji: '🚗' },
};

function straightRoute(from, to) {
  return {
    geometry: [
      { lat: from.lat, lng: from.lng },
      { lat: to.lat, lng: to.lng },
    ],
    distance_m: distanceMeters(from.lat, from.lng, to.lat, to.lng),
    duration_s: null,
    steps: [],
    source: 'straight',
  };
}

/**
 * @returns {Promise<{geometry:{lat,lng}[], distance_m:number, duration_s:number|null,
 *                    steps:{instruction:string,distance:number,name:string}[], source:string}>}
 */
export async function getRoute(from, to, profile = 'foot') {
  if (!from || !to) throw new Error('Chýba štart alebo cieľ.');
  if (!orsConfigured) return straightRoute(from, to);

  const { id } = PROFILES[profile] || PROFILES.foot;
  const url =
    `https://api.openrouteservice.org/v2/directions/${id}` +
    `?api_key=${encodeURIComponent(API_KEY)}` +
    `&start=${from.lng},${from.lat}` +
    `&end=${to.lng},${to.lat}`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const detail = res.status === 401 ? 'neplatný API kľúč' : `chyba ${res.status}`;
    throw new Error(`OpenRouteService: ${detail}`);
  }
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route?.geometry) throw new Error('Trasa sa nenašla (skús iný cieľ).');

  return {
    geometry: (route.geometry.coordinates || []).map(([lng, lat]) => ({ lat, lng })),
    distance_m: route.summary?.distance ?? 0,
    duration_s: route.summary?.duration ?? null,
    steps: (route.segments?.[0]?.steps || []).map((s) => ({
      instruction: s.instruction,
      distance: s.distance,
      name: s.name,
    })),
    source: 'ors',
  };
}
