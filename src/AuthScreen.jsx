import { useState } from 'react';
import { supabase } from './supabaseClient';
import { diagnoseError } from './errorDiagnostics';

export default function AuthScreen() {
  const [mode, setMode] = useState('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === 'signUp') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        setCheckEmail(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // App.jsx's onAuthStateChange listener picks up the new session.
      }
    } catch (err) {
      setError(diagnoseError(err).userMessage);
    } finally {
      setBusy(false);
    }
  };

  if (checkEmail) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="max-w-sm text-center space-y-2">
          <h1 className="text-lg font-semibold">Check your email</h1>
          <p className="text-sm text-gray-600">
            Confirm your account, then log in. Note this dashboard is for managers — a
            manager account isn't created automatically at signup; ask an existing
            manager to promote you (see the operations manual, §4).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 border border-gray-200 rounded-lg p-6">
        <div>
          <h1 className="text-lg font-semibold">Cloudbase — Pokhara Ops</h1>
          <p className="text-sm text-gray-500">{mode === 'signUp' ? 'Create an account' : 'Log in'}</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {mode === 'signUp' && (
          <input
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={busy || !email || !password || (mode === 'signUp' && !name)}
          className="w-full bg-brand-600 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Please wait…' : mode === 'signUp' ? 'Sign up' : 'Log in'}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
          className="w-full text-sm text-brand-600"
        >
          {mode === 'signUp' ? 'Already have an account? Log in' : 'New account? Sign up'}
        </button>
      </form>
    </div>
  );
}
