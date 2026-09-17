/** Geometria, formátovanie a geolokácia pre navigáciu. */

const R = 6371000; // polomer Zeme v metroch
const toRad = (d) => (d * Math.PI) / 180;

/** Vzdialenosť dvoch bodov v metroch (haversine). */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Celková dĺžka postupnosti bodov [{lat,lng}] v metroch. */
export function pathDistance(points) {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += distanceMeters(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return sum;
}

/** Smer (azimut) z bodu A do bodu B v stupňoch (0 = sever). */
export function bearing(lat1, lng1, lat2, lng2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Šípka podľa azimutu – „sever“ v smere obrazovky. */
export function bearingArrow(deg) {
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  if (!Number.isFinite(deg)) return '↑';
  return arrows[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

export function formatDistance(m) {
  if (!Number.isFinite(m)) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function speedKmh(distanceM, ms) {
  if (!ms) return 0;
  return (distanceM / 1000) / (ms / 3_600_000);
}

export function formatSpeed(kmh) {
  if (!Number.isFinite(kmh)) return '—';
  return `${kmh.toFixed(1)} km/h`;
}

export function formatPace(kmh) {
  if (!Number.isFinite(kmh) || kmh <= 0) return '—';
  const minPerKm = 60 / kmh;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')} min/km`;
}

/** Jednorazová poloha. */
export function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Tento prehliadač nepodporuje geolokáciu.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          speed: p.coords.speed,
          heading: p.coords.heading,
        }),
      (err) => reject(new Error(geoErrorMessage(err))),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5_000 },
    );
  });
}

export function geoErrorMessage(err) {
  switch (err?.code) {
    case 1:
      return 'Povol prístup k polohe v prehliadači.';
    case 2:
      return 'Poloha nie je dostupná (skús ísť von alebo zapnúť GPS).';
    case 3:
      return 'Zisťovanie polohy trvalo príliš dlho.';
    default:
      return err?.message || 'Polohu sa nepodarilo zistiť.';
  }
}
