import { useState } from 'react';
import { formatDistance, formatDuration, formatPace, formatSpeed } from '../lib/geo';

export default function TrackHistory({ tracks, selectedId, onSelect, onDelete, onRename, onExport }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');

  if (tracks.length === 0) {
    return (
      <div className="card">
        <h2>História trás</h2>
        <p className="muted">
          Zatiaľ nemáš uloženú žiadnu trasu. Zapni záznam v záložke <strong>Mapa</strong>, prejdi sa
          a trasu zastav – objaví sa tu.
        </p>
      </div>
    );
  }

  const totalM = tracks.reduce((s, t) => s + (t.distance_m || 0), 0);
  const totalMs = tracks.reduce((s, t) => s + (t.duration_s || 0) * 1000, 0);

  const saveName = async (id) => {
    setEditingId(null);
    if (draft.trim()) await onRename(id, draft.trim());
  };

  return (
    <div className="card">
      <h2>História trás</h2>
      <div className="stats stats--tight">
        <div className="stat">
          <span className="stat__value">{tracks.length}</span>
          <span className="stat__label">trás</span>
        </div>
        <div className="stat">
          <span className="stat__value">{formatDistance(totalM)}</span>
          <span className="stat__label">spolu</span>
        </div>
        <div className="stat">
          <span className="stat__value">{formatDuration(totalMs)}</span>
          <span className="stat__label">celkový čas</span>
        </div>
      </div>

      <ul className="list">
        {tracks.map((t) => (
          <li key={t.id} className={`list__item ${selectedId === t.id ? 'list__item--active' : ''}`}>
            <div className="track">
              {editingId === t.id ? (
                <input
                  className="input input--inline"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => saveName(t.id)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName(t.id)}
                />
              ) : (
                <button
                  className="track__name"
                  type="button"
                  onClick={() => onSelect(selectedId === t.id ? null : t)}
                  title="Zobraziť na mape"
                >
                  {t.name}
                </button>
              )}
              <div className="muted small">
                {new Date(t.started_at).toLocaleString('sk-SK')} · {formatDistance(t.distance_m)} ·{' '}
                {formatDuration((t.duration_s || 0) * 1000)} · {formatPace(t.avg_speed_kmh * 1)} · ⌀{' '}
                {formatSpeed(t.avg_speed_kmh)}
              </div>
            </div>

            <div className="row row--tight">
              <button
                className="btn btn--small"
                type="button"
                onClick={() => onSelect(selectedId === t.id ? null : t)}
              >
                {selectedId === t.id ? 'Skryť' : 'Zobraziť'}
              </button>
              <button
                className="btn btn--small"
                type="button"
                onClick={() => {
                  setEditingId(t.id);
                  setDraft(t.name || '');
                }}
              >
                Premenovať
              </button>
              <button className="btn btn--small" type="button" onClick={() => onExport(t)} title="Stiahnuť GPX">
                ⬇ GPX
              </button>
              <button className="btn btn--small btn--danger" type="button" onClick={() => onDelete(t.id)}>
                Zmazať
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
