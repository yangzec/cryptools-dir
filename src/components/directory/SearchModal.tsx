import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CornerDownLeft, Search } from 'lucide-react';

import { getDirectoryToolsFn } from '@/modules/directory/server';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

type SearchTool = {
  slug: string;
  name: string;
  tagline?: string | null;
  iconUrl?: string | null;
  categoryName?: string | null;
};

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tools?: SearchTool[];
}

export function SearchModal({ isOpen, onClose, tools }: SearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dbTools, setDbTools] = useState<SearchTool[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || tools || dbTools) return;
    let cancelled = false;
    getDirectoryToolsFn({
      data: { locale: getLocale(), pageSize: 500 },
    })
      .then((result) => {
        if (cancelled) return;
        setDbTools(result?.items?.length ? result.items : []);
      })
      .catch(() => {
        if (!cancelled) setDbTools([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, tools, dbTools]);

  const allTools = tools ?? dbTools ?? [];

  const filtered = useMemo(() => {
    if (!query.trim()) return allTools.slice(0, 8);
    const q = query.toLowerCase();
    return allTools.filter((t) => {
      const tagline = (t.tagline || '').toLowerCase();
      const category = (t.categoryName || '').toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        tagline.includes(q) ||
        category.includes(q)
      );
    });
  }, [allTools, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleSelect = (slug: string) => {
    onClose();
    navigate({ to: `/tools/${slug}` as any });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        Math.min(prev + 1, Math.max(0, filtered.length - 1))
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filtered[selectedIndex];
      if (selected) {
        handleSelect(selected.slug);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16 sm:pt-20">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="border-border bg-card animate-in fade-in-50 zoom-in-95 relative w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl duration-150">
        {/* Search Input */}
        <div className="border-border flex items-center gap-3 border-b px-4">
          <Search className="text-muted-foreground size-5 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={m['directory.search_placeholder']()}
            autoFocus
            role="combobox"
            aria-expanded={true}
            aria-controls="dir-search-results"
            className="text-foreground placeholder:text-muted-foreground/80 h-14 min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          <kbd
            onClick={onClose}
            className="border-border text-muted-foreground hidden shrink-0 cursor-pointer rounded border px-1.5 py-0.5 font-sans text-[11px] sm:inline-block"
          >
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          id="dir-search-results"
          role="listbox"
          className="max-h-[60vh] overflow-y-auto p-2"
        >
          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-3 py-10 text-center text-sm">
              {m['directory.search_no_results']({ query })}
            </p>
          ) : (
            <div>
              <p className="text-muted-foreground px-3 pt-3 pb-1.5 text-xs font-medium">
                {query.trim()
                  ? m['directory.search_tools_heading']()
                  : m['directory.search_featured_tools']()}
              </p>
              <div className="space-y-0.5">
                {filtered.map((tool, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <div
                      key={tool.slug}
                      data-index={index}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(tool.slug)}
                      onMouseMove={() =>
                        index !== selectedIndex && setSelectedIndex(index)
                      }
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition',
                        isSelected ? 'bg-primary/10' : 'hover:bg-muted/60'
                      )}
                    >
                      <div className="border-border/60 bg-muted/40 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                        {tool.iconUrl ? (
                          <img
                            src={tool.iconUrl}
                            alt={tool.name}
                            width={36}
                            height={36}
                            className="size-full object-cover"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs font-bold uppercase">
                            {tool.name.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline gap-2">
                          <span className="truncate font-medium">
                            {tool.name}
                          </span>
                          {tool.categoryName ? (
                            <span className="text-muted-foreground shrink-0 text-xs">
                              {tool.categoryName}
                            </span>
                          ) : null}
                        </p>
                        {tool.tagline ? (
                          <p className="text-muted-foreground truncate text-[13px]">
                            {tool.tagline}
                          </p>
                        ) : null}
                      </div>
                      {isSelected ? (
                        <CornerDownLeft className="text-muted-foreground size-3.5 shrink-0" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Hints */}
        <div className="border-border text-muted-foreground hidden items-center gap-4 border-t px-4 py-2 text-[11px] sm:flex">
          <span>↑↓ {m['directory.search_navigate']()}</span>
          <span>↵ {m['directory.search_open']()}</span>
          <span>Esc {m['directory.search_close']()}</span>
        </div>
      </div>
    </div>
  );
}
