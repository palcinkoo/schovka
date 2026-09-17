import { useEffect, useState } from 'react';
import MapView from './MapView';
import { distanceMeters, formatDistance, getUserLocation } from '../lib/geo';

function useCountdown(iso) {
  const [left, setLeft] = useState(() => new Date(iso) - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(new Date(iso) - Date.now()), 1000);
    return () => clearInterval(t);
  }, [iso]);
  if (left <= 0) return 'kód expiroval';
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

export default function HideMap({ hide, expiresAt, onReset }) {
  const [me, setMe] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [found, setFound] = useState(false);
  const countdown = useCountdown(expiresAt);

  const locate = () => {
    setGeoError('');
    getUserLocation()
      .then(setMe)
      .catch(() => setGeoError('Polohu sa nepodarilo zistiť (povol ju v prehliadači).'));
  };

  useEffect(() => {
    locate();
  }, []);

  const markers = [{ key: 'hide', lat: hide.lat, lng: hide.lng, label: 'Tu sa schovávam 🫣', icon: 'hide' }];
  if (me) markers.push({ key: 'me', lat: me.lat, lng: me.lng, label: 'Tvoja poloha', icon: 'me' });

  const dist = me ? distanceMeters(me.lat, me.lng, hide.lat, hide.lng) : null;

  return (
    <div className="stack">
      <div className="card">
        <div className="row row--between">
          <h2 className="no-margin">Schovka odokrytá 🎉</h2>
          <span className="badge">platnosť: {countdown}</span>
        </div>
        {hide.hint && <p className="hint">💡 {hide.hint}</p>}
        {hide.note && <p className="muted">{hide.note}</p>}

        <div className="row row--wrap">
          <button className="btn" type="button" onClick={locate}>
            📡 Zisti moju polohu
          </button>
          {dist !== null && <span className="badge badge--big">📏 {formatDistance(dist)} od schovky</span>}
          <button
            className={`btn ${found ? 'btn--ghost' : 'btn--success'}`}
            type="button"
            onClick={() => setFound((v) => !v)}
          >
            {found ? 'Zrušiť nájdenie' : '✅ Našiel som ťa!'}
          </button>
          <button className="btn btn--ghost" type="button" onClick={onReset}>
            Zmeniť kód
          </button>
        </div>
        {geoError && <p className="error">{geoError}</p>}
        {found && <p className="success">Super! Schovka bola nájdená. 🎯</p>}
      </div>

      <MapView
        center={[hide.lat, hide.lng]}
        zoom={16}
        markers={markers}
        circle={me ? { lat: me.lat, lng: me.lng, radius: Math.max(me.accuracy || 25, 25) } : null}
        className="map-card"
      />
    </div>
  );
}
