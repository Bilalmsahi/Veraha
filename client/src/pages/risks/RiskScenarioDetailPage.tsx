import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog, ContextualHelpButton, FormErrorAlert, DetailPageHeader } from '@/components/shared';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RiskMapControlsModal,
  RiskCommentsPanel,
  RubricsDrawer,
  EditRiskDescriptionModal,
  RiskBadge,
} from '@/components/risks';
import { useRisk, useRiskAssessments, useUpdateRisk, useApproveRisk, useArchiveRisk, useSubmitRiskApproval } from '@/api/risks';
import { useUsers } from '@/api/users';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate, timeAgo } from '@/lib/formatters';
import {
  ArrowLeft,
  MoreHorizontal,
  CircleDot,
  User,
  Lock,
  FileSpreadsheet,
  History as HistoryIcon,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LIKELIHOOD_RUBRICS, IMPACT_RUBRICS } from '@/components/risks/RubricsDrawer';
import { ShieldAlert, ShieldCheck, Shield } from 'lucide-react';

type RiskScoreLevel = 'Low' | 'Medium' | 'High';

function calculateRiskScore(
  likelihood: number | null | undefined,
  impact: number | null | undefined
): { score: number; level: RiskScoreLevel } | null {
  if (likelihood == null || impact == null) return null;

  const l = Math.min(Math.max(Number(likelihood), 1), 3);
  const i = Math.min(Math.max(Number(impact), 1), 3);
  const score = l * i;

  if (score >= 7) return { score, level: 'High' };
  if (score >= 3) return { score, level: 'Medium' };
  return { score, level: 'Low' };
}

// Risk score badge component - displays score from backend data
function RiskScoreBadge({
  score,
  level,
  label
}: {
  score: number | null | undefined;
  level: string | null | undefined;
  label?: string;
}) {
  if (score == null || !level) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-muted-foreground/30 px-2 py-1 text-xs text-muted-foreground">
        <span>—</span>
        {label && <span className="opacity-70">{label}</span>}
      </div>
    );
  }

  const config: Record<string, { bg: string; border: string; text: string; icon: typeof ShieldAlert }> = {
    Low: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800/60',
      text: 'text-emerald-700 dark:text-emerald-300',
      icon: ShieldCheck,
    },
    Medium: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800/60',
      text: 'text-amber-700 dark:text-amber-300',
      icon: Shield,
    },
    High: {
      bg: 'bg-red-50 dark:bg-red-950/40',
      border: 'border-red-200 dark:border-red-800/60',
      text: 'text-red-700 dark:text-red-300',
      icon: ShieldAlert,
    },
  };

  const c = config[level] ?? config.Low;
  const Icon = c.icon;

  return (
    <div className={cn('inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm', c.bg, c.border)}>
      <Icon className={cn('size-4', c.text)} />
      <span className={cn('font-bold', c.text)}>{score}</span>
      <span className={cn('text-[10px] font-medium uppercase tracking-wider', c.text)}>{level}</span>
      {label && <span className="text-[10px] text-muted-foreground/60 uppercase">{label}</span>}
    </div>
  );
}


const TREATMENT_OPTIONS = [
  { value: 'MITIGATE', label: 'Mitigate' },
  { value: 'ACCEPT', label: 'Accept' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'AVOID', label: 'Avoid' },
];

const CIA_OPTIONS = ['Confidentiality', 'Integrity', 'Availability'] as const;
type CiaCategory = (typeof CIA_OPTIONS)[number];

const RISK_CATEGORY_OPTIONS = [
  'Access control',
  'Artificial intelligence',
  'Asset management',
  'Business continuity and disaster recovery',
  'Communications security',
  'Compliance',
  'Cryptography',
  'Environmental, social, and governance',
  'Fraud',
  'Incident response management',
  'Information security operations',
  'Information security policies',
  'Operations security',
  'People operations',
  'Physical and environmental security',
  'Privacy',
  'Software development and acquisition',
  'Trustworthiness',
  'Uncategorized',
  'Vendor relationships',
];

const TABS = [
  { id: 'overview', label: 'Overview', icon: FileSpreadsheet },
  { id: 'history', label: 'Assessment history', icon: HistoryIcon },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
] as const;

export function RiskScenarioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('overview');
  const [rubricsOpen, setRubricsOpen] = useState(false);
  const [mapControlsOpen, setMapControlsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [ciaTags, setCiaTags] = useState<CiaCategory[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [likelihoodDraft, setLikelihoodDraft] = useState<number | null>(null);
  const [impactDraft, setImpactDraft] = useState<number | null>(null);
  const [residualLikelihoodDraft, setResidualLikelihoodDraft] = useState<number | null>(null);
  const [residualImpactDraft, setResidualImpactDraft] = useState<number | null>(null);
  const [selectedApproverIds, setSelectedApproverIds] = useState<string[]>([]);
  
  const risk = useRisk(id ?? null);
  const assessments = useRiskAssessments(id ?? null);
  const updateRisk = useUpdateRisk();
  const approveRisk = useApproveRisk();
  const submitRiskApproval = useSubmitRiskApproval();
  const archiveRisk = useArchiveRisk();
  const usersData = useUsers({ limit: 100 });
  const currentUser = useAuthStore((s) => s.user);
  const permissions = usePermissions();
  const orgUsers = usersData.data?.users ?? [];

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const r = risk.data;
    if (!r) return;
    setCiaTags(r.ciaCategories ?? []);
    const initialCategories =
      r.categories && r.categories.length > 0
        ? r.categories
        : r.category
          ? [r.category]
          : [];
    setCategories(initialCategories);
    setNotes(r.assessmentNotes ?? '');
    setLikelihoodDraft(r.likelihood != null ? Math.min(Math.max(r.likelihood, 1), 3) : null);
    setImpactDraft(r.impact != null ? Math.min(Math.max(r.impact, 1), 3) : null);
    setResidualLikelihoodDraft(
      r.residualLikelihood != null
        ? r.residualLikelihood
        : r.residualRisk?.likelihood ?? null
    );
    setResidualImpactDraft(
      r.residualImpact != null
        ? r.residualImpact
        : r.residualRisk?.impact ?? null
    );
    setSelectedApproverIds((r.assignedApproverIds ?? []).map((u) => u._id));
  }, [risk.data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (risk.error) {
    return (
      <div className="space-y-4 p-6">
        <FormErrorAlert
          message={(risk.error as Error).message}
          onRetry={() => risk.refetch()}
        />
      </div>
    );
  }

  if (risk.isLoading || !risk.data) {
    return <Skeleton className="h-96 w-full" />;
  }

  const r = risk.data;
  const owner = typeof r.ownerId === 'object' ? r.ownerId : null;
  const controlIds = (r.mitigatingControlIds ?? []).map((c) => c._id);
  const assignedApprovers = r.assignedApproverIds ?? [];
  const eligibleApprovers = orgUsers.filter((u) => ['ADMIN', 'MANAGER'].includes(u.role));
  const currentUserIsAssignedApprover = assignedApprovers.some((u) => u._id === currentUser?._id);
  const currentUserCanApprovePending =
    r.status === 'PENDING_APPROVAL' &&
    permissions.canReviewRisks &&
    (currentUserIsAssignedApprover || currentUser?.role === 'ADMIN');
  const history = assessments.data ?? [];
  const historyCount = history.length;

  const formatUserName = (user?: { firstName?: string; lastName?: string; email?: string } | null) => {
    if (!user) return 'Unknown user';
    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return name || user.email || 'Unknown user';
  };

  const handleLikelihoodChange = (value: string) => {
    if (!id || !permissions.canEditRisks) return;
    const num = Number(value);
    setLikelihoodDraft(num);
    updateRisk.mutate({ id, input: { likelihood: num } });
  };

  const handleImpactChange = (value: string) => {
    if (!id || !permissions.canEditRisks) return;
    const num = Number(value);
    setImpactDraft(num);
    updateRisk.mutate({ id, input: { impact: num } });
  };

  const handleTreatmentChange = (value: string) => {
    if (!id || !permissions.canEditRisks) return;
    updateRisk.mutate({
      id,
      input: { treatment: value as 'MITIGATE' | 'ACCEPT' | 'TRANSFER' | 'AVOID' },
    });
  };

  const handleOwnerChange = (value: string) => {
    if (!id || !permissions.canEditRisks) return;
    updateRisk.mutate({
      id,
      input: { ownerId: value === '__none__' ? null : value },
    });
  };

  const updateCiaCategories = (next: CiaCategory[]) => {
    if (!permissions.canEditRisks) return;
    setCiaTags(next);
    if (!id) return;
    updateRisk.mutate({
      id,
      input: { ciaCategories: next },
    });
  };

  const removeCiaTag = (tag: CiaCategory) => {
    updateCiaCategories(ciaTags.filter((t) => t !== tag));
  };

  const addCiaTag = (tag: CiaCategory) => {
    if (!ciaTags.includes(tag)) {
      updateCiaCategories([...ciaTags, tag]);
    }
  };

  const handleCategoriesChange = (next: string[]) => {
    if (!permissions.canEditRisks) return;
    setCategories(next);
    if (!id) return;
    updateRisk.mutate({
      id,
      input: {
        categories: next,
        category: next[0],
      },
    });
  };

  const handleAddCategory = (cat: string) => {
    if (!categories.includes(cat)) {
      handleCategoriesChange([...categories, cat]);
    }
  };

  const handleRemoveCategory = (cat: string) => {
    handleCategoriesChange(categories.filter((c) => c !== cat));
  };

  const handleNotesBlur = () => {
    if (!id || !permissions.canEditRisks) return;
    updateRisk.mutate({
      id,
      input: { assessmentNotes: notes },
    });
  };

  const handleApprove = () => {
    if (!id || approveRisk.isPending || !permissions.canReviewRisks) return;
    approveRisk.mutate({ id, notes });
  };

  const handleApproverToggle = (approverId: string) => {
    setSelectedApproverIds((prev) =>
      prev.includes(approverId)
        ? prev.filter((id) => id !== approverId)
        : [...prev, approverId]
    );
  };

  const handleSubmitApproval = () => {
    if (!id || submitRiskApproval.isPending || !permissions.canReviewRisks) return;
    submitRiskApproval.mutate({
      id,
      input: { approverIds: selectedApproverIds, notes },
    });
  };

  // Display values for 3×3 dropdowns (1–3). Use placeholder when unassessed.
  const likelihoodDisplay = likelihoodDraft;
  const impactDisplay = impactDraft;
  const residualLikelihoodDisplay =
    residualLikelihoodDraft ?? likelihoodDisplay;
  const residualImpactDisplay =
    residualImpactDraft ?? impactDisplay;
  const inherentRiskScore =
    calculateRiskScore(likelihoodDisplay, impactDisplay) ??
    calculateRiskScore(r.inherentRisk?.likelihood, r.inherentRisk?.impact);
  const residualRiskScore =
    calculateRiskScore(residualLikelihoodDisplay, residualImpactDisplay) ??
    calculateRiskScore(r.residualRisk?.likelihood, r.residualRisk?.impact);

  return (
    <div className="space-y-6">
      <DetailPageHeader
        backTo="/risks"
        parentLabel="Risks"
        title={r.title}
        actions={
          <>
            <ContextualHelpButton moduleId="risks" current={{ status: r.status }} />
            {(permissions.canEditRisks || permissions.canArchiveRisks) ? (
          <>
            {(permissions.canEditRisks || permissions.canArchiveRisks) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {permissions.canEditRisks && (
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    Edit description
                  </DropdownMenuItem>
                )}
                {permissions.canArchiveRisks && (
                  <DropdownMenuItem
                    className="text-muted-foreground"
                    onClick={() => setArchiveOpen(true)}
                  >
                    Archive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            )}
            {permissions.canEditRisks && (
              <Button variant="outline" size="sm">
                Manage access
              </Button>
            )}
          </>
            ) : null}
          </>
        }
        meta={
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <CircleDot className="size-3.5" />
              Draft
            </Badge>
            <Badge variant="outline" className="gap-1">
              <User className="size-3.5" />
              {owner ? `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() || 'Unassigned' : 'Unassigned'}
            </Badge>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as (typeof TABS)[number]['id'])}>
        <TabsList className="h-auto w-full flex-wrap justify-start">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              <tab.icon className="size-4" />
              {tab.id === 'history' ? `${tab.label} ${historyCount}` : tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'overview' && (
            <>
              <p className="text-right text-xs text-muted-foreground">
                {(() => {
                  const lastEditor = r.lastReviewedBy || owner;
                  const name =
                    lastEditor && (lastEditor.firstName || lastEditor.lastName)
                      ? `${lastEditor.firstName ?? ''} ${lastEditor.lastName ?? ''}`.trim()
                      : currentUser?.firstName ?? 'Unknown';
                  return `Last edited by ${name} ${timeAgo(r.updatedAt)}`;
                })()}
              </p>

              {/* Card 1: Inherent risk */}
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <CardTitle className="text-base">Inherent risk</CardTitle>
                    <RiskScoreBadge
                      score={inherentRiskScore?.score ?? r.inherentScore}
                      level={inherentRiskScore?.level ?? r.inherentRisk?.level}
                      label="score"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Risk score based on current state, including any existing actions you have put in place to help reduce this risk.{' '}
                    <button
                      type="button"
                      className="underline text-primary hover:no-underline"
                      onClick={() => setRubricsOpen(true)}
                    >
                      View rubrics
                    </button>
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Likelihood</Label>
                      <Select
                        value={likelihoodDisplay != null ? String(likelihoodDisplay) : '__placeholder__'}
                        onValueChange={(v) => v !== '__placeholder__' && handleLikelihoodChange(v)}
                        disabled={updateRisk.isPending || !permissions.canEditRisks}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select likelihood" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__placeholder__" disabled className="text-muted-foreground">
                            Select likelihood
                          </SelectItem>
                          {LIKELIHOOD_RUBRICS.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                              <div>
                                <p>{opt.label}</p>
                                <p className="text-xs text-muted-foreground font-normal">{opt.subtext.slice(0, 60)}…</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Impact</Label>
                      <Select
                        value={impactDisplay != null ? String(impactDisplay) : '__placeholder__'}
                        onValueChange={(v) => v !== '__placeholder__' && handleImpactChange(v)}
                        disabled={updateRisk.isPending || !permissions.canEditRisks}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select impact" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__placeholder__" disabled className="text-muted-foreground">
                            Select impact
                          </SelectItem>
                          {IMPACT_RUBRICS.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                              <div>
                                <p>{opt.label}</p>
                                <p className="text-xs text-muted-foreground font-normal">{opt.subtext.slice(0, 60)}…</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Textarea
                      placeholder="Add notes…"
                      rows={2}
                      className="resize-none"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      onBlur={handleNotesBlur}
                      disabled={!permissions.canEditRisks}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Treatment plan */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Treatment plan</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Select a treatment plan to reduce this risk.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Treatment type</Label>
                    <Select
                      value={r.treatment ?? '__placeholder__'}
                      onValueChange={(v) => v !== '__placeholder__' && handleTreatmentChange(v)}
                      disabled={updateRisk.isPending || !permissions.canEditRisks}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select treatment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__placeholder__" disabled className="text-muted-foreground">
                          Select treatment type
                        </SelectItem>
                        {TREATMENT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Controls (optional)</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {permissions.canLinkRiskControls && (
                        <Button variant="outline" size="sm" onClick={() => setMapControlsOpen(true)}>
                          + Add
                        </Button>
                      )}
                      {(r.mitigatingControlIds ?? []).length > 0 && (
                        <ul className="flex flex-col gap-1.5">
                          {(r.mitigatingControlIds ?? []).map((c) => (
                            <li key={c._id}>
                              <Link
                                to={`/controls?detail=${c._id}`}
                                className="block rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                              >
                                <span className="font-medium">
                                  {c.title || c.identifier || 'Control'}
                                </span>
                                {c.description && (
                                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                    {c.description}
                                  </p>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tasks (optional)</Label>
                    <Select disabled>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Create task" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="placeholder">Create task</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Residual risk */}
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <CardTitle className="text-base">Residual risk</CardTitle>
                    <RiskScoreBadge
                      score={residualRiskScore?.score ?? r.residualScore}
                      level={residualRiskScore?.level ?? r.residualRisk?.level}
                      label="score"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Risk score based on future state, once you have implemented all actions described in the treatment plan.{` `}
                    <button
                      type="button"
                      className="underline text-primary hover:no-underline"
                      onClick={() => setRubricsOpen(true)}
                    >
                      View rubrics
                    </button>
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Likelihood</Label>
                      <Select
                        value={
                          residualLikelihoodDisplay != null
                            ? String(residualLikelihoodDisplay)
                            : '__placeholder__'
                        }
                        onValueChange={(value) => {
                          if (!id || value === '__placeholder__') return;
                          const num = Number(value);
                          const currentImpact =
                            residualImpactDisplay ?? num;
                          setResidualLikelihoodDraft(num);
                          setResidualImpactDraft(currentImpact);
                          updateRisk.mutate({
                            id,
                            input: {
                              residualLikelihood: num,
                              residualImpact: currentImpact,
                            },
                          });
                        }}
                        disabled={updateRisk.isPending || !permissions.canEditRisks}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select likelihood" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__placeholder__" disabled className="text-muted-foreground">
                            Select likelihood
                          </SelectItem>
                          {LIKELIHOOD_RUBRICS.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Impact</Label>
                      <Select
                        value={
                          residualImpactDisplay != null
                            ? String(residualImpactDisplay)
                            : '__placeholder__'
                        }
                        onValueChange={(value) => {
                          if (!id || value === '__placeholder__') return;
                          const num = Number(value);
                          const currentLikelihood =
                            residualLikelihoodDisplay ?? num;
                          setResidualLikelihoodDraft(currentLikelihood);
                          setResidualImpactDraft(num);
                          updateRisk.mutate({
                            id,
                            input: {
                              residualLikelihood: currentLikelihood,
                              residualImpact: num,
                            },
                          });
                        }}
                        disabled={updateRisk.isPending || !permissions.canEditRisks}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select impact" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__placeholder__" disabled className="text-muted-foreground">
                            Select impact
                          </SelectItem>
                          {IMPACT_RUBRICS.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 4: Owner */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Owner</CardTitle>
                  <p className="text-sm text-muted-foreground">Assign an owner for this risk.</p>
                </CardHeader>
                <CardContent>
                  <Select
                    value={owner?._id ?? '__none__'}
                    onValueChange={handleOwnerChange}
                    disabled={updateRisk.isPending || !permissions.canEditRisks}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {orgUsers.map((u) => (
                        <SelectItem key={u._id} value={u._id}>
                          {u.firstName} {u.lastName}
                          {currentUser?._id === u._id ? ' (me)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Card 5: Approval */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Approval</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Assign approvers, submit, and capture the final approval.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {r.status === 'CLOSED' ? (
                    <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                      <p className="font-medium">Approved</p>
                      <p className="text-xs text-muted-foreground">
                        {r.closedAt ? `Closed on ${formatDate(r.closedAt)}` : 'This risk is closed.'}
                      </p>
                    </div>
                  ) : r.status === 'PENDING_APPROVAL' ? (
                    <div className="space-y-3">
                      <div className="rounded-md border bg-muted/20 px-3 py-2">
                        <p className="text-sm font-medium">Pending approval</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {assignedApprovers.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No approvers assigned.</span>
                          ) : (
                            assignedApprovers.map((approver) => (
                              <Badge key={approver._id} variant="secondary">
                                {formatUserName(approver)}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                      {currentUserCanApprovePending && (
                        <Button
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                          disabled={approveRisk.isPending}
                          onClick={handleApprove}
                        >
                          {approveRisk.isPending ? 'Approving...' : 'Approve risk'}
                        </Button>
                      )}
                    </div>
                  ) : permissions.canReviewRisks ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Approvers</Label>
                        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                          {eligibleApprovers.length === 0 ? (
                            <p className="px-2 py-3 text-sm text-muted-foreground">
                              No manager or admin users are available.
                            </p>
                          ) : (
                            eligibleApprovers.map((approver) => (
                              <label
                                key={approver._id}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                              >
                                <Checkbox
                                  checked={selectedApproverIds.includes(approver._id)}
                                  onCheckedChange={() => handleApproverToggle(approver._id)}
                                />
                                <span className="font-medium">{formatUserName(approver)}</span>
                                <span className="text-xs uppercase text-muted-foreground">
                                  {approver.role}
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                      <Button
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={
                          submitRiskApproval.isPending ||
                          selectedApproverIds.length === 0 ||
                          eligibleApprovers.length === 0
                        }
                        onClick={handleSubmitApproval}
                      >
                        {submitRiskApproval.isPending ? 'Submitting...' : 'Submit for approval'}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      You do not have permission to submit this risk for approval.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === 'history' && (
            <>
              {historyCount === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <HistoryIcon className="mb-4 size-12 text-muted-foreground/50" />
                    <p className="font-medium text-muted-foreground">
                      This risk has no approval history yet.
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Approve the risk to create an approval history entry.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                history
                  .slice()
                  .sort((a, b) => {
                    const aTime = a.assessedAt ? new Date(a.assessedAt).getTime() : 0;
                    const bTime = b.assessedAt ? new Date(b.assessedAt).getTime() : 0;
                    return bTime - aTime;
                  })
                  .map((entry, idx) => {
                    const controls = entry.snapshot?.mappedControlIds ?? [];
                    return (
                      <Card key={entry._id ?? idx}>
                        <CardHeader>
                          <CardTitle className="text-base">{r.title}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {typeof entry.assessedById === 'object'
                              ? `Approved by ${entry.assessedById.firstName ?? ''} ${entry.assessedById.lastName ?? ''
                              } on ${formatDate(entry.assessedAt)}`
                              : `Approved on ${formatDate(entry.assessedAt)}`}
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <RiskBadge
                              score={entry.snapshot?.inherentScore}
                              level={entry.snapshot?.inherentBand as
                                | 'Low'
                                | 'Medium'
                                | 'High'
                                | undefined}
                            />
                            <span className="h-px w-8 bg-border" />
                            <span className="text-muted-foreground uppercase tracking-wide">
                              {entry.snapshot?.treatmentType ?? r.treatment}
                            </span>
                            <span className="h-px w-8 bg-border" />
                            <RiskBadge
                              score={entry.snapshot?.residualScore}
                              level={entry.snapshot?.residualBand as
                                | 'Low'
                                | 'Medium'
                                | 'High'
                                | undefined}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">1/1 approval received</p>

                          <details className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                            <summary className="cursor-pointer font-medium">
                              Tasks (0)
                            </summary>
                            <p className="mt-1 text-xs text-muted-foreground">
                              No tasks linked for this approval.
                            </p>
                          </details>

                          <details className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                            <summary className="cursor-pointer font-medium">
                              Controls ({controls.length})
                            </summary>
                            {controls.length === 0 ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                No controls were linked at the time of approval.
                              </p>
                            ) : (
                              <ul className="mt-2 flex flex-wrap gap-1">
                                {controls.map((c) => (
                                  <li
                                    key={c._id}
                                    className="rounded-full bg-muted px-2 py-0.5 text-xs"
                                  >
                                    {c.identifier ?? c.title ?? 'Control'}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </details>
                        </CardContent>
                      </Card>
                    );
                  })
              )}
            </>
          )}

          {activeTab === 'comments' && id && (
            <RiskCommentsPanel riskId={id} />
          )}
        </div>

        {/* Right sidebar - Details */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 text-sm">
              <div className="border-b border-border/60 pb-4">
                <p className="text-muted-foreground">Risk ID</p>
                <p className="font-mono font-medium">{r.identifier ?? '—'}</p>
              </div>
              <div className="border-b border-border/60 py-4">
                <p className="text-muted-foreground">Identified</p>
                <p>{formatDate(r.identifiedAt)}</p>
              </div>
              <div className="border-b border-border/60 py-4">
                <p className="text-muted-foreground">Last updated</p>
                <p className="flex items-center gap-1">
                  {formatDate(r.updatedAt)}
                  <Lock className="size-3.5 text-muted-foreground" />
                </p>
              </div>
              <div className="border-b border-border/60 py-4">
                <p className="text-muted-foreground mb-2">Categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <Badge key={cat} variant="secondary" className="gap-1">
                      {cat}
                      <button
                        type="button"
                        className={cn('ml-0.5 rounded hover:bg-muted', !permissions.canEditRisks && 'hidden')}
                        onClick={() => handleRemoveCategory(cat)}
                        aria-label={`Remove ${cat}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                  {permissions.canEditRisks && (
                    <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs shrink-0"
                      >
                        {categories.length ? '+ Add category' : 'Add category'}
                        <ChevronDown className="ml-1 size-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-0" align="start">
                      <ScrollArea className="max-h-64">
                        <div className="p-1">
                          {RISK_CATEGORY_OPTIONS.filter((c) => !categories.includes(c)).map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                              onClick={() => handleAddCategory(cat)}
                            >
                              {cat}
                            </button>
                          ))}
                          {RISK_CATEGORY_OPTIONS.filter((c) => !categories.includes(c)).length === 0 && (
                            <p className="px-2 py-3 text-xs text-muted-foreground">
                              All categories added
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
              <div className="border-b border-border/60 py-4">
                <p className="text-muted-foreground">Source</p>
                <p className="flex items-center gap-1">
                  Custom
                  <Lock className="size-3.5 text-muted-foreground" />
                </p>
              </div>
              <div className="pt-4">
                <p className="text-muted-foreground mb-2">CIA</p>
                <p className="text-xs text-muted-foreground/80 mb-1.5">Confidentiality, Integrity, Availability</p>
                <div className="flex flex-wrap gap-1.5">
                  {ciaTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        className={cn('ml-0.5 rounded hover:bg-muted', !permissions.canEditRisks && 'hidden')}
                        onClick={() => removeCiaTag(tag)}
                        aria-label={`Remove ${tag}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                  {permissions.canEditRisks && CIA_OPTIONS.filter((t) => !ciaTags.includes(t)).map((tag) => (
                    <Button
                      key={tag}
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => addCiaTag(tag)}
                    >
                      + {tag}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <RubricsDrawer open={rubricsOpen} onOpenChange={setRubricsOpen} />
      {permissions.canLinkRiskControls && (
        <RiskMapControlsModal
          riskId={id ?? null}
          existingControlIds={controlIds}
          open={mapControlsOpen}
          onOpenChange={setMapControlsOpen}
          onSuccess={() => risk.refetch()}
        />
      )}
      {permissions.canEditRisks && (
        <EditRiskDescriptionModal
          risk={r}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSuccess={() => risk.refetch()}
        />
      )}

      {permissions.canArchiveRisks && (
        <ConfirmDialog
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          title="Archive risk"
          description={`Archive "${r.title}"? The risk will remain visible in the register with Archived status.`}
          confirmLabel="Archive"
          variant="destructive"
          onConfirm={async () => {
            if (!id || archiveRisk.isPending) return;
            await archiveRisk.mutateAsync(id);
            setArchiveOpen(false);
            navigate('/risks');
          }}
          loading={archiveRisk.isPending}
        />
      )}
    </div>
  );
}
