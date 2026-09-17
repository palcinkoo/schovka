import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView from './components/MapView';
import TrackerPanel from './components/TrackerPanel';
import TrackHistory from './components/TrackHistory';
import DestinationsPanel from './components/DestinationsPanel';
import DestinationSheet from './components/DestinationSheet';
import { useTracker } from './lib/useTracker';
import { store, mode, isSupabaseConfigured } from './lib/store';
import { getRoute, orsConfigured, PROFILES } from './lib/routing';
import { getUserLocation, formatDistance, formatDuration } from './lib/geo';
import { downloadGpx } from './lib/gpx';
import {
  fetchDestinations,
  subscribeToUpdates,
  NTFY_TOPIC,
  commitDestinations,
  readLocal,
  saveLocal,
  getToken,
  setToken,
  uid,
} from './lib/destinations';

const DEFAULT_CENTER = [48.8103, 17.1631]; // Holíč – kým nie je známa poloha
const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE || '';
const REFRESH_MS = 20_000;

export default function App() {
  const [tab, setTab] = useState('map'); // 'map' | 'places' | 'history'

  // ---- poloha a mapa
  const [current, setCurrent] = useState(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [follow, setFollow] = useState(true);
  const [center, setCenter] = useState(DEFAULT_CENTER);

  // ---- trasy
  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [toast, setToast] = useState('');
  const tracker = useTracker();
  const trackerRef = useRef(tracker);
  trackerRef.current = tracker;

  // ---- navigácia
  const [dest, setDest] = useState(null);
  const [routeFrom, setRouteFrom] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [profile, setProfile] = useState('foot');
  const [picking, setPicking] = useState(false);

  // ---- ciele (destinations)
  const [destData, setDestData] = useState(() => readLocal());
  const [destSource, setDestSource] = useState('cache');
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [token, setTokenState] = useState(() => getToken());

  // ---- admin režim (?admin=1, prípadne chránený kódom z env)
  const [adminParam] = useState(() => new URLSearchParams(window.location.search).get('admin') === '1');
  const [unlocked, setUnlocked] = useState(() => !ADMIN_CODE);
  const [codeInput, setCodeInput] = useState('');
  const isAdmin = adminParam && unlocked;

  const flash = (text) => {
    setToast(text);
    setTimeout(() => setToast(''), 2600);
  };

  // ---------------------------------------------------------------- načítanie
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

  const loadDestinations = useCallback(async (preferFresh = false) => {
    const { data, source } = await fetchDestinations(preferFresh);
    setDestData(data);
    setDestSource(source);
  }, []);

  useEffect(() => {
    locate();
    refreshTracks();
    loadDestinations();
    const id = setInterval(() => loadDestinations(false), REFRESH_MS);
    return () => clearInterval(id);
  }, [locate, refreshTracks, loadDestinations]);

  // okamžité odokrytie: ping od organizátora → stiahnutie čerstvých dát
  useEffect(() => subscribeToUpdates(() => loadDestinations(true)), [loadDestinations]);

  useEffect(() => {
    const p = tracker.current;
    if (p) setCurrent((prev) => ({ ...(prev || {}), ...p }));
  }, [tracker.current]);

  useEffect(() => {
    if (follow && current) setCenter([current.lat, current.lng]);
  }, [follow, current]);

  // ---------------------------------------------------------------- trasy
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

  // ---------------------------------------------------------------- navigácia
  const setDestinationAndRoute = (d) => {
    setDest({ lat: d.lat, lng: d.lng });
    setRouteFrom(current || { lat: center[0], lng: center[1] });
    setTab('map');
  };

  const handleMapPick = (p) => {
    if (adding) {
      const d = { id: uid(), name: 'Nový cieľ', note: '', lat: p.lat, lng: p.lng, visible: false, media: [] };
      setDestData((prev) => ({ ...prev, destinations: [...(prev.destinations || []), d] }));
      setAdding(false);
      setSelectedId(d.id);
      flash('Cieľ pridaný – doplň názov, média a ulož zmeny.');
      return;
    }
    if (picking) {
      setDest(p);
      setRouteFrom(current || { lat: center[0], lng: center[1] });
      setPicking(false);
    }
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

  // ---------------------------------------------------------------- ciele
  const updateDestData = (next) => {
    setDestData(next);
    saveLocal(next);
    setDestSource((s) => (s === 'github' ? 'github' : 'cache'));
  };

  const saveDestinations = async () => {
    setSaving(true);
    setStatus('');
    try {
      await commitDestinations(destData);
      setDestSource('github');
      setShowJson(false);
      setStatus(
        NTFY_TOPIC
          ? '✅ Uložené – užívatelia to uvidia okamžite.'
          : '✅ Uložené do GitHubu – užívateľ to uvidí do ~2 minút.',
      );
      await loadDestinations();
    } catch (e) {
      setShowJson(true);
      setStatus(`⚠️ ${e.message} Zmeny sú uložené len v tomto prehliadači.`);
    } finally {
      setSaving(false);
    }
  };

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.id === selectedTrackId) || null,
    [tracks, selectedTrackId],
  );
  const selectedDest = useMemo(
    () => (destData?.destinations || []).find((d) => d.id === selectedId) || null,
    [destData, selectedId],
  );

  // ---------------------------------------------------------------- mapa
  const destMarkers = (destData?.destinations || [])
    .filter((d) => isAdmin || d.visible)
    .map((d) => ({
      key: d.id,
      destId: d.id,
      lat: d.lat,
      lng: d.lng,
      icon: d.visible ? 'dest' : 'destHidden',
      label: d.name,
    }));

  const markers = [
    ...destMarkers,
    ...(current ? [{ key: 'user', lat: current.lat, lng: current.lng, icon: 'user', label: 'Tvoja poloha' }] : []),
    ...(dest ? [{ key: 'route-dest', lat: dest.lat, lng: dest.lng, icon: 'target', label: 'Cieľ trasy' }] : []),
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
    ...(tracker.points.length > 1 ? [{ key: 'live', coords: tracker.points, color: '#2563eb', weight: 5 }] : []),
    ...(selectedTrack?.points?.length > 1
      ? [{ key: 'selected', coords: selectedTrack.points, color: '#f97316', weight: 5 }]
      : []),
    ...(route?.geometry?.length > 1
      ? [
          {
            key: 'route',
            coords: route.geometry,
            color: '#16a34a',
            weight: 5,
            dashed: route.source === 'straight',
          },
        ]
      : []),
  ];

  const mapCenter =
    tab === 'history' && selectedTrack?.points?.length
      ? [selectedTrack.points[0].lat, selectedTrack.points[0].lng]
      : center;

  // ---------------------------------------------------------------- render
  if (adminParam && !unlocked) {
    return (
      <div className="app">
        <div className="card admin-gate">
          <h2>Režim organizátora</h2>
          <p className="muted">Zadaj kód, aby si mohol spravovať ciele.</p>
          <input
            className="input"
            type="password"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && codeInput === ADMIN_CODE && setUnlocked(true)}
          />
          <div className="row">
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => (codeInput === ADMIN_CODE ? setUnlocked(true) : flash('Nesprávny kód.'))}
            >
              Odomknúť
            </button>
            <button className="btn btn--ghost" type="button" onClick={() => (window.location.search = '')}>
              Späť
            </button>
          </div>
          {toast && <p className="error">{toast}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">🧭</span>
          <div>
            <h1 className="app__title">Schovka</h1>
            <p className="app__subtitle">
              GPS navigácia a záznam trás {isAdmin && <span className="badge badge--admin">ADMIN</span>}
            </p>
          </div>
        </div>
        <nav className="tabs">
          <button className={`tab ${tab === 'map' ? 'tab--active' : ''}`} onClick={() => setTab('map')}>
            Mapa
          </button>
          <button className={`tab ${tab === 'places' ? 'tab--active' : ''}`} onClick={() => setTab('places')}>
            Ciele {(destData?.destinations || []).filter((d) => isAdmin || d.visible).length}
          </button>
          <button className={`tab ${tab === 'history' ? 'tab--active' : ''}`} onClick={() => setTab('history')}>
            História ({tracks.length})
          </button>
        </nav>
      </header>

      {!isSupabaseConfigured && (
        <div className="notice">
          <strong>Lokálny režim.</strong> Trasy sa ukladajú do localStorage tohto prehliadača.
        </div>
      )}
      {!orsConfigured && (
        <div className="notice notice--info">
          <strong>Trasy bez routingu.</strong> Nie je nastavený <code>VITE_ORS_API_KEY</code> – zobrazuje sa
          priama čiara.
        </div>
      )}

      <main className="app__main">
        {tab === 'map' && (
          <>
            <MapView
              center={mapCenter}
              zoom={follow ? 16 : 14}
              markers={markers}
              lines={lines}
              circle={current ? { lat: current.lat, lng: current.lng, radius: current.accuracy ?? current.acc } : null}
              onPick={adding || picking ? handleMapPick : null}
              onMarkerClick={(m) => m.destId && setSelectedId(m.destId)}
              className="map-card"
            />

            {selectedDest && (isAdmin || selectedDest.visible) && (
              <DestinationSheet
                destination={selectedDest}
                admin={isAdmin}
                onClose={() => setSelectedId(null)}
                onNavigate={setDestinationAndRoute}
              />
            )}

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
                <button className={`btn ${picking ? 'btn--primary' : ''}`} onClick={() => setPicking((v) => !v)}>
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
        )}

        {tab === 'places' && (
          <>
            <MapView
              center={mapCenter}
              zoom={14}
              markers={markers}
              lines={lines}
              onPick={adding ? handleMapPick : null}
              onMarkerClick={(m) => m.destId && setSelectedId(m.destId)}
              className="map-card"
            />

            {selectedDest && (isAdmin || selectedDest.visible) && (
              <DestinationSheet
                destination={selectedDest}
                admin={isAdmin}
                onClose={() => setSelectedId(null)}
                onNavigate={setDestinationAndRoute}
              />
            )}

            <DestinationsPanel
              data={destData}
              admin={isAdmin}
              source={destSource}
              saving={saving}
              status={status}
              selectedId={selectedId}
              adding={adding}
              onToggleAdding={() => setAdding((v) => !v)}
              onRefresh={() => loadDestinations(true)}
              onChange={updateDestData}
              onSave={saveDestinations}
              onSelect={(d) => setSelectedId(d.id === selectedId ? null : d.id)}
              onFocus={(d) => {
                setCenter([d.lat, d.lng]);
                setFollow(false);
                setSelectedId(d.id);
                setTab('map');
              }}
              onNavigate={setDestinationAndRoute}
              token={token}
              onTokenChange={(v) => {
                setTokenState(v);
                setToken(v);
              }}
            />

            {isAdmin && showJson && (
              <div className="card">
                <h2>Zmeny nie je kam uložiť – skopíruj JSON</h2>
                <p className="muted small">
                  Vlož ho do súboru <code>public/destinations.json</code> v repozitári (alebo zadaj GitHub token
                  vyššie a ulož priamo z appky).
                </p>
                <textarea className="json-box" readOnly value={JSON.stringify(destData, null, 2)} rows={12} />
                <div className="row">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(JSON.stringify(destData, null, 2));
                      flash('JSON skopírovaný.');
                    }}
                  >
                    📋 Kopírovať JSON
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'history' && (
          <>
            <MapView center={mapCenter} zoom={14} markers={markers} lines={lines} className="map-card" />
            <TrackHistory
              tracks={tracks}
              selectedId={selectedTrackId}
              onSelect={(t) => setSelectedTrackId(t ? t.id : null)}
              onDelete={async (id) => {
                await store.deleteTrack(id);
                if (selectedTrackId === id) setSelectedTrackId(null);
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
        <span>Ciele: {destSource}</span>
        <span>·</span>
        <button
          className="footer-link"
          type="button"
          onClick={() => {
            window.location.search = isAdmin ? '' : '?admin=1';
          }}
        >
          {isAdmin ? 'Užívateľský režim' : 'Režim organizátora'}
        </button>
      </footer>
    </div>
  );
}
