import { useEffect, useState } from 'react';
import CodeGate from './components/CodeGate';
import HideMap from './components/HideMap';
import AdminLogin from './components/AdminLogin';
import AdminPanel from './components/AdminPanel';
import { store, mode, isSupabaseConfigured } from './lib/store';
import { supabase } from './lib/supabaseClient';

export default function App() {
  const [view, setView] = useState('player'); // 'player' | 'admin'
  const [session, setSession] = useState(null);
  const [redeemed, setRedeemed] = useState(null); // { hide, expiresAt }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    store.getSession().then((s) => mounted && setSession(s));

    if (!supabase) return () => (mounted = false);
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      mounted = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  const redeem = async (code) => {
    setBusy(true);
    setError('');
    try {
      const result = await store.redeemCode(code);
      setRedeemed(result);
    } catch (err) {
      setError(err?.message || 'Kód sa nepodarilo overiť.');
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (email, password) => {
    setSession(await store.signIn(email, password));
  };

  const signOut = async () => {
    await store.signOut();
    setSession(null);
  };

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">🫣</span>
          <div>
            <h1 className="app__title">Schovka</h1>
            <p className="app__subtitle">Hra na schovávačku s mapou a dennými kódmi</p>
          </div>
        </div>
        <nav className="tabs">
          <button
            className={`tab ${view === 'player' ? 'tab--active' : ''}`}
            onClick={() => { setView('player'); setError(''); }}
          >
            Hráč
          </button>
          <button
            className={`tab ${view === 'admin' ? 'tab--active' : ''}`}
            onClick={() => { setView('admin'); setError(''); }}
          >
            Organizátor
          </button>
        </nav>
      </header>

      {!isSupabaseConfigured && (
        <div className="notice">
          <strong>Demo režim.</strong> Nie sú nastavené <code>VITE_SUPABASE_URL</code> /{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, takže dáta sa ukladajú len do localStorage tohto prehliadača.
          Skús kód <code>SCHOVKA</code>. Návod na napojenie Supabase je v <code>README.md</code>.
        </div>
      )}

      <main className="app__main">
        {view === 'player' ? (
          redeemed ? (
            <HideMap hide={redeemed.hide} expiresAt={redeemed.expiresAt} onReset={() => setRedeemed(null)} />
          ) : (
            <CodeGate onSubmit={redeem} busy={busy} error={error} />
          )
        ) : session ? (
          <AdminPanel session={session} onSignOut={signOut} />
        ) : (
          <AdminLogin onSignIn={signIn} onBack={() => setView('player')} />
        )}
      </main>

      <footer className="app__footer">
        <span>Režim: {mode === 'demo' ? 'demo (localStorage)' : 'Supabase'}</span>
        <span>·</span>
        <span>Vite + React + Leaflet</span>
      </footer>
    </div>
  );
}
