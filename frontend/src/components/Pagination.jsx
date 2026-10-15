import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZE = 35;

/** Client-side paging. Resets to page 1 when `resetKey` changes and clamps when the list shrinks. */
export function usePagination(items, { pageSize = PAGE_SIZE, resetKey = '' } = {}) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => { setPage(1); }, [resetKey]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const current = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize],
  );
  return { page: current, setPage, pageCount, pageItems, total, pageSize };
}

function windowedPages(page, pageCount) {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((n, index) => {
    if (index && n - sorted[index - 1] > 1) out.push('gap-' + n);
    out.push(n);
  });
  return out;
}

export default function Pagination({ page, pageCount, total, pageSize = PAGE_SIZE, onPage }) {
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="pager" aria-label="Pagination">
      <span className="pager-info">Showing {from}–{to} of {total}</span>
      <div className="pager-controls">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={15} /></button>
        {windowedPages(page, pageCount).map((entry) => (typeof entry === 'string'
          ? <span key={entry} className="pager-gap" aria-hidden="true">…</span>
          : (
            <button type="button" key={entry} className={entry === page ? 'is-active' : ''} aria-current={entry === page ? 'page' : undefined} onClick={() => onPage(entry)}>{entry}</button>
          )))}
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Next page"><ChevronRight size={15} /></button>
      </div>
    </nav>
  );
}
