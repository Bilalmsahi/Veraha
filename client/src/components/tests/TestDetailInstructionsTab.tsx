import { Card, CardContent } from '@/components/ui/card';
import { InstructionContent } from '@/components/shared/InstructionContent';

type TestDetailInstructionsTabProps = {
  instructions?: string;
  evidenceGuidance?: string;
};

export function TestDetailInstructionsTab({
  instructions,
  evidenceGuidance,
}: TestDetailInstructionsTabProps) {
  const hasAny = Boolean(instructions?.trim()) || Boolean(evidenceGuidance?.trim());

  if (!hasAny) {
    return (
      <p className="text-sm text-muted-foreground">No instructions provided for this test.</p>
    );
  }

  return (
    <div className="space-y-6">
      {instructions?.trim() ? (
        <Card className="border-border/80 dark:bg-[#3A5255]/20">
          <CardContent className="pt-6">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Implementation guidance
            </h2>
            <InstructionContent
              content={instructions}
              className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground"
            />
          </CardContent>
        </Card>
      ) : null}
      {evidenceGuidance?.trim() ? (
        <Card className="border-border/80 dark:bg-[#3A5255]/20">
          <CardContent className="pt-6">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Evidence collection
            </h2>
            <InstructionContent
              content={evidenceGuidance}
              className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
