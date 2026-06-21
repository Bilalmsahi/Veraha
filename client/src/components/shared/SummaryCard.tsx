import { type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ProgressBar } from './ProgressBar';
import { cn } from '@/lib/utils';

type SummaryCardProps = {
  title: string;
  icon?: LucideIcon;
  needsAttention?: number;
  current: number;
  total: number;
  to?: string;
  linkLabel?: string;
  className?: string;
};

export function SummaryCard({
  title,
  icon: Icon,
  needsAttention = 0,
  current,
  total,
  to,
  linkLabel,
  className,
}: SummaryCardProps) {
  return (
    <Card className={cn('transition-colors hover:border-primary/30', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && <Icon className="size-4 text-primary" />}
      </CardHeader>
      <CardContent>
        {needsAttention > 0 && (
          <p className="text-sm text-[var(--color-warning)]">
            Needs attention: {needsAttention}
          </p>
        )}
        <ProgressBar current={current} total={total} showCount />
        {to && (
          <Link
            to={to}
            className="mt-3 flex items-center text-sm font-medium text-primary hover:underline"
          >
            {linkLabel ?? 'View'}
            <ChevronRight className="ml-1 size-4" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
