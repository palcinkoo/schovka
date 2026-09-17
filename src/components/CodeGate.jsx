import { useState } from 'react';

export default function CodeGate({ onSubmit, error, busy }) {
  const [code, setCode] = useState('');

  const submit = (e) => {
    e.preventDefault();
    onSubmit?.(code);
  };

  return (
    <form className="card code-gate" onSubmit={submit}>
      <h2>Zadaj denný kód</h2>
      <p className="muted">
        Kód dostaneš od organizátora. Bez platného kódu sa poloha schovky nezobrazí.
      </p>
      <div className="row">
        <input
          className="input code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="napr. SCHOVKA"
          autoComplete="off"
          spellCheck="false"
          aria-label="Denný kód"
        />
        <button className="btn btn--primary" type="submit" disabled={busy || !code.trim()}>
          {busy ? 'Overujem…' : 'Odokryť'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
