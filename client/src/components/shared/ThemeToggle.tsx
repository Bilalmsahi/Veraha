import { useEffect, useState } from 'react';
import { Moon, SunMedium } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

type ThemeToggleProps = {
  className?: string;
  variant?: 'sidebar' | 'landing';
};

export function ThemeToggle({ className, variant = 'sidebar' }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const baseClass =
    variant === 'landing'
      ? 'rounded-full border border-border bg-card p-2 text-foreground transition hover:bg-accent'
      : 'inline-flex items-center justify-center rounded-full border border-border bg-secondary p-1.5 text-foreground transition-colors duration-300 hover:bg-accent';

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(baseClass, className)}
      aria-label="Toggle theme"
      title="Toggle theme"
      disabled={!mounted}
    >
      {isDark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
