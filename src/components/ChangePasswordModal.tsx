import { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { changeOwnPassword, signIn } from '../lib/auth';
import { useAppStore } from '../store/appStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ open, onClose }: Props) {
  const session = useAppStore((s) => s.session);

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

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

  async function submit() {
    setErr(null);
    setOk(false);
    if (!session) return;
    if (!oldPw) return setErr('Enter your current password.');
    if (newPw.length < 6) return setErr('New password must be at least 6 characters.');
    if (newPw === oldPw) return setErr('New password must be different from current password.');
    if (newPw !== confirm) return setErr('New passwords do not match.');

    setBusy(true);
    // Verify current password by re-signing in (Supabase doesn't have a
    // dedicated "verify current password" endpoint).
    const { error: verifyErr } = await signIn(session.email, oldPw);
    if (verifyErr) {
      setBusy(false);
      setErr('Current password is incorrect.');
      return;
    }
    const { error } = await changeOwnPassword(newPw);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
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
          <Button onClick={submit} disabled={busy}>{busy ? 'Updating…' : 'Update'}</Button>
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
