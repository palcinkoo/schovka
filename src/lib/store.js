import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Úložisko trás. Keď je nastavené Supabase, trasy sa ukladajú tam;
 * inak sa ukladajú do localStorage (aplikácia funguje aj bez backendu).
 */

const LS_KEY = 'schovka.tracks';
const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
};
const write = (rows) => localStorage.setItem(LS_KEY, JSON.stringify(rows));

const local = {
  mode: 'local',
  async listTracks() {
    return read().sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
  },
  async saveTrack(track) {
    const row = { id: uid(), created_at: new Date().toISOString(), ...track };
    write([row, ...read()]);
    return row;
  },
  async renameTrack(id, name) {
    const rows = read().map((t) => (t.id === id ? { ...t, name } : t));
    write(rows);
    return rows.find((t) => t.id === id);
  },
  async deleteTrack(id) {
    write(read().filter((t) => t.id !== id));
  },
};

const live = {
  mode: 'supabase',
  async listTracks() {
    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .order('started_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async saveTrack(track) {
    const { data, error } = await supabase.from('tracks').insert(track).select().single();
    if (error) throw error;
    return data;
  },
  async renameTrack(id, name) {
    const { data, error } = await supabase.from('tracks').update({ name }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteTrack(id) {
    const { error } = await supabase.from('tracks').delete().eq('id', id);
    if (error) throw error;
  },
};

export const store = isSupabaseConfigured ? live : local;
export const mode = store.mode;
export { isSupabaseConfigured };
