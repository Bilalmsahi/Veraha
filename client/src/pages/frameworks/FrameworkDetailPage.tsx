import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useFramework, useFrameworkReadiness, useRequirements } from '@/api/frameworks';
import { useControl, useControlsByRequirement } from '@/api/controls';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ContextualHelpButton, FormErrorAlert, DetailPageHeader } from '@/components/shared';
import { RequirementDetailPanel } from '@/components/frameworks';
import { ControlDetailPanel } from '@/components/controls';
import { formatFrameworkCode, formatPercentage } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import type { Requirement } from '@/types/models';
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, ShieldCheck } from 'lucide-react';

const FRAMEWORK_LABELS: Record<string, string> = {
  SOC2: 'SOC 2',
  ISO27001: 'ISO 27001',
  HIPAA: 'HIPAA',
  GDPR: 'GDPR',
};

type FrameworkOverviewCopy = {
  summary: string;
  tags: string[];
  auditSteps: string[];
  industries: string[];
  scope: string[];
  benefits: string[];
};

const FRAMEWORK_OVERVIEWS: Record<string, FrameworkOverviewCopy> = {
  SOC2: {
    summary:
      'SOC 2 (System and Organization Controls 2) is a compliance framework that evaluates how organizations protect information across their systems and services. It is the standard of choice for SaaS companies and IT service providers looking to demonstrate security credibility to enterprise customers. A SOC 2 report gives clients and stakeholders confidence that your organization has the controls in place to protect their data.',
    tags: [],
    auditSteps: [
      'SOC 2 requires an independent third-party audit. It cannot be self-attested.',
      'There are two audit types. A Type 1 audit evaluates whether your controls are properly designed at a single point in time. A Type 2 audit goes further — it assesses whether those controls operated effectively over a defined period, typically six months to one year. Most enterprise customers and procurement teams require a Type 2 report.',
      "The outcome is a formal attestation report on your organization's compliance posture.",
    ],
    industries: [
      'Technology, Finance, Healthcare, Government, Retail, Cloud Service Providers, SaaS, Legal, Consulting',
      'Geographical focus: United States',
    ],
    scope: [
      'The scope of a SOC 2 audit is defined by the Trust Services Criteria you choose to include. At minimum, Security is required. You may also include Availability, Processing Integrity, Confidentiality, and Privacy depending on your business model and customer requirements. Your scope can cover one or several of these criteria.',
    ],
    benefits: [
      'Building trust: Demonstrates strong security and data protection practices to clients, partners, and enterprise buyers.',
      'Winning business: A prerequisite for selling to enterprise and regulated customers who mandate vendor security reviews.',
      'Reducing risk: Enforces consistent, best-in-class security controls that help prevent breaches and operational disruptions.',
    ],
  },
  ISO27001: {
    summary:
      'ISO 27001:2022 is the internationally recognized standard for establishing and managing an Information Security Management System (ISMS). It is the global benchmark for information security, trusted by organizations operating across borders and in regulated industries. The 2022 revision brings updated controls and structural improvements that reflect the modern threat landscape.',
    tags: [],
    auditSteps: [
      'ISO 27001:2022 requires a formal external audit for certification. It cannot be self-attested.',
      'Certification follows a two-stage process. Stage 1 is a documentation review where an accredited certification body assesses your ISMS design, policies, and readiness. Stage 2 is a full implementation audit that evaluates whether your controls are working effectively across the organization. Both stages are conducted by an external auditor.',
      "The outcome is an ISO 27001:2022 certificate that confirms your ISMS meets the standard's requirements.",
    ],
    industries: [
      'Technology, Finance, Healthcare, Government, Retail, Telecommunications, Manufacturing, Legal, Energy, Supply Chain',
      'Geographical focus: Global',
    ],
    scope: [
      'ISO 27001:2022 is flexible in how it is scoped. Common scoping approaches include:',
      'Entire organization: Applied across all business units, systems, and locations.',
      'Specific organizational units or locations: Scoped to particular offices, departments, or geographies.',
      'Specific products or services: Applied to the systems and processes that deliver defined products or services.',
      'Information assets: Scoped to particular data types, systems, and the infrastructure that supports them.',
    ],
    benefits: [
      'Opening global markets: ISO 27001 certification is recognized worldwide and often required for enterprise contracts in international markets.',
      'Building customer confidence: Certification signals a mature, audited commitment to information security to customers and partners.',
      'Strengthening information security: Provides a structured framework for managing risks to the confidentiality, integrity, and availability of your data.',
      'Competitive advantage: Differentiates your organization in procurement and tender processes where security credentials are evaluated.',
    ],
  },
  HIPAA: {
    summary:
      'HIPAA (Health Insurance Portability and Accountability Act) is a United States federal regulation that governs the protection of Protected Health Information (PHI). It is mandatory for any organization that creates, receives, maintains, or transmits PHI — including healthcare providers, health insurers, and their business associates such as technology vendors and cloud service providers handling health data.',
    tags: [],
    auditSteps: [
      'HIPAA compliance can be self-attested. There is no mandatory third-party certification.',
      'However, organizations may be subject to audits and enforcement actions by the Office for Civil Rights (OCR) if a breach occurs or a complaint is filed. Compliance assessments focus on privacy controls, security safeguards, and breach notification procedures. While no formal certification exists, conducting regular internal reviews and engaging third-party auditors is widely considered best practice.',
      'Third-party auditors may issue an attestation of compliance as supporting evidence for stakeholders and business associates.',
    ],
    industries: [
      'Healthcare, Health Insurance, Pharmaceuticals, Life Sciences, Telemedicine, Medical Devices, Research Institutions',
      'Geographical focus: United States',
    ],
    scope: [
      'HIPAA applies specifically to any processes, systems, and activities that involve PHI. This includes patient data management, healthcare payment processing, clinical systems, and any third-party service handling health information on behalf of a covered entity.',
    ],
    benefits: [
      'Meeting legal obligations: Ensures your organization meets all US federal healthcare privacy and security requirements.',
      'Reducing risk: Protects patient health information from unauthorized access and costly data breaches.',
      'Building trust: Demonstrates a genuine commitment to patient data privacy to clients, partners, and regulators.',
      'Avoiding penalties: Prevents significant financial penalties and reputational damage resulting from non-compliance.',
    ],
  },
  GDPR: {
    summary:
      "The GDPR (General Data Protection Regulation) is the European Union's primary regulation for data protection and privacy. It applies to any organization that does business in the EU or processes the personal data of EU residents — regardless of where the organization is based. Combined with the EU-US Data Privacy Framework, it governs how personal data flows between the EU and the United States.",
    tags: [],
    auditSteps: [
      'GDPR compliance is primarily self-attested, though organizations may be subject to regulatory inspections and investigations by data protection authorities if complaints are raised or breaches occur.',
      'Compliance assessments typically involve an initial readiness review, gap analysis, implementation of required technical and organizational measures, internal audits, and potentially external audits by third parties. If you engage an external auditor, you will receive a report covering your compliance status, identified findings, and recommended actions. Some auditors provide a statement of compliance or attestation as evidence of adherence for stakeholders and business partners.',
    ],
    industries: [
      'Technology, Finance, Healthcare, Retail, Government, Telecommunications, E-commerce, Marketing, Legal, Social Media',
      'Geographical focus: European Union',
    ],
    scope: [
      'GDPR applies broadly across your organization wherever personal data is involved. Common scoping dimensions include:',
      'Entire organization: Applied across all departments and systems that process EU personal data.',
      'Specific products or services: Scoped to products where personal data is collected, stored, or processed.',
      'Physical locations: Applied to specific sites or facilities that handle personal data.',
      'Processing activities: Scoped to defined data processing workflows such as customer management, analytics, or payment handling.',
      'Business units or departments: Applied to specific teams such as HR, IT, marketing, or finance that process personal data.',
    ],
    benefits: [
      'Avoiding fines: Ensures your organization meets strict EU data protection requirements and avoids significant regulatory penalties.',
      'Entering EU markets: Enables lawful data processing and business operations across European markets.',
      'Building trust: Strengthens customer and partner relationships by demonstrating responsible data practices.',
      'Reducing risk: Minimizes exposure to data breaches, regulatory investigations, and reputational damage from non-compliance.',
    ],
  },
};

export function FrameworkDetailPage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const normalizedCode = code?.toUpperCase();
  const activeTab = location.pathname.endsWith('/controls') ? 'controls' : 'overview';
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [requirementPanelOpen, setRequirementPanelOpen] = useState(false);
  const selectedControlId = searchParams.get('controlId');

  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const search = searchParams.get('search') ?? '';
  const categoryIdFilter = searchParams.get('categoryId') ?? '';
  const sort = searchParams.get('sort') ?? 'identifier_asc';

  const [sortBy, sortOrder] = useMemo(() => {
    const [by, order] = sort.split('_');
    return [by || 'identifier', (order as 'asc' | 'desc') || 'asc'];
  }, [sort]);

  const reqParams = useMemo(
    () => ({
      page,
      limit: [10, 20, 50, 100].includes(limit) ? limit : 20,
      search: search || undefined,
      categoryId: categoryIdFilter || undefined,
      sortBy,
      sortOrder,
    }),
    [page, limit, search, categoryIdFilter, sortBy, sortOrder]
  );

  const framework = useFramework(normalizedCode ?? null);
  const requirements = useRequirements(normalizedCode ?? null, reqParams);
  const readinessOverlay = useFrameworkReadiness(normalizedCode ?? null, !!normalizedCode);
  const controlDetail = useControl(selectedControlId, !!selectedControlId);

  const fw = framework.data;
  useEffect(() => {
    if (!categoryIdFilter && fw?.categories?.length) {
      const sorted = [...fw.categories].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.code.localeCompare(b.code)
      );
      setSearchParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.set('categoryId', sorted[0]._id);
          return next;
        },
        { replace: true }
      );
    }
  }, [fw?.categories, categoryIdFilter, setSearchParams]);

  const handleTabChange = (tab: string) => {
    if (!code) return;

    const nextPath = tab === 'controls' ? `/frameworks/${code}/controls` : `/frameworks/${code}`;
    navigate(
      {
        pathname: nextPath,
        search: searchParams.toString() ? `?${searchParams.toString()}` : '',
      },
      { replace: true }
    );
  };

  if (framework.error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Framework</h1>
        <FormErrorAlert
          message={(framework.error as Error).message}
          onRetry={() => framework.refetch()}
        />
      </div>
    );
  }

  const reqList = requirements.data?.requirements ?? [];

  const handleRequirementRowClick = (row: Requirement) => {
    setSelectedRequirementId(row._id);
    setRequirementPanelOpen(true);
  };

  const handleControlClick = (controlId: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('controlId', controlId);
      return next;
    });
  };

  const sortedCategories = fw?.categories
    ? [...fw.categories].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.code.localeCompare(b.code)
      )
    : [];

  const selectedCat = sortedCategories.find((c) => c._id === categoryIdFilter) ?? null;

  const handleCategorySelect = (catId: string) => {
    setSearchParams((p) => {
      const next = new URLSearchParams(p);
      next.set('categoryId', catId);
      next.set('page', '1');
      return next;
    });
  };

  const readinessScore = readinessOverlay.data?.readinessScore ?? null;

  const overlay = readinessOverlay.data?.workflowOverlay;
  const rollup = readinessOverlay.data?.rollup;

  const controlsTabContent = (
    <>
      {/* Mobile: select + single column */}
      <div className="flex flex-col gap-4 lg:hidden">
        {fw?.categories && fw.categories.length > 0 && (
          <div>
            <label
              htmlFor="cat-select-mobile"
              className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Requirement Category
            </label>
            <select
              id="cat-select-mobile"
              value={categoryIdFilter}
              onChange={(e) => handleCategorySelect(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {sortedCategories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.code}: {cat.title}
                </option>
              ))}
            </select>
          </div>
        )}
        {selectedCat && (
          <h2 className="text-lg font-semibold">
            {selectedCat.code} {selectedCat.title}
          </h2>
        )}
        {requirements.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <RequirementCategoryView
            requirements={reqList}
            onRequirementClick={handleRequirementRowClick}
            onControlClick={handleControlClick}
          />
        )}
      </div>

      {/* Desktop: fixed sidebar + fluid main content */}
      <div
        className={cn(
          'hidden min-h-[500px] lg:grid lg:items-start lg:gap-6',
          sidebarOpen ? 'lg:grid-cols-[16rem_minmax(0,1fr)]' : 'lg:grid-cols-[2.75rem_minmax(0,1fr)]'
        )}
      >
        {fw?.categories && fw.categories.length > 0 && (
          <nav
            className={cn(
              'w-full border-r pr-4 transition-all duration-200',
              sidebarOpen ? 'pr-4' : 'pr-0'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              {sidebarOpen && (
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Requirement Categories
                </p>
              )}
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                className="ml-auto p-1 rounded hover:bg-muted/50"
                aria-label={sidebarOpen ? 'Collapse categories' : 'Expand categories'}
              >
                {sidebarOpen ? (
                  <ChevronLeft className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>
            </div>
            {sidebarOpen &&
              sortedCategories.map((cat) => (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => handleCategorySelect(cat._id)}
                  className={cn(
                    'w-full pl-3 pr-2 py-2 text-left transition-colors rounded-r-md border-l-2',
                    categoryIdFilter === cat._id
                      ? 'border-primary font-medium text-primary'
                      : 'border-transparent hover:bg-muted/50 text-foreground'
                  )}
                >
                  <span className="block text-sm font-medium leading-none">{cat.code}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
                    {cat.title}
                  </span>
                </button>
              ))}
          </nav>
        )}

        <div className="min-w-0">
          {selectedCat && (
            <h2 className="text-lg font-semibold mb-4">
              {selectedCat.code} {selectedCat.title}
            </h2>
          )}
          {requirements.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <RequirementCategoryView
              requirements={reqList}
              onRequirementClick={handleRequirementRowClick}
              onControlClick={handleControlClick}
            />
          )}
        </div>
      </div>
    </>
  );

  const overviewCopy = normalizedCode ? FRAMEWORK_OVERVIEWS[normalizedCode] : undefined;
  const readyRequirements = rollup?.requirement?.pass ?? 0;
  const totalRequirements = rollup?.requirement?.total ?? fw?.requirementCount ?? 0;
  const passingControls = overlay?.pass ?? 0;
  const totalControls = overlay
    ? overlay.pass + overlay.fail
    : 0;
  const controlReadinessScore = totalControls
    ? Math.round((passingControls / totalControls) * 100)
    : 0;
  const gapCount = rollup?.requirement?.fail ?? 0;

  return (
    <div className="space-y-6">
      <DetailPageHeader
        backTo="/frameworks"
        title={fw ? formatFrameworkCode(FRAMEWORK_LABELS[fw.code] ?? fw.name ?? '') : 'Framework'}
        description={fw?.version}
        actions={
          <div className="flex items-center gap-2">
            <ContextualHelpButton moduleId="frameworks" current={{ status: readinessScore === 100 ? 'PASS' : 'FAIL' }} />
            {readinessScore != null ? (
              <span className="whitespace-nowrap rounded-full bg-muted px-3 py-1 text-sm font-medium">
                {formatPercentage(readinessScore)} compliant
              </span>
            ) : null}
          </div>
        }
      />

      {readinessScore != null && (
        <div className="flex items-center gap-4">
          <Progress value={readinessScore} className="h-2 flex-1" />
          <span className="text-sm font-semibold text-primary min-w-[3rem] text-right">
            {formatPercentage(readinessScore)}
          </span>
        </div>
      )}

      {framework.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="mt-4 space-y-4">
              {readinessOverlay.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : readinessOverlay.error ? (
                <FormErrorAlert
                  message={(readinessOverlay.error as Error).message}
                  onRetry={() => readinessOverlay.refetch()}
                />
              ) : (
                <FrameworkOverview
                  frameworkName={fw ? formatFrameworkCode(FRAMEWORK_LABELS[fw.code] ?? fw.name ?? '') : 'Framework'}
                  overview={overviewCopy}
                  readinessScore={readinessScore ?? 0}
                  readyRequirements={readyRequirements}
                  totalRequirements={totalRequirements}
                  controlReadinessScore={controlReadinessScore}
                  passingControls={passingControls}
                  totalControls={totalControls}
                  gapCount={gapCount}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="controls" className="mt-4">
            {controlsTabContent}
          </TabsContent>
        </Tabs>
      )}

      <RequirementDetailPanel
        requirementId={selectedRequirementId}
        open={requirementPanelOpen}
        onOpenChange={setRequirementPanelOpen}
      />
      <ControlDetailPanel
        control={controlDetail.data ?? null}
        open={!!selectedControlId}
        onOpenChange={(open) => {
          if (!open) {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('controlId');
              return next;
            });
          }
        }}
      />
    </div>
  );
}

function FrameworkOverview({
  frameworkName,
  overview,
  readinessScore,
  readyRequirements,
  totalRequirements,
  controlReadinessScore,
  passingControls,
  totalControls,
  gapCount,
}: {
  frameworkName: string;
  overview?: FrameworkOverviewCopy;
  readinessScore: number;
  readyRequirements: number;
  totalRequirements: number;
  controlReadinessScore: number;
  passingControls: number;
  totalControls: number;
  gapCount: number;
}) {
  const fallback: FrameworkOverviewCopy = {
    summary:
      'This framework overview summarizes readiness, mapped controls, and the core compliance program areas that support audit preparation.',
    tags: ['Security', 'Governance', 'Evidence', 'Controls'],
    auditSteps: ['Review mapped controls, collect evidence, resolve gaps, and keep ownership current.'],
    industries: ['Technology', 'Finance', 'Healthcare', 'Retail'],
    scope: ['Controls, policies, tests, documents, vendors, and teams included in this compliance program.'],
    benefits: ['Improves audit readiness and creates a clearer operating model for compliance work.'],
  };
  const copy = overview ?? fallback;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <ReadinessMetricCard
          icon={ShieldCheck}
          title="Framework readiness"
          value={formatPercentage(readinessScore)}
          description={`${readyRequirements} of ${totalRequirements} requirements passing`}
          progress={readinessScore}
        />
        <ReadinessMetricCard
          icon={CheckCircle2}
          title="Controls"
          value={formatPercentage(controlReadinessScore)}
          description={`${passingControls} of ${totalControls} mapped controls passing`}
          progress={controlReadinessScore}
        />
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CircleAlert className="size-4 text-primary" />
              <CardTitle className="text-sm">Open requirement gaps</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{gapCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Requirements without passing mapped controls
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="min-w-0">
        <div className="border-b pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-xl font-semibold">Program overview</h2>
            <Badge variant="secondary">{formatPercentage(readinessScore)} ready</Badge>
          </div>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-muted-foreground">
            {copy.summary}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {copy.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className="divide-y">
          <OverviewSection title="Audit and assurance steps" items={copy.auditSteps} defaultOpen />
          <OverviewSection title="Relevant industries" items={copy.industries} />
          <OverviewSection title="Typical implementation scope" items={copy.scope} />
          <OverviewSection title="Benefits of compliance" items={copy.benefits} />
        </div>
      </section>
    </div>
  );
}

function ReadinessMetricCard({
  icon: Icon,
  title,
  value,
  description,
  progress,
}: {
  icon: typeof ShieldCheck;
  title: string;
  value: string;
  description: string;
  progress: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <Progress value={progress} className="mt-4 h-2" />
      </CardContent>
    </Card>
  );
}

function OverviewSection({
  title,
  items,
  defaultOpen = false,
}: {
  title: string;
  items: string[];
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-4 text-left text-sm font-semibold">
        <ChevronDown className="size-4 text-muted-foreground" />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-5 pl-6">
        <ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RequirementCategoryView({
  requirements,
  onRequirementClick,
  onControlClick,
}: {
  requirements: Requirement[];
  onRequirementClick: (row: Requirement) => void;
  onControlClick: (controlId: string) => void;
}) {
  const permissions = usePermissions();
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(requirements[0] ? [requirements[0]._id] : [])
  );

  if (requirements.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No requirements found in this category.
      </p>
    );
  }

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {requirements.map((req) => {
        const isOpen = openIds.has(req._id);
        return (
          <Collapsible key={req._id} open={isOpen} onOpenChange={() => toggle(req._id)}>
            <Card className="overflow-hidden gap-0 py-0">
              <CardHeader className="px-5 py-0 hover:bg-muted/30 transition-colors">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 py-4 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-[4.5rem] shrink-0 font-mono text-xs text-muted-foreground">
                      {req.identifier}
                    </span>
                    <span
                      className="flex-1 cursor-pointer text-left text-lg font-semibold tracking-tight"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRequirementClick(req);
                      }}
                    >
                      {req.title}
                    </span>
                  </button>
                </CollapsibleTrigger>
                {permissions.canCreateControls && (
                  <CardAction className="self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // TODO: wire up add control functionality
                      }}
                    >
                      Add control
                    </Button>
                  </CardAction>
                )}
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="overflow-hidden border-t border-border/50 p-0">
                  <RequirementControlsTable
                    requirementId={req._id}
                    onControlClick={onControlClick}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}

function RequirementControlsTable({
  requirementId,
  onControlClick,
}: {
  requirementId: string;
  onControlClick: (controlId: string) => void;
}) {
  const statusVariant = (status: string) => {
    switch (status) {
      case 'PASS':
        return 'default' as const;
      case 'FAIL':
        return 'destructive' as const;
      case 'WARNING':
        return 'outline' as const;
      case 'NOT_APPLICABLE':
      case 'NOT_CONFIGURED':
      default:
        return 'secondary' as const;
    }
  };

  const statusClassName = (status: string) => {
    switch (status) {
      case 'PASS':
        return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300';
      case 'FAIL':
        return 'bg-destructive/15 text-destructive border-destructive/30';
      case 'WARNING':
        return 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const { data, isLoading } = useControlsByRequirement(requirementId);
  const controls = data?.controls ?? [];

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }
  if (controls.length === 0) {
    return (
      <p className="py-3 text-center text-sm text-muted-foreground">
        No controls linked to this requirement.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[44rem]">
        <div className="grid grid-cols-[7rem_minmax(0,1fr)_10.5rem_11rem] px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <div>Control</div>
          <div>Title</div>
          <div>Status</div>
          <div>Owner</div>
        </div>
        <div>
          {controls.map((ctrl) => {
            const ownerLabel = ctrl.owner
              ? `${ctrl.owner.firstName} ${ctrl.owner.lastName}`
              : 'Unassigned';
            return (
              <div
                key={ctrl._id}
                onClick={() => onControlClick(ctrl._id)}
                className="grid cursor-pointer grid-cols-[7rem_minmax(0,1fr)_10.5rem_11rem] border-b border-border/40 px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/20"
              >
                <div className="truncate whitespace-nowrap pr-3 font-mono text-xs" title={ctrl.identifier}>
                  {ctrl.identifier}
                </div>
                <div className="truncate pr-3 font-medium" title={ctrl.title}>
                  {ctrl.title}
                </div>
                <div className="pr-3">
                  <Badge
                    variant={statusVariant(ctrl.overallStatus)}
                    className={statusClassName(ctrl.overallStatus)}
                  >
                    {ctrl.overallStatus.replaceAll('_', ' ')}
                  </Badge>
                </div>
                <div className="truncate whitespace-nowrap text-xs text-muted-foreground" title={ownerLabel}>
                  {ownerLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
