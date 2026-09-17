import { useState } from 'react';

export default function AdminLogin({ onSignIn, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSignIn(email.trim(), password);
    } catch (err) {
      setError(err?.message || 'Prihlásenie sa nepodarilo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card admin-login" onSubmit={submit}>
      <h2>Prihlásenie organizátora</h2>
      <p className="muted">
        Prihlasovacie údaje sa zadávajú tu; nie sú súčasťou zdrojového kódu.
      </p>
      <label className="label">
        E-mail
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label className="label">
        Heslo
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Prihlasujem…' : 'Prihlásiť sa'}
        </button>
        <button className="btn btn--ghost" type="button" onClick={onBack}>
          Späť
        </button>
      </div>
    </form>
  );
}
