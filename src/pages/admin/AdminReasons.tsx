import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { uid } from '../../utils/id';

export function AdminReasonsPage() {
  const reasons = useAppStore((s) => s.reasons);
  const setReasons = useAppStore((s) => s.setReasons);

  function add() {
    setReasons([...reasons, { id: uid('or'), text: 'New reason' }]);
  }
  function patch(id: string, text: string) {
    setReasons(reasons.map((r) => (r.id === id ? { ...r, text } : r)));
  }
  function remove(id: string) {
    setReasons(reasons.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-800">Override reasons</h1>
        </div>
        <Button onClick={add}>+ Add</Button>
      </div>

      <Card>
        <div className="divide-y divide-slate-100">
          {reasons.map((r) => (
            <div key={r.id} className="py-3 flex items-center gap-3">
              <div className="flex-1">
                <Input value={r.text} onChange={(e) => patch(r.id, e.target.value)} />
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>Delete</Button>
            </div>
          ))}
          {reasons.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">No reasons.</div>}
        </div>
      </Card>
    </div>
  );
}
