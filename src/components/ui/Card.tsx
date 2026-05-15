import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function Card({ title, description, children, className, actions }: CardProps) {
  return (
    <div className={cn('bg-white border border-slate-200 rounded-lg shadow-sm', className)}>
      {(title || description || actions) && (
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            )}
            {description && (
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          {actions && <div className="shrink-0 flex gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
