import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { hashPassword, verifyPassword } from '../utils/hash';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ open, onClose }: Props) {
  const session = useAppStore((s) => s.session);
  const users = useAppStore((s) => s.users);
  const setUsers = useAppStore((s) => s.setUsers);

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function reset() {
    setOldPw('');
    setNewPw('');
    setConfirm('');
    setErr(null);
    setOk(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function submit() {
    setErr(null);
    setOk(false);
    if (!session) return;
    const me = users.find((u) => u.id === session.userId);
    if (!me) return setErr('Account not found.');
    if (!verifyPassword(oldPw, me.passwordHash)) return setErr('Current password is incorrect.');
    if (!newPw) return setErr('Enter a new password.');
    if (newPw === oldPw) return setErr('New password must be different from current password.');
    if (newPw !== confirm) return setErr('New passwords do not match.');

    setUsers(users.map((u) => (u.id === me.id ? { ...u, passwordHash: hashPassword(newPw) } : u)));
    setOk(true);
    setOldPw('');
    setNewPw('');
    setConfirm('');
  }

  if (!session) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Change password"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>Close</Button>
          <Button onClick={submit}>Update</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Current password" type="password" autoFocus value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        <Input label="New password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        <Input label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {err && <div className="text-sm text-red-600">{err}</div>}
        {ok && <div className="text-sm text-green-700">Password updated.</div>}
      </div>
    </Modal>
  );
}
