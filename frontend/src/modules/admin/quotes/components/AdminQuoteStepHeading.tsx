type Props = { number: number; title: string };

export function AdminQuoteStepHeading({ number, title }: Props) {
  return (
    <div className="admin-quote-step-heading" data-step={number}>
      <span className="admin-quote-step-number">{number}</span>
      <span>{title}</span>
      <i aria-hidden="true" />
    </div>
  );
}
