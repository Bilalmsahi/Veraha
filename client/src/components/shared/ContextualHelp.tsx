import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  findHelpStatus,
  getHelpConfig,
  type HelpConfig,
  type HelpModuleId,
  type HelpStatus,
  type HelpTransition,
  type HelpTone,
} from '@/lib/contextualHelp';
import { EnumBadge } from './EnumBadge';

const toneToSoftTone: Record<HelpTone, 'success' | 'error' | 'warning' | 'info' | 'muted'> = {
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'info',
  muted: 'muted',
};

type CurrentHelpStatus = {
  status?: string | null;
  label?: string;
};

type HelpDrawerProps = {
  moduleId: HelpModuleId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current?: CurrentHelpStatus;
};

type ContextualHelpButtonProps = {
  moduleId: HelpModuleId;
  current?: CurrentHelpStatus;
  label?: string;
  variant?: ComponentProps<typeof Button>['variant'];
  size?: ComponentProps<typeof Button>['size'];
  className?: string;
};

function StatusPill({ item, active = false }: { item: Pick<HelpStatus, 'label' | 'tone' | 'symbol'>; active?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
        active && 'border-primary bg-primary/10 text-primary'
      )}
    >
      {item.symbol && <span aria-hidden="true">{item.symbol}</span>}
      <EnumBadge label={item.label} softTone={toneToSoftTone[item.tone]} />
    </span>
  );
}

export function LifecycleFlow({ config }: { config: HelpConfig }) {
  const vertical = config.lifecycleStyle === 'vertical';
  return (
    <div
      className={cn(
        vertical ? 'space-y-2' : 'flex flex-wrap items-center gap-2',
        config.lifecycleStyle === 'loop' && 'rounded-md border bg-muted/20 p-3'
      )}
    >
      {config.lifecycle.map((step, index) => (
        <div
          key={`${step}-${index}`}
          className={cn(
            'flex items-center gap-2',
            vertical && 'rounded-md border bg-background p-2'
          )}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <span className="text-sm font-medium">{step}</span>
          {index < config.lifecycle.length - 1 && (
            <span className={cn('text-muted-foreground', vertical && 'ml-auto rotate-90')} aria-hidden="true">
              →
            </span>
          )}
          {config.lifecycleStyle === 'loop' && index === config.lifecycle.length - 1 && (
            <span className="text-muted-foreground" aria-hidden="true">
              ↺
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function StatusMeaningCard({
  item,
  active,
}: {
  item: HelpStatus;
  active?: boolean;
}) {
  return (
    <Card className={cn('rounded-md', active && 'border-primary bg-primary/5')}>
      <CardHeader className="p-3">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <StatusPill item={item} active={active} />
          {active && <span className="text-xs font-normal text-primary">Current status</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0 text-sm">
        <p>{item.meaning}</p>
        <dl className="grid gap-2 text-xs text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">Changed by</dt>
            <dd>{item.changedBy}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Trigger</dt>
            <dd>{item.trigger}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Type</dt>
            <dd>{item.automation}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Can edit?</dt>
            <dd>{item.editable}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">UI</dt>
            <dd>{item.ui}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Readiness impact</dt>
            <dd>{item.readiness}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Next action</dt>
            <dd>{item.nextAction}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export function ReadinessImpactCard({ items }: { items: string[] }) {
  return (
    <Card className="rounded-md">
      <CardContent className="space-y-2 p-3">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-sm">
            <span className="text-primary" aria-hidden="true">•</span>
            <p>{item}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function NextActionChecklist({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 rounded-md border bg-background p-2 text-sm">
          <span className="text-primary" aria-hidden="true">✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TransitionRow({ transition }: { transition: HelpTransition }) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2 font-medium">
        <span>{transition.from}</span>
        <span className="text-muted-foreground" aria-hidden="true">→</span>
        <span>{transition.to}</span>
      </div>
      <div className="grid gap-1 text-xs text-muted-foreground">
        <p><span className="font-medium text-foreground">Trigger:</span> {transition.trigger}</p>
        <p><span className="font-medium text-foreground">Type:</span> {transition.type}</p>
        <p><span className="font-medium text-foreground">Allowed for:</span> {transition.allowedFor}</p>
        <p><span className="font-medium text-foreground">Impact:</span> {transition.impact}</p>
      </div>
    </div>
  );
}

export function TransitionMap({
  transitions,
  currentStatus,
}: {
  transitions: HelpTransition[];
  currentStatus?: string | null;
}) {
  const relevant = currentStatus
    ? transitions.filter((item) => item.from === currentStatus || item.to === currentStatus)
    : transitions;
  const visible = relevant.length > 0 ? relevant : transitions;
  return (
    <div className="space-y-2">
      {visible.map((transition) => (
        <TransitionRow key={`${transition.from}-${transition.to}-${transition.trigger}`} transition={transition} />
      ))}
    </div>
  );
}

export function FAQAccordion({ faqs }: { faqs: HelpConfig['faqs'] }) {
  return (
    <div className="space-y-2">
      {faqs.map((faq) => (
        <Collapsible key={faq.question} className="rounded-md border">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium">
            {faq.question}
            <ChevronDown className="size-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pb-3 text-sm text-muted-foreground">
            {faq.answer}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}

function HelpSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function HelpDrawer({ moduleId, open, onOpenChange, current }: HelpDrawerProps) {
  const config = getHelpConfig(moduleId);
  const currentStatus = useMemo(
    () => findHelpStatus(config, current?.status),
    [config, current?.status]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
        <SheetHeader className="border-b p-5 pr-12">
          <SheetTitle>{config.module}</SheetTitle>
          <SheetDescription>{config.shortDescription}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 p-5">
            {current?.status && (
              <Card className="rounded-md border-primary/40 bg-primary/5">
                <CardContent className="space-y-2 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">Current status</p>
                  {currentStatus ? (
                    <>
                      <StatusPill item={currentStatus} active />
                      <p className="text-sm">{currentStatus.meaning}</p>
                      <p className="text-sm text-muted-foreground">{currentStatus.nextAction}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {current.label ?? current.status} is not in this module guide yet. Use the page actions and visible validation as the source of truth.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <HelpSection title="How this module works">
              <p className="text-sm text-muted-foreground">{config.overview}</p>
            </HelpSection>

            <Separator />

            <HelpSection title="Status lifecycle">
              <LifecycleFlow config={config} />
            </HelpSection>

            <HelpSection title="What each status means">
              <div className="space-y-3">
                {config.statuses.map((item) => (
                  <StatusMeaningCard
                    key={item.key}
                    item={item}
                    active={currentStatus?.key === item.key}
                  />
                ))}
              </div>
            </HelpSection>

            <HelpSection title="How this affects readiness">
              <ReadinessImpactCard items={config.readinessImpact} />
            </HelpSection>

            <HelpSection title="What to do next">
              <NextActionChecklist items={currentStatus ? [currentStatus.nextAction] : config.nextActions} />
            </HelpSection>

            <HelpSection title="Transitions">
              <TransitionMap transitions={config.transitions} currentStatus={currentStatus?.key} />
            </HelpSection>

            <HelpSection title="Common questions">
              <FAQAccordion faqs={config.faqs} />
            </HelpSection>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function ContextualHelpButton({
  moduleId,
  current,
  label = 'Help',
  variant = 'outline',
  size = 'sm',
  className,
}: ContextualHelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn('gap-2', className)}
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="size-4" />
        {label}
      </Button>
      <HelpDrawer moduleId={moduleId} open={open} onOpenChange={setOpen} current={current} />
    </>
  );
}
