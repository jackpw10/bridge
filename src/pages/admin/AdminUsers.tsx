import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Toggle } from '../../components/ui/Toggle';
import { Badge } from '../../components/ui/Badge';
import { uid } from '../../utils/id';
import { hashPassword } from '../../utils/hash';
import type { User } from '../../types';

export function AdminUsersPage() {
  const users = useAppStore((s) => s.users);
  const setUsers = useAppStore((s) => s.setUsers);
  const session = useAppStore((s) => s.session);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resettingPw, setResettingPw] = useState<User | null>(null);

  const adminCount = useMemo(() => users.filter((u) => u.role === 'admin').length, [users]);

  function save(next: User) {
    const exists = users.some((u) => u.id === next.id);
    setUsers(exists ? users.map((u) => (u.id === next.id ? next : u)) : [...users, next]);
  }

  function toggleAdmin(u: User, makeAdmin: boolean) {
    if (!makeAdmin && u.role === 'admin' && adminCount <= 1) {
      window.alert('Cannot remove the last admin. Promote another user first.');
      return;
    }
    save({ ...u, role: makeAdmin ? 'admin' : 'user' });
  }

  function remove(u: User) {
    if (session?.userId === u.id) {
      window.alert('You cannot delete your own account.');
      return;
    }
    if (u.role === 'admin' && adminCount <= 1) {
      window.alert('Cannot delete the last admin.');
      return;
    }
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    setUsers(users.filter((x) => x.id !== u.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-800">Users</h1>
        </div>
        <Button onClick={() => setCreating(true)}>+ New user</Button>
      </div>

      <Card>
        <div className="divide-y divide-slate-100">
          {users.map((u) => {
            const isSelf = session?.userId === u.id;
            return (
              <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 truncate">
                      {u.firstName || u.lastName ? `${u.firstName} ${u.lastName}`.trim() : u.username}
                    </span>
                    {u.role === 'admin' && <Badge tone="purple">ADMIN</Badge>}
                    {isSelf && <Badge tone="slate">You</Badge>}
                  </div>
                  <div className="text-xs text-slate-500">username: {u.username}</div>
                </div>
                <Toggle
                  checked={u.role === 'admin'}
                  onChange={(v) => toggleAdmin(u, v)}
                  label="Admin"
                />
                <Button size="sm" variant="secondary" onClick={() => setEditing(u)}>Edit</Button>
                <Button size="sm" variant="secondary" onClick={() => setResettingPw(u)}>Reset pw</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(u)} disabled={isSelf}>Delete</Button>
              </div>
            );
          })}
          {users.length === 0 && (
            <div className="text-sm text-slate-400 py-4 text-center">No users.</div>
          )}
        </div>
      </Card>

      {creating && (
        <CreateUserModal
          existingUsernames={users.map((u) => u.username)}
          onCancel={() => setCreating(false)}
          onCreate={(u) => {
            save(u);
            setCreating(false);
          }}
        />
      )}

      {editing && (
        <EditUserModal
          user={editing}
          existingUsernames={users.filter((u) => u.id !== editing.id).map((u) => u.username)}
          onCancel={() => setEditing(null)}
          onSave={(u) => {
            save(u);
            setEditing(null);
          }}
        />
      )}

      {resettingPw && (
        <ResetPasswordModal
          user={resettingPw}
          onCancel={() => setResettingPw(null)}
          onConfirm={(plain) => {
            save({ ...resettingPw, passwordHash: hashPassword(plain) });
            setResettingPw(null);
          }}
        />
      )}
    </div>
  );
}

// ---------- Create ----------
function CreateUserModal({
  existingUsernames,
  onCancel,
  onCreate,
}: {
  existingUsernames: string[];
  onCancel: () => void;
  onCreate: (u: User) => void;
}) {
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    const u = username.trim();
    if (!u) return setErr('Username is required.');
    if (existingUsernames.some((x) => x.toLowerCase() === u.toLowerCase()))
      return setErr('That username is already taken.');
    if (!password) return setErr('Password is required.');
    if (password !== confirm) return setErr('Passwords do not match.');
    onCreate({
      id: uid('u'),
      username: u,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      passwordHash: hashPassword(password),
      role: isAdmin ? 'admin' : 'user',
    });
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title="Create user"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit}>Create</Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        <Input label="Username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Toggle checked={isAdmin} onChange={setIsAdmin} label="Grant admin role" />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button type="submit" className="hidden" aria-hidden />
      </form>
    </Modal>
  );
}

// ---------- Edit ----------
function EditUserModal({
  user,
  existingUsernames,
  onCancel,
  onSave,
}: {
  user: User;
  existingUsernames: string[];
  onCancel: () => void;
  onSave: (u: User) => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    const u = username.trim();
    if (!u) return setErr('Username is required.');
    if (existingUsernames.some((x) => x.toLowerCase() === u.toLowerCase()))
      return setErr('That username is already taken.');
    onSave({ ...user, username: u, firstName: firstName.trim(), lastName: lastName.trim() });
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={`Edit ${user.username}`}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="text-xs text-slate-500">
          To change this user's password, use "Reset pw" from the list.
        </div>
        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>
    </Modal>
  );
}

// ---------- Reset pw ----------
function ResetPasswordModal({
  user,
  onCancel,
  onConfirm,
}: {
  user: User;
  onCancel: () => void;
  onConfirm: (plain: string) => void;
}) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    if (!pw) return setErr('Password is required.');
    if (pw !== confirm) return setErr('Passwords do not match.');
    onConfirm(pw);
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={`Reset password — ${user.username}`}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit}>Reset</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="New password" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
        <Input label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>
    </Modal>
  );
}
