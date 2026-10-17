import { ChevronLeft, ChevronRight } from 'lucide-react';
import { messages } from '../content/fr';

export function Pagination({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="pagination" aria-label={messages.pagination}>
      <span>{messages.resultatsPaginees(total, page, pageCount)}</span>
      <div>
        <button
          type="button"
          className="icon-button"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={messages.pagePrecedente}
        >
          <ChevronLeft size={17} />
        </button>
        <strong aria-current="page">{page}</strong>
        <button
          type="button"
          className="icon-button"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label={messages.pageSuivante}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </nav>
  );
}
