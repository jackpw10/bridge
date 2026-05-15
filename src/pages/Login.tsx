import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { verifyPassword } from '../utils/hash';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function LoginPage() {
  const users = useAppStore((s) => s.users);
  const setSession = useAppStore((s) => s.setSession);
  const nav = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const u = users.find(
      (x) => x.username.toLowerCase() === username.toLowerCase()
    );
    if (!u || !verifyPassword(password, u.passwordHash)) {
      setErr('Invalid username or password.');
      return;
    }
    setSession({ userId: u.id, username: u.username, role: u.role });
    nav(u.role === 'admin' ? '/admin' : '/triage', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-800">BRIDGE</h1>
          <p className="text-sm text-slate-500">
            Interfacility Transfer triage
          </p>
        </div>
        <Input
          label="Username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </div>
  );
}
