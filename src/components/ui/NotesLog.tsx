import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Textarea } from './Input';

interface Props {
  // The whole appended log so far. Timestamped lines joined by newlines.
  value: string;
  onChange: (next: string) => void;
  // Called with the timestamped entry text every time a line is saved
  // (Enter or auto-flush on unmount). Callers use this to log an event.
  onEntry?: (entry: string, ts: number) => void;
  placeholder?: string;
}

// A 3-row textarea input that appends its content to `value` as a
// timestamped line on Enter (without Shift). Shift+Enter still inserts a
// newline inside the draft. Below the input the log renders read-only.
//
// If the component unmounts (page nav) or the browser window is closing
// with a non-empty draft, the draft is flushed to the log automatically
// so notes aren't lost.
export function NotesLog({
  value,
  onChange,
  onEntry,
  placeholder = 'Type a note, press Enter to save…',
}: Props) {
  const [draft, setDraft] = useState('');

  // Refs mirror the latest props/state so unmount + beforeunload handlers
  // (which capture their closure at mount time) still see fresh values.
  const draftRef = useRef(draft);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onEntryRef = useRef(onEntry);
  draftRef.current = draft;
  valueRef.current = value;
  onChangeRef.current = onChange;
  onEntryRef.current = onEntry;

  function makeEntry(text: string): { entry: string; ts: number } {
    const now = new Date();
    const ts = now.getTime();
    const stamp = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return { entry: `[${stamp}] ${text}`, ts };
  }

  function flushDraft() {
    const line = draftRef.current.trim();
    if (!line) return;
    const { entry, ts } = makeEntry(line);
    onChangeRef.current(valueRef.current ? `${valueRef.current}\n${entry}` : entry);
    onEntryRef.current?.(entry, ts);
    draftRef.current = '';
    setDraft('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      flushDraft();
    }
  }

  // Auto-save on browser close / reload.
  useEffect(() => {
    function onBeforeUnload() {
      flushDraft();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Auto-save on component unmount (route change etc.).
  useEffect(() => {
    return () => {
      flushDraft();
    };
  }, []);

  return (
    <div className="space-y-2">
      <Textarea
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
      {value && (
        <pre className="text-xs whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded p-3 max-h-64 overflow-y-auto">
          {value}
        </pre>
      )}
    </div>
  );
}
