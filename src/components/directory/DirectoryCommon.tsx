import { Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { m } from '@/paraglide/messages.js';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function DirectoryBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="text-muted-foreground mb-6 flex items-center gap-1.5 text-xs font-medium">
      <Link to="/" className="hover:text-foreground transition-colors">
        {m['directory.discover']()}
      </Link>
      {items.map((item, idx) => (
        <span key={idx} className="flex items-center gap-1.5">
          <ChevronRight className="text-muted-foreground/40 size-3" />
          {item.href ? (
            <Link
              to={item.href as any}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function DirectoryPageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-[15px]">
            {subtitle}
          </p>
        )}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

export function DirectoryPagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5">
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="border-border bg-card hover:border-primary/40 hover:bg-secondary/50 inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-medium transition disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft className="size-3.5" />
        <span>{m['directory.previous']()}</span>
      </button>

      {pages.map((p) => {
        const isActive = p === currentPage;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition ${
              isActive
                ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                : 'border-border bg-card hover:border-primary/40 hover:bg-secondary/50 text-foreground border'
            }`}
          >
            {p}
          </button>
        );
      })}

      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="border-border bg-card hover:border-primary/40 hover:bg-secondary/50 inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-medium transition disabled:pointer-events-none disabled:opacity-40"
      >
        <span>{m['directory.next']()}</span>
        <ChevronRight className="size-3.5" />
      </button>
    </nav>
  );
}
