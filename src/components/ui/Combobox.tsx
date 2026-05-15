import { useMemo, useRef, useState, useEffect } from 'react';
import { cn } from '../../utils/cn';

export interface ComboOption {
  value: string;
  label: string;
  meta?: string;
}

interface Props {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Type to search…',
  label,
  disabled,
  className,
  allowEmpty,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const display =
    options.find((o) => o.value === value)?.label ?? (value ? value : '');

  useEffect(() => {
    setQuery(display);
  }, [display]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === display.toLowerCase()) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.meta ?? '').toLowerCase().includes(q)
    );
  }, [query, options, display]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {label && (
        <label className="text-xs font-medium text-slate-600 mb-1 block">
          {label}
        </label>
      )}
      <input
        type="text"
        disabled={disabled}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {allowEmpty && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-500 italic"
            >
              (none)
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No matches</div>
          ) : (
            filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  'block w-full text-left px-3 py-2 text-sm hover:bg-brand-50',
                  o.value === value && 'bg-brand-50 text-brand-700'
                )}
              >
                <div className="font-medium">{o.label}</div>
                {o.meta && (
                  <div className="text-xs text-slate-400">{o.meta}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
