export function paginationWindow<T>(items: readonly T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  return {
    pageCount,
    currentPage,
    rows: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    total: items.length,
  };
}
