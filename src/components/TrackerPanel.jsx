import { formatDistance, formatDuration, formatPace, formatSpeed, speedKmh } from '../lib/geo';

function Stat({ label, value, accent }) {
  return (
    <div className={`stat ${accent ? 'stat--accent' : ''}`}>
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

export default function TrackerPanel({ tracker, follow, onToggleFollow, onLocate, locating, onStop }) {
  const { tracking, paused, points, current, elapsedMs, distance, speed, error } = tracker;
  const avg = speedKmh(distance, elapsedMs);

  return (
    <div className="card">
      <div className="row row--between">
        <h2 className="no-margin">{tracking ? (paused ? '⏸ Záznam pozastavený' : '🔴 Nahrávam trasu') : 'Záznam trasy'}</h2>
        <label className="switch">
          <input type="checkbox" checked={follow} onChange={onToggleFollow} />
          <span>Sledovať ma</span>
        </label>
      </div>

      <div className="stats">
        <Stat label="Čas" value={formatDuration(elapsedMs)} accent />
        <Stat label="Vzdialenosť" value={formatDistance(distance)} accent />
        <Stat label="Priem. tempo" value={formatPace(avg)} />
        <Stat label="Rýchlosť" value={formatSpeed(speed ?? avg)} />
        <Stat label="Zaznamenaných bodov" value={points.length} />
        <Stat label="Presnosť GPS" value={current?.acc != null ? `± ${Math.round(current.acc)} m` : '—'} />
      </div>

      <div className="row row--wrap">
        {!tracking && (
          <button className="btn btn--primary btn--big" type="button" onClick={tracker.start}>
            ▶ Štart
          </button>
        )}
        {tracking && !paused && (
          <>
            <button className="btn btn--big" type="button" onClick={tracker.pause}>
              ⏸ Pauza
            </button>
            <button className="btn btn--danger btn--big" type="button" onClick={onStop}>
              ⏹ Stop a uložiť
            </button>
          </>
        )}
        {tracking && paused && (
          <>
            <button className="btn btn--success btn--big" type="button" onClick={tracker.resume}>
              ▶ Pokračovať
            </button>
            <button className="btn btn--danger btn--big" type="button" onClick={onStop}>
              ⏹ Stop a uložiť
            </button>
          </>
        )}
        <button className="btn btn--ghost" type="button" onClick={onLocate} disabled={locating}>
          {locating ? '📡 Hľadám…' : '📡 Zisti polohu'}
        </button>
      </div>

      {tracking && !paused && <div className="recording-dot" aria-hidden="true" />}
      {error && <p className="error">{error}</p>}
      {!tracking && points.length === 0 && (
        <p className="muted small">
          Tip: zapni záznam až keď máš GPS signál (presnosť pod ~20 m) a nechaj aplikáciu otvorenú.
        </p>
      )}
    </div>
  );
}
