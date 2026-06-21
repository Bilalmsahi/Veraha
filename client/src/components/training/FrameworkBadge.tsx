import { Badge } from '@/components/ui/badge';
import { frameworkTagLabel } from './frameworkLabels';

export function FrameworkBadge({ tag }: { tag: string }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {frameworkTagLabel(tag)}
    </Badge>
  );
}
