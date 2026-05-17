import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function SignupPage() {
  const nav = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (!email.trim()) return setErr('Email is required.');
    if (password.length < 6) return setErr('Password must be at least 6 characters.');
    if (password !== confirm) return setErr('Passwords do not match.');

    setBusy(true);
    const { data, error } = await signUp(
      email.trim(),
      password,
      firstName.trim(),
      lastName.trim()
    );
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    // If "Confirm email" is OFF in Supabase, the user is already signed in.
    if (data.session) {
      nav('/', { replace: true });
    } else {
      setOk('Account created — check your email for a confirmation link, then sign in.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Create account</h1>
          <p className="text-sm text-slate-500">All new accounts start as "user". An admin can promote you later.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {err && <div className="text-sm text-red-600">{err}</div>}
        {ok && <div className="text-sm text-green-700">{ok}</div>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </Button>
        <p className="text-xs text-slate-500 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
