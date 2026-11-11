import { useEffect, useMemo, useState } from 'react';
import { paginationWindow } from '../services/pagination';

export function usePagination<T>(items: readonly T[], pageSize: number, resetKey = '') {
  const [page, setPage] = useState(1);
  const { pageCount, currentPage, rows, total } = useMemo(
    () => paginationWindow(items, page, pageSize),
    [items, page, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return { page: currentPage, pageCount, rows, setPage, total };
}
