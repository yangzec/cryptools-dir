import { Link } from '@tanstack/react-router';

import { m } from '@/paraglide/messages.js';

interface CategoryStripProps {
  categories?: Array<{
    slug: string;
    name?: string;
  }>;
}

export function CategoryStrip({ categories = [] }: CategoryStripProps) {
  return (
    <nav className="scrollbar-none -mx-4 mt-6 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <Link
        to="/tools"
        aria-current="page"
        className="border-primary bg-primary text-primary-foreground inline-flex h-8 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition"
      >
        {m['directory.all']()}
      </Link>

      {categories.map((cat) => (
        <Link
          key={cat.slug}
          to={`/categories/${cat.slug}` as any}
          className="border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground inline-flex h-8 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition"
        >
          {cat.name || cat.slug}
        </Link>
      ))}
    </nav>
  );
}
