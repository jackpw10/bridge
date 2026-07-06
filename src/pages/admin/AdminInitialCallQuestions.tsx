import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { DragList } from '../../components/ui/DragList';
import { Badge } from '../../components/ui/Badge';
import { uid } from '../../utils/id';
import type { InitialCallQuestion } from '../../types';

export function AdminInitialCallQuestionsPage() {
  const items = useAppStore((s) => s.initialCallQuestions);
  const setItems = useAppStore((s) => s.setInitialCallQuestions);

  function add() {
    setItems([...items, { id: uid('icq'), type: 'text', text: 'New question' }]);
  }
  function patch(id: string, p: Partial<InitialCallQuestion>) {
    setItems(items.map((q) => (q.id === id ? { ...q, ...p } : q)));
  }
  function remove(id: string) {
    if (!window.confirm('Delete this initial call question?')) return;
    setItems(items.filter((q) => q.id !== id));
  }
  function reorder(next: InitialCallQuestion[]) {
    setItems(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-brand-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-800">Initial Call Questions</h1>
          <p className="text-sm text-slate-500">
            Asked on the "New Case" screen before the user picks a call type.
            Answers are saved with the case and appear on the Result summary.
          </p>
        </div>
        <Button onClick={add}>+ Add question</Button>
      </div>

      <Card>
        {items.length === 0 ? (
          <div className="text-sm text-slate-400 py-4 text-center">
            No initial call questions yet. The "New Case" screen will skip
            straight to the call-type picker until you add one.
          </div>
        ) : (
          <DragList
            items={items}
            onReorder={reorder}
            renderItem={(q, handle) => (
              <div className="border rounded-md p-3 bg-white">
                <div className="flex items-start gap-2">
                  {handle}
                  <div className="flex-1 space-y-2">
                    <Input
                      label="Question text"
                      value={q.text}
                      onChange={(e) => patch(q.id, { text: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        label="Type"
                        value={q.type}
                        onChange={(e) =>
                          patch(q.id, {
                            type: e.target.value as InitialCallQuestion['type'],
                          })
                        }
                      >
                        <option value="yesno">Yes / No</option>
                        <option value="dropdown">Dropdown</option>
                        <option value="text">Free text</option>
                      </Select>
                      {q.type === 'dropdown' && (
                        <Textarea
                          label="Options (one per line)"
                          value={(q.options ?? []).join('\n')}
                          onChange={(e) =>
                            patch(q.id, {
                              options: e.target.value
                                .split('\n')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      )}
                    </div>
                    <Badge tone="slate">{q.type}</Badge>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => remove(q.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            )}
          />
        )}
      </Card>
    </div>
  );
}
