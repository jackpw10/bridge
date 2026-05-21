import { useEffect, useRef, useState, useMemo, type KeyboardEvent } from 'react';
import { cn } from '../../utils/cn';
import type { ComboOption } from './Combobox';

interface Props {
  options: ComboOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  autoFocus?: boolean;
  // When true, pressing Enter with a non-empty filter that matches no option
  // adds the typed text itself as a value (free-text entry).
  allowCreate?: boolean;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Pick one or more…',
  label,
  className,
  autoFocus,
  allowCreate,
}: Props) {
  const [open, setOpen] = useState(!!autoFocus);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    setActiveIndex(0);
  }, [filtered, open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const labelOf = (v: string) =>
    options.find((o) => o.value === v)?.label ?? v;

  function toggle(v: string) {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  }

  function onFilterKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (e.key === 'Enter') {
      if (filtered.length > 0) {
        e.preventDefault();
        const o = filtered[activeIndex];
        if (o) toggle(o.value);
      } else if (allowCreate) {
        // No option matches — add the typed text itself as a value. We do NOT
        // preventDefault here so the page-level Enter handler can advance to
        // the next question once this new value lands in the answer.
        const text = query.trim();
        if (text && !value.includes(text)) onChange([...value, text]);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  // Open on ArrowDown/Enter while the trigger button is focused.
  function onButtonKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
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
        onKeyDown={onButtonKeyDown}
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
        <div
          ref={listRef}
          className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-72 overflow-y-auto"
        >
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onFilterKeyDown}
              placeholder="Filter…"
              className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-400"
              role="combobox"
              aria-expanded
            />
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">
              {allowCreate && query.trim()
                ? `Press Enter to add “${query.trim()}”`
                : 'No matches'}
            </div>
          ) : (
            filtered.map((o, idx) => {
              const isActive = idx === activeIndex;
              const checked = value.includes(o.value);
              return (
                <label
                  key={o.value}
                  data-idx={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm cursor-pointer',
                    isActive ? 'bg-brand-100' : 'hover:bg-slate-50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(o.value)}
                    className="mr-2"
                  />
                  <span>{o.label}</span>
                  {o.meta && (
                    <span className="ml-2 text-xs text-slate-400">{o.meta}</span>
                  )}
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
