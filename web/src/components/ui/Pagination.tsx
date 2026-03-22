/**
 * Pagination component
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisible?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  maxVisible = 5,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getVisiblePages();

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg bg-cyber-card border border-cyber-border/50 text-cyber-muted hover:text-white hover:border-neon-cyan/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex items-center gap-1">
        {pages.map((page, index) =>
          typeof page === 'number' ? (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-w-[40px] h-10 px-3 rounded-lg font-medium text-sm transition-all ${
                page === currentPage
                  ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50'
                  : 'bg-cyber-card border border-cyber-border/50 text-cyber-muted hover:text-white hover:border-cyber-border'
              }`}
            >
              {page}
            </button>
          ) : (
            <span key={`ellipsis-${index}`} className="px-2 text-cyber-muted">
              {page}
            </span>
          )
        )}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg bg-cyber-card border border-cyber-border/50 text-cyber-muted hover:text-white hover:border-neon-cyan/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
