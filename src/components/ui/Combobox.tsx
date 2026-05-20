import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useEffect,
  type KeyboardEvent,
} from 'react';
import { cn } from '../../utils/cn';

export interface ComboOption {
  value: string;
  label: string;
  meta?: string;
}

// Imperative handle so a parent can move focus into the combobox (which also
// opens its dropdown, since the input opens on focus).
export interface ComboboxHandle {
  focus: () => void;
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
  autoFocus?: boolean;
}

export const Combobox = forwardRef<ComboboxHandle, Props>(function Combobox(
  {
    options,
    value,
    onChange,
    placeholder = 'Type to search…',
    label,
    disabled,
    className,
    allowEmpty,
    autoFocus,
  },
  ref,
) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

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

  // Items the keyboard can land on. Index 0 reserved for "(none)" if allowed.
  const navItems = useMemo(() => {
    const items: Array<{ kind: 'none' } | { kind: 'opt'; opt: ComboOption }> = [];
    if (allowEmpty) items.push({ kind: 'none' });
    for (const o of filtered) items.push({ kind: 'opt', opt: o });
    return items;
  }, [allowEmpty, filtered]);

  // Reset highlight when the list changes or the popup opens.
  useEffect(() => {
    setActiveIndex(0);
  }, [filtered, open]);

  // Scroll the active item into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function commit(idx: number) {
    const item = navItems[idx];
    if (!item) return;
    if (item.kind === 'none') {
      onChange('');
    } else {
      onChange(item.opt.value);
    }
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(navItems.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(navItems.length - 1);
    } else if (e.key === 'Enter') {
      if (open && navItems.length > 0) {
        e.preventDefault();
        commit(activeIndex);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {label && (
        <label className="text-xs font-medium text-slate-600 mb-1 block">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {navItems.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No matches</div>
          ) : (
            navItems.map((item, idx) => {
              const isActive = idx === activeIndex;
              if (item.kind === 'none') {
                return (
                  <button
                    type="button"
                    key="__none"
                    data-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => commit(idx)}
                    className={cn(
                      'block w-full text-left px-3 py-2 text-sm text-slate-500 italic',
                      isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
                    )}
                  >
                    (none)
                  </button>
                );
              }
              const o = item.opt;
              const isSelected = o.value === value;
              return (
                <button
                  type="button"
                  key={o.value}
                  data-idx={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => commit(idx)}
                  className={cn(
                    'block w-full text-left px-3 py-2 text-sm',
                    isActive && 'bg-brand-100',
                    !isActive && isSelected && 'bg-brand-50 text-brand-700',
                    !isActive && !isSelected && 'hover:bg-brand-50'
                  )}
                >
                  <div className="font-medium">{o.label}</div>
                  {o.meta && (
                    <div className="text-xs text-slate-400">{o.meta}</div>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
});
