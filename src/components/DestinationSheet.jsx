import { mediaKind, normalizeMediaUrl, youtubeId, vimeoId } from '../lib/destinations';

function Media({ item }) {
  const url = normalizeMediaUrl(item.url || '');
  // 'auto' (a neznáme hodnoty) → typ sa odhadne z URL
  const declared = item.type && item.type !== 'auto' ? item.type : null;
  const kind = declared && declared !== 'link' ? declared : mediaKind(url);

  if (kind === 'image') {
    return (
      <img
        className="media__img"
        src={url}
        alt="Fotka k cieľu"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }
  if (kind === 'video') {
    return <video className="media__img" src={url} controls playsInline preload="metadata" />;
  }
  if (kind === 'youtube') {
    const id = youtubeId(url);
    if (id)
      return (
        <iframe
          className="media__frame"
          src={`https://www.youtube.com/embed/${id}`}
          title="Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      );
  }
  if (kind === 'vimeo') {
    const id = vimeoId(url);
    if (id)
      return (
        <iframe
          className="media__frame"
          src={`https://player.vimeo.com/video/${id}`}
          title="Video"
          allowFullScreen
        />
      );
  }
  return (
    <a className="btn btn--small" href={url} target="_blank" rel="noreferrer noopener">
      🔗 Otvoriť odkaz
    </a>
  );
}

export default function DestinationSheet({ destination, admin, onClose, onNavigate }) {
  if (!destination) return null;
  const d = destination;

  return (
    <div className="sheet">
      <div className="sheet__head">
        <div>
          <h2 className="no-margin">{d.name || 'Cieľ'}</h2>
          <p className="muted small no-margin">
            {d.lat.toFixed(5)}, {d.lng.toFixed(5)}
            {admin && (
              <>
                {' · '}
                <strong className={d.visible ? 'ok' : 'warn'}>
                  {d.visible ? 'viditeľné' : 'skryté'}
                </strong>
              </>
            )}
          </p>
        </div>
        <button className="btn btn--ghost btn--small" type="button" onClick={onClose}>
          ✕
        </button>
      </div>

      {d.note && <p className="sheet__note">{d.note}</p>}

      {d.media?.length > 0 && (
        <div className="media">
          {d.media.map((m, i) => (
            <Media key={i} item={m} />
          ))}
        </div>
      )}

      <div className="row row--wrap">
        <button className="btn btn--primary" type="button" onClick={() => onNavigate(d)}>
          🧭 Navigovať sem
        </button>
        <a
          className="btn"
          href={`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          Otvoriť v Google Maps
        </a>
      </div>
    </div>
  );
}
