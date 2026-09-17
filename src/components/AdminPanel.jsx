import { useEffect, useState } from 'react';
import MapView from './MapView';
import { store } from '../lib/store';

const defaultExpiry = () => {
  const d = new Date(Date.now() + 24 * 3600_000);
  // formát pre <input type="datetime-local"> (lokálny čas)
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function AdminPanel({ session, onSignOut }) {
  const [codes, setCodes] = useState([]);
  const [hides, setHides] = useState([]);
  const [pick, setPick] = useState(null);
  const [hint, setHint] = useState('');
  const [note, setNote] = useState('');
  const [codeId, setCodeId] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    const [c, h] = await Promise.all([store.listCodes(), store.listHides()]);
    setCodes(c);
    setHides(h);
    setCodeId((prev) => prev || c[0]?.id || '');
  };

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);

  const flash = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 2500);
  };

  const saveHide = async (e) => {
    e.preventDefault();
    setError('');
    if (!pick) return setError('Klikni do mapy a vyber miesto schovky.');
    if (!codeId) return setError('Najprv vytvor denný kód.');
    setBusy(true);
    try {
      await store.createHide({ codeId, lat: pick.lat, lng: pick.lng, hint, note });
      setHint('');
      setNote('');
      setPick(null);
      await refresh();
      flash('Schovka bola uložená.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addCode = async (e) => {
    e.preventDefault();
    setError('');
    if (!newCode.trim()) return;
    setBusy(true);
    try {
      const row = await store.createCode({
        code: newCode,
        label: newLabel,
        expiresAt: new Date(expiresAt).toISOString(),
      });
      setNewCode('');
      setNewLabel('');
      await refresh();
      setCodeId(row.id);
      flash(`Kód ${row.code} vytvorený.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const markers = pick ? [{ key: 'pick', lat: pick.lat, lng: pick.lng, label: 'Nová schovka', icon: 'pick' }] : [];

  return (
    <div className="stack">
      <div className="card row row--between">
        <div>
          <h2 className="no-margin">Organizátor</h2>
          <p className="muted no-margin">
            Prihlásený: <strong>{session?.user?.email ?? 'demo'}</strong>
          </p>
        </div>
        <button className="btn btn--ghost" type="button" onClick={onSignOut}>
          Odhlásiť sa
        </button>
      </div>

      <div className="grid-2">
        <form className="card" onSubmit={saveHide}>
          <h2>Nová schovka</h2>
          <p className="muted">Klikni do mapy, vyber miesto a ulož ho k dennému kódu.</p>
          <MapView center={pick ? [pick.lat, pick.lng] : [48.8103, 17.1631]} zoom={15} markers={markers} onPick={setPick} />
          <p className="muted">
            {pick ? `Vybrané: ${pick.lat.toFixed(5)}, ${pick.lng.toFixed(5)}` : 'Zatiaľ nevybrané miesto.'}
          </p>
          <label className="label">
            Denný kód
            <select className="input" value={codeId} onChange={(e) => setCodeId(e.target.value)}>
              {codes.length === 0 && <option value="">— nie je vytvorený kód —</option>}
              {codes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.active ? '' : '(neaktívny)'} · platí do {new Date(c.expires_at).toLocaleString('sk-SK')}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Indícia (zobrazí sa hráčovi)
            <input className="input" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="napr. Pri fontáne" />
          </label>
          <label className="label">
            Poznámka (interná)
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn btn--primary" type="submit" disabled={busy}>
              Uložiť schovku
            </button>
          </div>
        </form>

        <div className="stack">
          <form className="card" onSubmit={addCode}>
            <h2>Denné kódy</h2>
            <div className="row">
              <input
                className="input"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="KÓD"
                aria-label="Nový kód"
              />
              <input
                className="input"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Popis (napr. Utorok)"
                aria-label="Popis kódu"
              />
            </div>
            <label className="label">
              Platnosť do
              <input
                className="input"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </label>
            <button className="btn btn--primary" type="submit" disabled={busy || !newCode.trim()}>
              Pridať kód
            </button>
          </form>

          <div className="card">
            <h2>Zoznam kódov</h2>
            {codes.length === 0 && <p className="muted">Zatiaľ žiadne kódy.</p>}
            <ul className="list">
              {codes.map((c) => (
                <li key={c.id} className="list__item">
                  <div>
                    <strong>{c.code}</strong> <span className="muted">{c.label}</span>
                    <div className="muted small">
                      {c.active ? 'aktívny' : 'neaktívny'} · platí do {new Date(c.expires_at).toLocaleString('sk-SK')}
                    </div>
                  </div>
                  <div className="row row--tight">
                    <button
                      className="btn btn--small"
                      type="button"
                      onClick={async () => {
                        await store.setCodeActive(c.id, !c.active);
                        refresh();
                      }}
                    >
                      {c.active ? 'Vypnúť' : 'Zapnúť'}
                    </button>
                    <button
                      className="btn btn--small btn--danger"
                      type="button"
                      onClick={async () => {
                        await store.deleteCode(c.id);
                        refresh();
                      }}
                    >
                      Zmazať
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2>História schoviek</h2>
            {hides.length === 0 && <p className="muted">Zatiaľ žiadne schovky.</p>}
            <ul className="list">
              {hides.map((h) => (
                <li key={h.id} className="list__item">
                  <div>
                    <strong>{h.lat.toFixed(5)}, {h.lng.toFixed(5)}</strong>
                    <div className="muted small">{h.hint || '—'}</div>
                  </div>
                  <button
                    className="btn btn--small btn--danger"
                    type="button"
                    onClick={async () => {
                      await store.deleteHide(h.id);
                      refresh();
                    }}
                  >
                    Zmazať
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {msg && <p className="success">{msg}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
