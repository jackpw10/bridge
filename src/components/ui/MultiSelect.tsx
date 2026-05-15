import { useEffect, useRef, useState, useMemo } from 'react';
import { cn } from '../../utils/cn';
import type { ComboOption } from './Combobox';

interface Props {
  options: ComboOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Pick one or more…',
  label,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const labelOf = (v: string) =>
    options.find((o) => o.value === v)?.label ?? v;

  function toggle(v: string) {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      {label && (
        <label className="text-xs font-medium text-slate-600 mb-1 block">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-[38px] text-left px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {value.length === 0 ? (
          <span className="text-slate-400">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {value.map((v) => (
              <span
                key={v}
                className="bg-brand-100 text-brand-800 text-xs px-2 py-0.5 rounded inline-flex items-center gap-1"
              >
                {labelOf(v)}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                  className="text-brand-600 hover:text-brand-900 cursor-pointer"
                >
                  &times;
                </span>
              </span>
            ))}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-72 overflow-y-auto">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No matches</div>
          ) : (
            filtered.map((o) => (
              <label
                key={o.value}
                className={cn(
                  'flex items-center px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer'
                )}
              >
                <input
                  type="checkbox"
                  checked={value.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  className="mr-2"
                />
                <span>{o.label}</span>
                {o.meta && (
                  <span className="ml-2 text-xs text-slate-400">{o.meta}</span>
                )}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
