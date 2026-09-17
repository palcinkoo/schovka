import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Keď nie sú nastavené premenné prostredia, klient sa nevytvorí.
 * Aplikácia vtedy beží v "demo režime" nad localStorage (pozri src/lib/store.js),
 * takže sa dá vyskúšať aj bez Supabase projektu.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
