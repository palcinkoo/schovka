/** Export zaznamenanej trasy do GPX 1.1 (stiahnuteľný súbor, funguje offline). */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const iso = (t) => new Date(t).toISOString();

export function buildGpx(track) {
  const pts = (track.points || [])
    .map(
      (p) =>
        `    <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">` +
        (p.acc != null ? `<hdop>${(p.acc / 5).toFixed(1)}</hdop>` : '') +
        `<time>${iso(p.t)}</time>` +
        `</trkpt>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Schovka" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${esc(track.name || 'Trasa')}</name>
    <time>${iso(track.started_at || Date.now())}</time>
  </metadata>
  <trk>
    <name>${esc(track.name || 'Trasa')}</name>
    <desc>Vzdialenosť: ${(track.distance_m || 0).toFixed(0)} m · Trvanie: ${Math.round(
      (track.duration_s || 0) / 60,
    )} min</desc>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>`;
}

export function downloadGpx(track) {
  const blob = new Blob([buildGpx(track)], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(track.name || 'trasa').replace(/[^\w\d-]+/g, '_')}.gpx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
