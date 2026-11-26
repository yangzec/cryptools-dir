'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { useAppearance } from '@/hooks/use-appearance';
import { Button } from '@/components/ui/button';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { colorModeForced } = useAppearance();

  if (colorModeForced) return null;

  const currentTheme = resolvedTheme || theme;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('size-8 cursor-pointer', className)}
      onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
      aria-label={m['common.theme.toggle']()}
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
