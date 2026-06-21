import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

const LIKELIHOOD_RUBRICS = [
  {
    value: 1,
    label: '1 - Not likely',
    subtext:
      'Adversary is unlikely to initiate a threat event; non-adversarial threat event is unlikely to occur.',
  },
  {
    value: 2,
    label: '2 - Somewhat likely',
    subtext:
      'Adversary is somewhat unlikely to initiate a threat event; non-adversarial threat event could occur.',
  },
  {
    value: 3,
    label: '3 - Very likely',
    subtext:
      'Adversary is highly likely to initiate a threat event; non-adversarial threat event is expected to occur.',
  },
];

const IMPACT_RUBRICS = [
  {
    value: 1,
    label: '1 - Not impactful',
    subtext:
      'A threat event could be expected to have a limited adverse effect on organizational operations, assets, or individuals.',
  },
  {
    value: 2,
    label: '2 - Somewhat impactful',
    subtext:
      'A threat event could be expected to have a serious adverse effect on organizational operations, assets, or individuals.',
  },
  {
    value: 3,
    label: '3 - Very impactful',
    subtext:
      'A threat event could be expected to have a severe or catastrophic adverse effect on organizational operations, assets, or individuals.',
  },
];

type RubricsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RubricsDrawer({ open, onOpenChange }: RubricsDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-md"
        showCloseButton
      >
        <SheetHeader className="border-b border-border/60 pb-4">
          <SheetTitle>Risk scoring rubrics</SheetTitle>
          <SheetDescription>
            Use these scales to assess likelihood and impact for inherent and residual risk.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 -mr-4 pr-4 pt-4">
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 font-semibold text-sm">Likelihood (1–3)</h3>
              <ul className="space-y-3">
                {LIKELIHOOD_RUBRICS.map((r) => (
                  <li key={r.value} className="rounded-lg border p-3">
                    <p className="font-medium text-sm">{r.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.subtext}</p>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-3 font-semibold text-sm">Impact (1–3)</h3>
              <ul className="space-y-3">
                {IMPACT_RUBRICS.map((r) => (
                  <li key={r.value} className="rounded-lg border p-3">
                    <p className="font-medium text-sm">{r.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.subtext}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export { LIKELIHOOD_RUBRICS, IMPACT_RUBRICS };
