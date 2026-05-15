import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { DragList } from '../../components/ui/DragList';
import type { ReferenceCard } from '../../types';
import { uid } from '../../utils/id';

export function AdminReferenceCardsPage() {
  const cards = useAppStore((s) => s.refCards);
  const setCards = useAppStore((s) => s.setRefCards);
  const [editing, setEditing] = useState<ReferenceCard | null>(null);

  function newCard(): ReferenceCard {
    return { id: uid('rc'), name: 'New reference card', code: '', body: '', steps: [] };
  }

  function save(c: ReferenceCard) {
    const exists = cards.some((x) => x.id === c.id);
    setCards(exists ? cards.map((x) => (x.id === c.id ? c : x)) : [...cards, c]);
  }
  function remove(id: string) {
    if (!window.confirm('Delete this reference card?')) return;
    setCards(cards.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-800">Reference cards</h1>
        </div>
        <Button onClick={() => setEditing(newCard())}>+ New</Button>
      </div>

      <Card>
        <div className="divide-y divide-slate-100">
          {cards.map((c) => (
            <div key={c.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-800">{c.name}</div>
                <div className="text-xs text-slate-500">
                  {c.code ? `code: ${c.code} · ` : ''}{c.steps.length} step{c.steps.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>Delete</Button>
              </div>
            </div>
          ))}
          {cards.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">No reference cards.</div>}
        </div>
      </Card>

      {editing && (
        <ReferenceCardEditor
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(c) => { save(c); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ReferenceCardEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: ReferenceCard;
  onSave: (c: ReferenceCard) => void;
  onCancel: () => void;
}) {
  const [c, setC] = useState<ReferenceCard>(initial);

  function patch<K extends keyof ReferenceCard>(k: K, v: ReferenceCard[K]) {
    setC((cur) => ({ ...cur, [k]: v }));
  }

  return (
    <Modal open onClose={onCancel} size="lg" title="Reference card" footer={
      <>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(c)}>Save</Button>
      </>
    }>
      <div className="space-y-3">
        <Input label="Name" value={c.name} onChange={(e) => patch('name', e.target.value)} />
        <Input label="Lookup code (optional)" value={c.code ?? ''} onChange={(e) => patch('code', e.target.value)} />
        <Textarea label="Body" value={c.body ?? ''} onChange={(e) => patch('body', e.target.value)} />
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-700">Steps</h4>
            <Button size="sm" onClick={() => patch('steps', [...c.steps, { id: uid('rcs'), text: 'New step' }])}>+ Add</Button>
          </div>
          <DragList
            items={c.steps}
            onReorder={(n) => patch('steps', n)}
            renderItem={(s, handle) => (
              <div className="flex items-start gap-2 border rounded-md p-2 bg-white">
                {handle}
                <div className="flex-1">
                  <Textarea value={s.text} onChange={(e) => patch('steps', c.steps.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x)))} />
                </div>
                <Button size="sm" variant="ghost" onClick={() => patch('steps', c.steps.filter((x) => x.id !== s.id))}>Delete</Button>
              </div>
            )}
          />
        </div>
      </div>
    </Modal>
  );
}
