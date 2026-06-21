import { Link } from 'react-router-dom';
import {
  Shield,
  ToggleRight,
  FileText,
  BookOpen,
  AlertTriangle,
  Store,
  BarChart3,
  Lock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

const FEATURES = [
  {
    icon: Shield,
    title: 'Compliance Frameworks',
    description: 'SOC 2, ISO 27001, HIPAA, GDPR — manage multiple frameworks with mapped requirements and gap analysis.',
  },
  {
    icon: ToggleRight,
    title: 'Control Management',
    description: 'Track implementation status, conduct assessments, and link controls to evidence automatically.',
  },
  {
    icon: BookOpen,
    title: 'Policy Management',
    description: 'Version-controlled policies with approval workflows, attestations, and review scheduling.',
  },
  {
    icon: FileText,
    title: 'Evidence Collection',
    description: 'Upload and manage compliance evidence with expiration tracking and automated review workflows.',
  },
  {
    icon: AlertTriangle,
    title: 'Risk Register',
    description: 'Full risk lifecycle management with heat maps, residual scoring, and a reusable template library.',
  },
  {
    icon: Store,
    title: 'Vendor Management',
    description: 'Assess third-party risk, track certifications, and schedule vendor reviews with tiered scoring.',
  },
] as const;

const HIGHLIGHTS = [
  'Multi-framework support (SOC 2, ISO 27001, HIPAA, GDPR)',
  'Role-based access control (Admin, Manager, Employee, Auditor)',
  'Real-time compliance dashboards and readiness scores',
  'Evidence upload with S3 storage and expiry tracking',
  'Risk matrix visualization and automated scoring',
  'Policy versioning with employee attestation workflows',
] as const;

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-brand.png" alt="Veraha" className="h-8 object-contain dark:hidden" />
            <img src="/logo-brand-white-text.png" alt="Veraha" className="hidden h-8 object-contain dark:block" />
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle variant="landing" />
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-primary" />
              Enterprise-grade compliance automation
            </div>
            <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Simplify compliance.{' '}
              <span className="bg-gradient-to-r from-[#3a8a8c] to-[#2c6e6f] bg-clip-text text-transparent">
                Automate trust.
              </span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Veraha Security streamlines your compliance journey across SOC 2, ISO 27001, HIPAA, and GDPR
              — all from a single platform. Manage frameworks, controls, policies, evidence, risks, and vendors in one place.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link to="/login">
                <Button size="lg" className="gap-2 text-base">
                  Sign in <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="text-base">
                  Sign in to your account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="border-t border-border/40 bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">
              Everything you need for compliance
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              A complete compliance automation platform built for growing organizations.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2.5">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Highlights ── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-heading text-3xl font-bold sm:text-4xl">
                Built for modern security teams
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                From startups preparing for their first SOC 2 to enterprises managing multi-framework
                compliance, Veraha adapts to your needs.
              </p>
              <div className="mt-8 flex gap-4">
                <Link to="/login">
                  <Button className="gap-2">
                    Sign in <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="space-y-4">
              {HIGHLIGHTS.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-border/40 bg-gradient-to-b from-primary/5 to-transparent py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex rounded-lg bg-primary/10 p-3 mb-6">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-heading text-3xl font-bold sm:text-4xl">
            Ready to simplify your compliance?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join organizations that trust Veraha to automate their compliance workflows
            and achieve audit readiness faster.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/login">
              <Button size="lg" className="gap-2 text-base">
                Create your account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="text-base">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="Veraha" className="h-6 w-6 object-contain" />
            <span className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Veraha Security. All rights reserved.
            </span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/login" className="transition hover:text-foreground">Sign in</Link>
            <Link to="/login" className="transition hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

