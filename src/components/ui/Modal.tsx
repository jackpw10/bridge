import { type ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
}

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

// Closes only via the X button (or the explicit footer cancel button).
// Clicking the backdrop or pressing Escape will NOT dismiss the modal, so a
// stray click can't lose unsaved edits.
export function Modal({ open, onClose, title, children, size = 'md', footer }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4"
    >
      <div
        className={cn(
          'bg-white rounded-lg shadow-xl w-full my-8 flex flex-col',
          sizeMap[size]
        )}
      >
        {title && (
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
