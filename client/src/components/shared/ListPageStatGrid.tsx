import { type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatGridItem = {
  label: string;
  value: number | string;
  icon?: LucideIcon;
};

type ListPageStatGridProps = {
  items: StatGridItem[];
  className?: string;
};

export function ListPageStatGrid({ items, className }: ListPageStatGridProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.label}
              </CardTitle>
              {Icon && <Icon className="size-4 text-primary" aria-hidden />}
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{item.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
