import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Jednotné rozhranie nad dátami. Beží buď nad Supabase (produkcia),
 * alebo nad localStorage (demo režim bez konfigurácie), aby sa dala
 * aplikácia vyskúšať hneď po `npm install && npm run dev`.
 */

const LS = {
  codes: 'schovka.codes',
  hides: 'schovka.hides',
  session: 'schovka.session',
};

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const inDays = (days) => new Date(Date.now() + days * 86400_000).toISOString();

/** Demo dáta pri prvom spustení (Holíč, SK). */
function seedDemo() {
  if (read(LS.codes, null)) return;
  const code = {
    id: uid(),
    code: 'SCHOVKA',
    label: 'Demo kód',
    active: true,
    expires_at: inDays(7),
    created_at: new Date().toISOString(),
  };
  const hide = {
    id: uid(),
    code_id: code.id,
    lat: 48.8103,
    lng: 17.1631,
    hint: 'Námestie v centre — pri fontáne.',
    note: 'Demo schovka (Holíč).',
    created_at: new Date().toISOString(),
  };
  write(LS.codes, [code]);
  write(LS.hides, [hide]);
}

const demo = {
  mode: 'demo',

  async getSession() {
    seedDemo();
    return read(LS.session, null);
  },
  async signIn(email, password) {
    if (!email || !password) throw new Error('Zadaj e-mail a heslo.');
    const session = { user: { email, id: 'demo-user' }, demo: true };
    write(LS.session, session);
    return session;
  },
  async signOut() {
    localStorage.removeItem(LS.session);
  },

  async listCodes() {
    seedDemo();
    return read(LS.codes, []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },
  async createCode({ code, label, expiresAt }) {
    seedDemo();
    const codes = read(LS.codes, []);
    const row = {
      id: uid(),
      code: code.trim().toUpperCase(),
      label: label?.trim() || null,
      active: true,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };
    write(LS.codes, [row, ...codes]);
    return row;
  },
  async setCodeActive(id, active) {
    const codes = read(LS.codes, []).map((c) => (c.id === id ? { ...c, active } : c));
    write(LS.codes, codes);
  },
  async deleteCode(id) {
    write(LS.codes, read(LS.codes, []).filter((c) => c.id !== id));
    write(LS.hides, read(LS.hides, []).filter((h) => h.code_id !== id));
  },

  async listHides() {
    seedDemo();
    return read(LS.hides, []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },
  async createHide({ codeId, lat, lng, hint, note }) {
    const hides = read(LS.hides, []);
    const row = {
      id: uid(),
      code_id: codeId,
      lat,
      lng,
      hint: hint?.trim() || null,
      note: note?.trim() || null,
      created_at: new Date().toISOString(),
    };
    write(LS.hides, [row, ...hides]);
    return row;
  },
  async deleteHide(id) {
    write(LS.hides, read(LS.hides, []).filter((h) => h.id !== id));
  },

  async redeemCode(rawCode) {
    seedDemo();
    const code = String(rawCode || '').trim().toUpperCase();
    const codes = read(LS.codes, []);
    const match = codes.find((c) => c.code === code && c.active && new Date(c.expires_at) > new Date());
    if (!match) throw new Error('Neplatný alebo expirovaný kód.');
    const hides = read(LS.hides, []);
    const hide =
      hides
        .filter((h) => h.code_id === match.id)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
    if (!hide) throw new Error('Kód je platný, ale k nemu ešte nie je zadaná žiadna schovka.');
    return { hide, expiresAt: match.expires_at, code: match };
  },
};

const live = {
  mode: 'supabase',

  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data?.session ?? null;
  },
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  },
  async signOut() {
    await supabase.auth.signOut();
  },

  async listCodes() {
    const { data, error } = await supabase
      .from('daily_codes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async createCode({ code, label, expiresAt }) {
    const { data, error } = await supabase
      .from('daily_codes')
      .insert({ code: code.trim().toUpperCase(), label: label?.trim() || null, expires_at: expiresAt })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async setCodeActive(id, active) {
    const { error } = await supabase.from('daily_codes').update({ active }).eq('id', id);
    if (error) throw error;
  },
  async deleteCode(id) {
    const { error } = await supabase.from('daily_codes').delete().eq('id', id);
    if (error) throw error;
  },

  async listHides() {
    const { data, error } = await supabase.from('hides').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async createHide({ codeId, lat, lng, hint, note }) {
    const { data, error } = await supabase
      .from('hides')
      .insert({ code_id: codeId, lat, lng, hint: hint?.trim() || null, note: note?.trim() || null })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async deleteHide(id) {
    const { error } = await supabase.from('hides').delete().eq('id', id);
    if (error) throw error;
  },

  /** Overenie kódu prebieha cez RPC `redeem_code` v Postgrese (security definer). */
  async redeemCode(rawCode) {
    const { data, error } = await supabase.rpc('redeem_code', {
      p_code: String(rawCode || '').trim().toUpperCase(),
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('Neplatný alebo expirovaný kód.');
    return {
      hide: { id: row.hide_id, lat: row.lat, lng: row.lng, hint: row.hint, note: row.note },
      expiresAt: row.expires_at,
    };
  },
};

export const store = isSupabaseConfigured ? live : demo;
export const mode = store.mode;
export { isSupabaseConfigured };
