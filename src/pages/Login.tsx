import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    nav('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-800">BRIDGE</h1>
          <p className="text-sm text-slate-500">Interfacility Transfer triage</p>
        </div>
        <Input
          label="Email"
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="text-xs text-slate-500 text-center">
          New here?{' '}
          <Link to="/signup" className="text-brand-600 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
