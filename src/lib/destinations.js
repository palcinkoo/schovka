/**
 * Ciele (destinations) bez backendu:
 *  - zdroj pravdy je súbor public/destinations.json v Githube
 *  - appka ho číta z raw.githubusercontent.com (zmena je vidieť do pár sekúnd, bez deployu)
 *  - admin ho vie z appky rovno commitnúť cez GitHub API (token zadá raz, ostane v prehliadači)
 */

const OWNER = 'palcinkoo';
const REPO = 'schovka';
const BRANCH = 'main';
const PATH = 'public/destinations.json';

export const RAW_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${PATH}`;
export const REPO_URL = `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${PATH}`;

const LS_DATA = 'schovka.destinations';
const LS_TOKEN = 'schovka.ghToken';

export const getToken = () => localStorage.getItem(LS_TOKEN) || '';
export const setToken = (t) => localStorage.setItem(LS_TOKEN, t.trim());
export const clearToken = () => localStorage.removeItem(LS_TOKEN);

export const emptyData = () => ({ updated_at: new Date().toISOString(), destinations: [] });

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

/** Najprv GitHub (živé dáta), potom lokálny súbor z deployu, nakoniec localStorage. */
export async function fetchDestinations() {
  try {
    const res = await fetch(`${RAW_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      if (d && Array.isArray(d.destinations)) {
        saveLocal(d);
        return { data: d, source: 'github' };
      }
    }
  } catch {
    /* offline alebo bloknuté – pokračujeme fallbackom */
  }

  try {
    const res = await fetch(`/destinations.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      if (d && Array.isArray(d.destinations)) return { data: d, source: 'local' };
    }
  } catch {
    /* ignorovať */
  }

  return { data: readLocal(), source: 'cache' };
}

/** Commitne destinations.json do repozitára (vyžaduje token s právom Contents: write). */
export async function commitDestinations(data) {
  const token = getToken();
  if (!token) throw new Error('Nie je zadaný GitHub token.');

  const payload = { ...data, updated_at: new Date().toISOString() };
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };

  let sha;
  const meta = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}`,
    { headers },
  );
  if (meta.ok) {
    const j = await meta.json();
    sha = j.sha;
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
  return payload;
}

// ------------------------------------------------------------------ médiá
/** Rozpozná typ média z URL, aby sa dalo správne zobraziť (obrázok / video / embed / odkaz). */
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

/** Z bežného odkazu na Google Drive (aj view/Share) spraví priamy náhľadový odkaz. */
export function normalizeMediaUrl(url = '') {
  const d = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (d) return `https://drive.google.com/uc?export=view&id=${d[1]}`;
  return url.trim();
}

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `d-${Date.now()}-${Math.random().toString(16).slice(2)}`;
