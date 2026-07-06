import { useState, type KeyboardEvent } from 'react';
import { Textarea } from './Input';

interface Props {
  // The whole appended log so far. Timestamped lines joined by newlines.
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

// A 3-row textarea input that appends its content to `value` as a
// timestamped line on Enter (without Shift). Shift+Enter still inserts a
// newline inside the draft. Below the input, the log is rendered read-only
// so entries stay visible without editing.
export function NotesLog({
  value,
  onChange,
  placeholder = 'Type a note, press Enter to save…',
}: Props) {
  const [draft, setDraft] = useState('');

  function submit() {
    const line = draft.trim();
    if (!line) return;
    const ts = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const entry = `[${ts}] ${line}`;
    onChange(value ? `${value}\n${entry}` : entry);
    setDraft('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

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
