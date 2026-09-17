import { useState } from 'react';
import { REPO_URL, normalizeMediaUrl, uid } from '../lib/destinations';

const SOURCE_LABEL = { github: 'GitHub (živé)', local: 'súbor v appke', cache: 'uložené v prehliadači' };

export default function DestinationsPanel({
  data,
  admin,
  source,
  saving,
  status,
  selectedId,
  adding,
  onToggleAdding,
  onChange,
  onSave,
  onSelect,
  onFocus,
  onNavigate,
  onRefresh,
  token,
  onTokenChange,
}) {
  const [showToken, setShowToken] = useState(!token);
  const [draftUrl, setDraftUrl] = useState('');

  const destinations = data?.destinations || [];
  const visible = destinations.filter((d) => d.visible);

  const patch = (id, changes) =>
    onChange({
      ...data,
      destinations: destinations.map((d) => (d.id === id ? { ...d, ...changes } : d)),
    });

  const remove = (id) =>
    onChange({ ...data, destinations: destinations.filter((d) => d.id !== id) });

  const addMedia = (d) => {
    const url = normalizeMediaUrl(draftUrl);
    if (!url) return;
    patch(d.id, { media: [...(d.media || []), { type: 'auto', url }] });
    setDraftUrl('');
  };

  return (
    <div className="card">
      <div className="row row--between">
        <div>
          <h2 className="no-margin">{admin ? 'Ciele (admin)' : 'Ciele'}</h2>
          <p className="muted small no-margin">
            Zdroj: {SOURCE_LABEL[source] || source} · {destinations.length} cieľov
            {!admin && ` · ${visible.length} viditeľných`}
          </p>
        </div>
        <div className="row row--tight">
          <button className="btn btn--ghost btn--small" type="button" onClick={onRefresh} title="Načítať najnovšie dáta">
            🔄 Obnoviť
          </button>
          {admin && (
            <button className="btn btn--primary" type="button" onClick={onSave} disabled={saving}>
              {saving ? 'Ukladám…' : '💾 Uložiť zmeny'}
            </button>
          )}
        </div>
      </div>

      {status && <p className={status.startsWith('✅') ? 'success' : 'error'}>{status}</p>}

      {admin && (
        <>
          <div className="row row--wrap">
            <button className={`btn ${adding ? 'btn--primary' : ''}`} type="button" onClick={onToggleAdding}>
              {adding ? '📍 Klikni do mapy…' : '➕ Pridať cieľ klikom do mapy'}
            </button>
            <button className="btn btn--ghost btn--small" type="button" onClick={() => setShowToken((v) => !v)}>
              {showToken ? 'Skryť GitHub token' : '🔑 GitHub token'}
            </button>
          </div>

          {showToken && (
            <div className="token-box">
              <label className="label">
                GitHub token (uloží sa len v tomto prehliadači)
                <input
                  className="input"
                  type="password"
                  value={token}
                  placeholder="github_pat_…"
                  onChange={(e) => onTokenChange(e.target.value)}
                />
              </label>
              <p className="muted small">
                Fine-grained token → <strong>Only select repositories: schovka</strong> →
                {' '}
                <strong>Contents: Read and write</strong>. Bez neho zmeny uložíš len lokálne (appka ti
                ponúkne JSON na skopírovanie do{' '}
                <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
                  destinations.json
                </a>
                ).
              </p>
            </div>
          )}
        </>
      )}

      {!admin && visible.length === 0 && (
        <p className="muted">Zatiaľ nie je povolený žiadny cieľ. Objaví sa tu, keď ho organizátor odokryje.</p>
      )}

      <ul className="list">
        {destinations.map((d) => {
          if (!admin && !d.visible) return null;
          const active = selectedId === d.id;
          return (
            <li key={d.id} className={`place ${active ? 'place--active' : ''} ${admin && !d.visible ? 'place--hidden' : ''}`}>
              <div className="place__top">
                {admin ? (
                  <input
                    className="input input--inline place__name"
                    value={d.name || ''}
                    placeholder="Názov cieľa"
                    onChange={(e) => patch(d.id, { name: e.target.value })}
                  />
                ) : (
                  <button className="track__name" type="button" onClick={() => onSelect(d)}>
                    {d.name || 'Cieľ'}
                  </button>
                )}

                {admin ? (
                  <label className="switch">
                    <input type="checkbox" checked={!!d.visible} onChange={(e) => patch(d.id, { visible: e.target.checked })} />
                    <span>{d.visible ? 'viditeľné' : 'skryté'}</span>
                  </label>
                ) : (
                  <span className="badge">📍 odokryté</span>
                )}
              </div>

              {admin && (
                <>
                  <input
                    className="input"
                    value={d.note || ''}
                    placeholder="Popis / indícia (uvidí ju užívateľ)"
                    onChange={(e) => patch(d.id, { note: e.target.value })}
                  />

                  {d.media?.length > 0 && (
                    <ul className="media-list">
                      {d.media.map((m, i) => (
                        <li key={i}>
                          <span className="media-list__url" title={m.url}>
                            {m.type === 'auto' ? '🔗' : m.type === 'video' ? '🎬' : '🖼️'} {m.url}
                          </span>
                          <button
                            className="btn btn--small btn--danger"
                            type="button"
                            onClick={() => patch(d.id, { media: d.media.filter((_, j) => j !== i) })}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="row row--tight">
                    <input
                      className="input"
                      value={draftUrl}
                      placeholder="Odkaz na fotku/video (YouTube, Drive, priamy .jpg/.mp4…)"
                      onChange={(e) => setDraftUrl(e.target.value)}
                    />
                    <button className="btn btn--small" type="button" onClick={() => addMedia(d)}>
                      Pridať médium
                    </button>
                  </div>

                  <div className="row row--tight">
                    <button className="btn btn--small" type="button" onClick={() => onFocus(d)}>
                      Zobraziť na mape
                    </button>
                    <button className="btn btn--small" type="button" onClick={() => onNavigate(d)}>
                      Navigovať
                    </button>
                    <button className="btn btn--small btn--danger" type="button" onClick={() => remove(d.id)}>
                      Zmazať
                    </button>
                  </div>
                </>
              )}

              {!admin && (
                <div className="row row--tight">
                  <button className="btn btn--small" type="button" onClick={() => onSelect(d)}>
                    Detail
                  </button>
                  <button className="btn btn--small" type="button" onClick={() => onNavigate(d)}>
                    Navigovať
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {admin && destinations.length === 0 && (
        <p className="muted">Zatiaľ žiadne ciele. Klikni na „Pridať cieľ klikom do mapy".</p>
      )}
    </div>
  );
}

export { uid };
