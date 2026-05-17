import { useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Card } from '../components/ui/Card';
import { Combobox } from '../components/ui/Combobox';
import { Input } from '../components/ui/Input';

export function ReferenceCardsPage() {
  const cards = useAppStore((s) => s.refCards);

  const [pickedId, setPickedId] = useState('');
  const [filter, setFilter] = useState('');

  const options = useMemo(
    () =>
      cards.map((c) => ({
        value: c.id,
        label: c.name,
        meta: c.code,
      })),
    [cards]
  );

  const filteredList = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.code ?? '').toLowerCase().includes(q) ||
        (c.body ?? '').toLowerCase().includes(q)
    );
  }, [cards, filter]);

  const picked = cards.find((c) => c.id === pickedId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Reference cards</h1>
        <p className="text-sm text-slate-500">
          Quick lookup for protocols, checklists, and other reference material.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <Card title="Quick pick">
            <Combobox
              options={options}
              value={pickedId}
              onChange={setPickedId}
              allowEmpty
              placeholder="Type to find by name or code…"
            />
          </Card>

          <Card title="Browse">
            <Input
              placeholder="Filter list…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {filteredList.length === 0 ? (
              <div className="text-sm text-slate-400 mt-3">No matches.</div>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {filteredList.map((c) => {
                  const isPicked = c.id === pickedId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setPickedId(c.id)}
                        className={`block w-full text-left py-2 px-1 rounded ${
                          isPicked ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-medium text-sm">{c.name}</div>
                        {c.code && <div className="text-xs text-slate-500">code: {c.code}</div>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          {!picked ? (
            <Card>
              <div className="text-sm text-slate-500">
                Pick a reference card to view its contents.
              </div>
            </Card>
          ) : (
            <Card title={picked.name} description={picked.code ? `code: ${picked.code}` : undefined}>
              {picked.body && (
                <p className="text-sm whitespace-pre-wrap text-slate-700 mb-3">{picked.body}</p>
              )}
              {picked.steps.length > 0 && (
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  {picked.steps.map((s) => (
                    <li key={s.id}>{s.text}</li>
                  ))}
                </ol>
              )}
              {!picked.body && picked.steps.length === 0 && (
                <div className="text-sm text-slate-400">
                  This card has no body or steps.
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
