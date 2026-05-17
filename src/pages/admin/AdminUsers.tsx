import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { Badge } from '../../components/ui/Badge';
import { supabase } from '../../lib/supabase';
import { sendPasswordReset } from '../../lib/auth';

interface ProfileRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
}

async function fetchProfiles(): Promise<ProfileRow[]> {
  // We can read profiles (name, role); emails live in auth.users which is
  // restricted. So we display by name + show '(no email visible)' when blank.
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role')
    .order('created_at', { ascending: true });
  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    email: '',
    firstName: (r.first_name as string) ?? '',
    lastName: (r.last_name as string) ?? '',
    role: ((r.role as string) === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
  }));
}

export function AdminUsersPage() {
  const session = useAppStore((s) => s.session);

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const next = await fetchProfiles();
    setProfiles(next);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const adminCount = useMemo(
    () => profiles.filter((p) => p.role === 'admin').length,
    [profiles]
  );

  async function toggleAdmin(p: ProfileRow, makeAdmin: boolean) {
    if (!makeAdmin && p.role === 'admin' && adminCount <= 1) {
      window.alert('Cannot remove the last admin. Promote another user first.');
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ role: makeAdmin ? 'admin' : 'user' })
      .eq('id', p.id);
    if (error) {
      window.alert(`Failed to update role: ${error.message}`);
      return;
    }
    refresh();
  }

  async function saveName(p: ProfileRow, firstName: string, lastName: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName })
      .eq('id', p.id);
    if (error) {
      window.alert(`Failed to save: ${error.message}`);
      return;
    }
    setProfiles((cur) =>
      cur.map((x) => (x.id === p.id ? { ...x, firstName, lastName } : x))
    );
  }

  async function resetPw(p: ProfileRow) {
    const email = window.prompt(
      `Enter the email address for "${p.firstName} ${p.lastName}".\nSupabase will send a password reset link to that address.`,
      ''
    );
    if (!email) return;
    const { error } = await sendPasswordReset(email.trim());
    if (error) {
      window.alert(`Failed: ${error.message}`);
      return;
    }
    setMsg(`Password reset email sent to ${email}.`);
    window.setTimeout(() => setMsg(null), 4000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-800">Users</h1>
          <p className="text-sm text-slate-500">
            Edit names and toggle admin role here. New users sign up via the public{' '}
            <Link to="/signup" className="underline">/signup</Link> page.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={refresh}>
          Refresh
        </Button>
      </div>

      {msg && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">
          {msg}
        </div>
      )}

      <Card title="How user management works with Supabase">
        <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
          <li>To add a user, share the <Link to="/signup" className="text-brand-600 underline">/signup</Link> URL with them. They create their own password.</li>
          <li>All new accounts default to "user" role. Promote them to admin here.</li>
          <li>To delete a user permanently, use the Supabase dashboard → Authentication → Users.</li>
        </ul>
      </Card>

      <Card>
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : profiles.length === 0 ? (
          <div className="text-sm text-slate-400">No users yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {profiles.map((p) => {
              const isSelf = session?.userId === p.id;
              return (
                <UserRow
                  key={p.id}
                  profile={p}
                  isSelf={isSelf}
                  onSaveName={(f, l) => saveName(p, f, l)}
                  onToggleAdmin={(v) => toggleAdmin(p, v)}
                  onResetPw={() => resetPw(p)}
                />
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function UserRow({
  profile,
  isSelf,
  onSaveName,
  onToggleAdmin,
  onResetPw,
}: {
  profile: ProfileRow;
  isSelf: boolean;
  onSaveName: (firstName: string, lastName: string) => void;
  onToggleAdmin: (v: boolean) => void;
  onResetPw: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);

  const display =
    profile.firstName || profile.lastName
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : '(no name set)';

  return (
    <div className="py-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="First"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              label="Last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-800 truncate">{display}</span>
              {profile.role === 'admin' && <Badge tone="purple">ADMIN</Badge>}
              {isSelf && <Badge tone="slate">You</Badge>}
            </div>
            <div className="text-xs text-slate-400">id: {profile.id}</div>
          </>
        )}
      </div>
      <Toggle
        checked={profile.role === 'admin'}
        onChange={onToggleAdmin}
        label="Admin"
      />
      {editing ? (
        <>
          <Button
            size="sm"
            onClick={() => {
              onSaveName(firstName, lastName);
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit name
          </Button>
          <Button size="sm" variant="secondary" onClick={onResetPw}>
            Send reset
          </Button>
        </>
      )}
    </div>
  );
}
