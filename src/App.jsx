import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView from './components/MapView';
import TrackerPanel from './components/TrackerPanel';
import TrackHistory from './components/TrackHistory';
import { useTracker } from './lib/useTracker';
import { store, mode, isSupabaseConfigured } from './lib/store';
import { getRoute, orsConfigured, PROFILES } from './lib/routing';
import { getUserLocation, geoErrorMessage, formatDistance, formatDuration } from './lib/geo';
import { downloadGpx } from './lib/gpx';

const DEFAULT_CENTER = [48.8103, 17.1631]; // Holíč – fallback kým nie je známa poloha

export default function App() {
  const [tab, setTab] = useState('map');

  const [current, setCurrent] = useState(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [follow, setFollow] = useState(true);
  const [center, setCenter] = useState(DEFAULT_CENTER);

  const [tracks, setTracks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState('');

  const [dest, setDest] = useState(null);
  const [routeFrom, setRouteFrom] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [profile, setProfile] = useState('foot');
  const [picking, setPicking] = useState(false);

  const tracker = useTracker();
  const trackerRef = useRef(tracker);
  trackerRef.current = tracker;

  const flash = (text) => {
    setToast(text);
    setTimeout(() => setToast(''), 2600);
  };

  const refreshTracks = useCallback(async () => {
    try {
      setTracks(await store.listTracks());
    } catch (e) {
      flash(`Trasy sa nepodarilo načítať: ${e.message}`);
    }
  }, []);

  const locate = useCallback(() => {
    setLocating(true);
    setGeoError('');
    getUserLocation()
      .then((p) => {
        setCurrent(p);
        setCenter([p.lat, p.lng]);
      })
      .catch((e) => setGeoError(e.message))
      .finally(() => setLocating(false));
  }, []);

  useEffect(() => {
    locate();
    refreshTracks();
  }, [locate, refreshTracks]);

  // Sledovanie polohy počas záznamu
  useEffect(() => {
    const p = tracker.current;
    if (p) setCurrent((prev) => ({ ...(prev || {}), ...p }));
  }, [tracker.current]);

  useEffect(() => {
    if (follow && current) setCenter([current.lat, current.lng]);
  }, [follow, current]);

  // Uloženie trasy po zastavení záznamu
  const handleStop = useCallback(async () => {
    const track = trackerRef.current.stop();
    if (!track) {
      flash('Trasa je príliš krátka – neuložila sa.');
      return;
    }
    try {
      await store.saveTrack(track);
      await refreshTracks();
      flash(`Trasa uložená: ${formatDistance(track.distance_m)} · ${formatDuration(track.duration_s * 1000)}`);
    } catch (e) {
      flash(`Uloženie zlyhalo: ${e.message}`);
    }
  }, [refreshTracks]);

  const pickDestination = (p) => {
    setDest(p);
    setRouteFrom(current || { lat: center[0], lng: center[1] });
    setPicking(false);
  };

  useEffect(() => {
    if (!dest || !routeFrom) {
      setRoute(null);
      return undefined;
    }
    let cancelled = false;
    setRouteBusy(true);
    setRouteError('');
    getRoute(routeFrom, dest, profile)
      .then((r) => !cancelled && setRoute(r))
      .catch((e) => !cancelled && setRouteError(e.message))
      .finally(() => !cancelled && setRouteBusy(false));
    return () => {
      cancelled = true;
    };
  }, [dest, routeFrom, profile]);

  const selectedTrack = useMemo(() => tracks.find((t) => t.id === selectedId) || null, [tracks, selectedId]);

  const markers = [
    ...(current ? [{ key: 'user', lat: current.lat, lng: current.lng, icon: 'user', label: 'Tvoja poloha' }] : []),
    ...(dest ? [{ key: 'dest', lat: dest.lat, lng: dest.lng, icon: 'target', label: 'Cieľ' }] : []),
    ...(selectedTrack?.points?.length
      ? [
          { key: 'start', lat: selectedTrack.points[0].lat, lng: selectedTrack.points[0].lng, icon: 'start', label: 'Štart' },
          {
            key: 'end',
            lat: selectedTrack.points[selectedTrack.points.length - 1].lat,
            lng: selectedTrack.points[selectedTrack.points.length - 1].lng,
            icon: 'end',
            label: 'Koniec',
          },
        ]
      : []),
  ];

  const lines = [
    ...(tracker.points.length > 1
      ? [{ key: 'live', coords: tracker.points, color: '#2563eb', weight: 5 }]
      : []),
    ...(selectedTrack?.points?.length > 1
      ? [{ key: 'selected', coords: selectedTrack.points, color: '#f97316', weight: 5 }]
      : []),
    ...(route?.geometry?.length > 1
      ? [{ key: 'route', coords: route.geometry, color: '#16a34a', weight: 5, dashed: route.source === 'straight' }]
      : []),
  ];

  const mapCenter = tab === 'history' && selectedTrack?.points?.length
    ? [selectedTrack.points[0].lat, selectedTrack.points[0].lng]
    : center;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">🧭</span>
          <div>
            <h1 className="app__title">Schovka</h1>
            <p className="app__subtitle">GPS navigácia a záznam trás</p>
          </div>
        </div>
        <nav className="tabs">
          <button className={`tab ${tab === 'map' ? 'tab--active' : ''}`} onClick={() => setTab('map')}>
            Mapa
          </button>
          <button className={`tab ${tab === 'history' ? 'tab--active' : ''}`} onClick={() => setTab('history')}>
            História ({tracks.length})
          </button>
        </nav>
      </header>

      {!isSupabaseConfigured && (
        <div className="notice">
          <strong>Lokálny režim.</strong> Trasy sa ukladajú do localStorage tohto prehliadača. Pre
          zdieľanie medzi zariadeniami nastav Supabase – návod je v <code>README.md</code>.
        </div>
      )}
      {!orsConfigured && (
        <div className="notice notice--info">
          <strong>Trasy bez routingu.</strong> Nie je nastavený <code>VITE_ORS_API_KEY</code>, preto
          sa zobrazuje priama čiara a vzdušná vzdialenosť. Kľúč z OpenRouteService doplníš do{' '}
          <code>.env</code>.
        </div>
      )}

      <main className="app__main">
        {tab === 'map' ? (
          <>
            <MapView
              center={mapCenter}
              zoom={follow ? 16 : 14}
              markers={markers}
              lines={lines}
              circle={current ? { lat: current.lat, lng: current.lng, radius: current.accuracy ?? current.acc } : null}
              onPick={picking ? pickDestination : null}
              className="map-card"
            />

            <TrackerPanel
              tracker={tracker}
              onStop={handleStop}
              follow={follow}
              onToggleFollow={() => setFollow((v) => !v)}
              onLocate={locate}
              locating={locating}
            />

            <div className="card">
              <div className="row row--between">
                <h2 className="no-margin">Navigácia k cieľu</h2>
                <div className="seg">
                  {Object.entries(PROFILES).map(([key, p]) => (
                    <button
                      key={key}
                      className={`seg__btn ${profile === key ? 'seg__btn--active' : ''}`}
                      onClick={() => setProfile(key)}
                      title={p.label}
                    >
                      {p.emoji} {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="row row--wrap">
                <button
                  className={`btn ${picking ? 'btn--primary' : ''}`}
                  onClick={() => setPicking((v) => !v)}
                >
                  {picking ? '📍 Klikni do mapy…' : '🎯 Vyber cieľ na mape'}
                </button>
                {dest && (
                  <>
                    <span className="badge">
                      Cieľ: {dest.lat.toFixed(5)}, {dest.lng.toFixed(5)}
                    </span>
                    <button className="btn btn--ghost" onClick={() => { setDest(null); setRoute(null); }}>
                      Zrušiť cieľ
                    </button>
                  </>
                )}
              </div>

              {routeBusy && <p className="muted">Počítam trasu…</p>}
              {routeError && <p className="error">{routeError}</p>}
              {route?.warning && <p className="notice notice--inline">⚠️ {route.warning}</p>}

              {route && (
                <div className="route">
                  <div className="stats stats--tight">
                    <div className="stat stat--accent">
                      <span className="stat__value">{formatDistance(route.distance_m)}</span>
                      <span className="stat__label">vzdialenosť</span>
                    </div>
                    <div className="stat stat--accent">
                      <span className="stat__value">
                        {route.duration_s ? formatDuration(route.duration_s * 1000) : '—'}
                      </span>
                      <span className="stat__label">odhadovaný čas</span>
                    </div>
                    <div className="stat">
                      <span className="stat__value">{route.source === 'ors' ? 'ORS' : 'priama čiara'}</span>
                      <span className="stat__label">zdroj trasy</span>
                    </div>
                  </div>

                  {route.steps.length > 0 && (
                    <ol className="steps">
                      {route.steps.map((s, i) => (
                        <li key={i}>
                          <span className="steps__dist">{formatDistance(s.distance)}</span>
                          <span>{s.instruction}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <MapView
              center={mapCenter}
              zoom={14}
              markers={markers}
              lines={lines}
              className="map-card"
            />
            <TrackHistory
              tracks={tracks}
              selectedId={selectedId}
              onSelect={(t) => setSelectedId(t ? t.id : null)}
              onDelete={async (id) => {
                await store.deleteTrack(id);
                if (selectedId === id) setSelectedId(null);
                refreshTracks();
                flash('Trasa zmazaná.');
              }}
              onRename={async (id, name) => {
                await store.renameTrack(id, name);
                refreshTracks();
              }}
              onExport={downloadGpx}
            />
          </>
        )}

        {geoError && <p className="error">{geoError}</p>}
        {toast && <p className="toast">{toast}</p>}
      </main>

      <footer className="app__footer">
        <span>Úložisko: {mode === 'supabase' ? 'Supabase' : 'localStorage'}</span>
        <span>·</span>
        <span>Routing: {orsConfigured ? 'OpenRouteService' : 'priama čiara'}</span>
        <span>·</span>
        <span>Vite + React + Leaflet</span>
      </footer>
    </div>
  );
}

export { geoErrorMessage };
