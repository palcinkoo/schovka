/**
 * Ciele (destinations) bez backendu a bez registrácie:
 *
 *   public/destinations.json v Githube = zdroj pravdy
 *     ├─ čítanie: GitHub API (vždy čerstvé) → raw CDN → súbor v deployi → localStorage
 *     └─ zápis:   GitHub API (token organizátora, len v jeho prehliadači)
 *
 * Okamžité odokrytie: po uložení admin odošle „ping" cez ntfy.sh (bez registrácie),
 * všetky otvorené appky si hneď stiahnu čerstvé dáta z GitHub API (ktoré nemá CDN cache).
 */

const OWNER = 'palcinkoo';
const REPO = 'schovka';
const BRANCH = 'main';
const PATH = 'public/destinations.json';

export const RAW_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${PATH}`;
export const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}`;
export const REPO_URL = `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${PATH}`;

export const NTFY_TOPIC = import.meta.env.VITE_NTFY_TOPIC || '';
const NTFY_URL = NTFY_TOPIC ? `https://ntfy.sh/${NTFY_TOPIC}` : '';

const LS_DATA = 'schovka.destinations';
const LS_TOKEN = 'schovka.ghToken';

export const getToken = () => localStorage.getItem(LS_TOKEN) || '';
export const setToken = (t) => localStorage.setItem(LS_TOKEN, t.trim());
export const clearToken = () => localStorage.removeItem(LS_TOKEN);

export const emptyData = () => ({ updated_at: new Date(0).toISOString(), destinations: [] });

export function readLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_DATA) || 'null');
    return d && Array.isArray(d.destinations) ? d : emptyData();
  } catch {
    return emptyData();
  }
}

export function saveLocal(data) {
  localStorage.setItem(LS_DATA, JSON.stringify(data));
}

const newer = (a, b) => (new Date(a?.updated_at || 0) > new Date(b?.updated_at || 0) ? a : b);

async function tryJson(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const d = await res.json();
    return d && Array.isArray(d.destinations) ? d : null;
  } catch {
    return null;
  }
}

/** GitHub API vracia base64 – vždy čerstvé, bez CDN cache (limit: 60 req/h bez tokenu). */
async function tryApi() {
  try {
    const res = await fetch(API_URL + `&t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.content) return null;
    const decoded = decodeURIComponent(escape(atob(j.content.replace(/\n/g, ''))));
    const d = JSON.parse(decoded);
    return d && Array.isArray(d.destinations) ? d : null;
  } catch {
    return null;
  }
}

/**
 * @param {boolean} preferFresh – true = pridaj aj GitHub API (po ping-u / manuálnom obnovení)
 * @returns {Promise<{data:object, source:'api'|'github'|'local'|'cache'}>}
 */
export async function fetchDestinations(preferFresh = false) {
  const sources = preferFresh ? [tryApi()] : [];
  sources.push(tryJson(`${RAW_URL}?t=${Date.now()}`));
  sources.push(tryJson(`/destinations.json?t=${Date.now()}`));

  const results = await Promise.all(sources);
  const names = preferFresh ? ['api', 'github', 'local'] : ['github', 'local'];

  let best = emptyData();
  let bestSource = 'cache';
  results.forEach((d, i) => {
    if (d && new Date(d.updated_at || 0) >= new Date(best.updated_at || 0)) {
      if (d !== best && new Date(d.updated_at || 0) === new Date(best.updated_at || 0) && bestSource !== 'cache') return;
      best = d;
      bestSource = names[i];
    }
  });

  const cached = readLocal();
  if (bestSource === 'cache' || newer(cached, best) === cached) {
    if (cached.destinations.length) return { data: cached, source: bestSource === 'cache' ? 'cache' : bestSource };
  }
  if (best.destinations.length || bestSource !== 'cache') saveLocal(best);
  return { data: best, source: bestSource };
}

/** Commitne destinations.json do repozitára (token s právom Contents: write). */
export async function commitDestinations(data) {
  const token = getToken();
  if (!token) throw new Error('Nie je zadaný GitHub token.');

  const payload = { ...data, updated_at: new Date().toISOString() };
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };

  let sha;
  const meta = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}`,
    { headers },
  );
  if (meta.ok) {
    sha = (await meta.json()).sha;
  } else if (meta.status !== 404) {
    const j = await meta.json().catch(() => ({}));
    throw new Error(j.message || `GitHub vrátil ${meta.status}`);
  }

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2) + '\n')));
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'chore: aktualizovať ciele schovky', content, sha, branch: BRANCH }),
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || `GitHub vrátil ${res.status}`);
  }
  saveLocal(payload);
  await publishUpdate();
  return payload;
}

/** Pošle ping všetkým otvoreným appkám, aby si hneď stiahli nové dáta. */
export async function publishUpdate() {
  if (!NTFY_URL) return false;
  try {
    await fetch(NTFY_URL, { method: 'POST', body: 'refresh' });
    return true;
  } catch {
    return false;
  }
}

/** SSE odber pingov – vráti funkciu na odhlásenie. */
export function subscribeToUpdates(onPing) {
  if (!NTFY_TOPIC || typeof EventSource === 'undefined') return () => {};
  const es = new EventSource(`https://ntfy.sh/${NTFY_TOPIC}/sse`);
  es.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data);
      if (d.event === 'message') onPing();
    } catch {
      onPing();
    }
  };
  return () => es.close();
}

// ------------------------------------------------------------------ médiá
export function mediaKind(url = '') {
  const u = url.toLowerCase();
  if (/(youtube\.com|youtu\.be)/.test(u)) return 'youtube';
  if (/vimeo\.com/.test(u)) return 'vimeo';
  if (/\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/.test(u) || /upload\.wikimedia|images\.unsplash|i\.imgur|drive\.google\.com\/uc/.test(u))
    return 'image';
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/.test(u)) return 'video';
  return 'link';
}

export function youtubeId(url = '') {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,15})/);
  return m ? m[1] : null;
}

export function vimeoId(url = '') {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

/** Z odkazu na Google Drive spraví priamy náhľadový odkaz. */
export function normalizeMediaUrl(url = '') {
  const d = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (d) return `https://drive.google.com/uc?export=view&id=${d[1]}`;
  return url.trim();
}

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `d-${Date.now()}-${Math.random().toString(16).slice(2)}`;
