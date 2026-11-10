import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

type Props = {
  number: number;
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  onNext: () => void;
  nextLabel: string;
  collapsible: boolean;
  showHeading?: boolean;
  children: ReactNode;
};

export function AdminQuoteStep({
  number,
  title,
  summary,
  expanded,
  onToggle,
  onNext,
  nextLabel,
  collapsible,
  showHeading = true,
  children,
}: Props) {
  if (!collapsible) {
    if (!showHeading) return <>{children}</>;
    return (
      <>
        <div className="admin-quote-step-heading" data-step={number}>
          <span className="admin-quote-step-number">{number}</span>
          <span>{title}</span>
          <i aria-hidden="true" />
        </div>
        {children}
      </>
    );
  }

  return (
    <section className="admin-quote-step">
      <button
        className="admin-quote-step-heading"
        data-step={number}
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="admin-quote-step-number">{number}</span>
        <span className="admin-quote-step-copy">
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        <ChevronDown
          className="admin-quote-step-chevron"
          size={18}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <div className="admin-quote-step-content">
          {children}
          <button className="admin-quote-step-next" type="button" onClick={onNext}>
            {nextLabel}
          </button>
        </div>
      )}
    </section>
  );
}
