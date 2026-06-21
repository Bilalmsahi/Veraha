import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { SessionTimeoutProvider } from '@/components/auth/SessionTimeoutProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/shared';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuestGuard } from '@/components/auth/GuestGuard';
import { InternalGuard } from '@/components/auth/InternalGuard';
import { AuditorGuard } from '@/components/auth/AuditorGuard';
import { RoleGuard } from '@/components/auth/RoleGuard';

const loadPage = <T extends Record<string, unknown>, K extends keyof T>(loader: () => Promise<T>, exportName: K) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] as React.ComponentType })));

const LoginPage = loadPage(() => import('@/pages/auth/LoginPage'), 'LoginPage');
const RegisterPage = loadPage(() => import('@/pages/auth/RegisterPage'), 'RegisterPage');
const AcceptInvitePage = loadPage(() => import('@/pages/auth/AcceptInvitePage'), 'AcceptInvitePage');
const ForgotPasswordPage = loadPage(() => import('@/pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = loadPage(() => import('@/pages/auth/ResetPasswordPage'), 'ResetPasswordPage');
const DashboardPage = loadPage(() => import('@/pages/dashboard/DashboardPage'), 'DashboardPage');
const ActivityPage = loadPage(() => import('@/pages/activity/ActivityPage'), 'ActivityPage');
const ControlsPage = loadPage(() => import('@/pages/controls/ControlsPage'), 'ControlsPage');
const EvidencePage = loadPage(() => import('@/pages/evidence/EvidencePage'), 'EvidencePage');
const DocumentDetailPage = loadPage(() => import('@/pages/evidence/DocumentDetailPage'), 'DocumentDetailPage');
const PoliciesPage = loadPage(() => import('@/pages/policies/PoliciesPage'), 'PoliciesPage');
const PolicyDetailPage = loadPage(() => import('@/pages/policies/PolicyDetailPage'), 'PolicyDetailPage');
const PolicyEditorPage = loadPage(() => import('@/pages/policies/PolicyEditorPage'), 'PolicyEditorPage');
const PolicyLibraryPage = loadPage(() => import('@/pages/policies/PolicyLibraryPage'), 'PolicyLibraryPage');
const FrameworksPage = loadPage(() => import('@/pages/frameworks/FrameworksPage'), 'FrameworksPage');
const FrameworkDetailPage = loadPage(() => import('@/pages/frameworks/FrameworkDetailPage'), 'FrameworkDetailPage');
const RisksPage = loadPage(() => import('@/pages/risks/RisksPage'), 'RisksPage');
const RiskDetailPage = loadPage(() => import('@/pages/risks/RiskDetailPage'), 'RiskDetailPage');
const RiskScenarioDetailPage = loadPage(() => import('@/pages/risks/RiskScenarioDetailPage'), 'RiskScenarioDetailPage');
const VendorsPage = loadPage(() => import('@/pages/vendors/VendorsPage'), 'VendorsPage');
const VendorDetailPage = loadPage(() => import('@/pages/vendors/VendorDetailPage'), 'VendorDetailPage');
const PeopleGroupsPage = loadPage(() => import('@/pages/personnel/PersonnelPage'), 'PeopleGroupsPage');
const PersonnelTasksPage = loadPage(() => import('@/pages/personnel/PersonnelTasksPage'), 'PersonnelTasksPage');
const TrainingReadingPage = loadPage(() => import('@/pages/personnel/training/TrainingReadingPage'), 'TrainingReadingPage');
const TrainingQuizPage = loadPage(() => import('@/pages/personnel/training/TrainingQuizPage'), 'TrainingQuizPage');
const SettingsPage = loadPage(() => import('@/pages/settings/SettingsPage'), 'SettingsPage');
const DevicesPage = loadPage(() => import('@/pages/devices/DevicesPage'), 'DevicesPage');
const IntegrationsHubPage = loadPage(() => import('@/pages/integrations/IntegrationsHubPage'), 'IntegrationsHubPage');
const AwsPage = loadPage(() => import('@/pages/integrations/AwsPage'), 'AwsPage');
const HrPage = loadPage(() => import('@/pages/integrations/HrPage'), 'HrPage');
const RiskLibraryPage = loadPage(() => import('@/pages/risk-library/RiskLibraryPage'), 'RiskLibraryPage');
const LandingPage = loadPage(() => import('@/pages/landing/LandingPage'), 'LandingPage');
const TestsPage = loadPage(() => import('@/pages/tests/TestsPage'), 'TestsPage');
const TestDetailPage = loadPage(() => import('@/pages/tests/TestDetailPage'), 'TestDetailPage');
const AuditsPage = loadPage(() => import('@/pages/audits/AuditsPage'), 'AuditsPage');
const AuditDetailPage = loadPage(() => import('@/pages/audits/AuditDetailPage'), 'AuditDetailPage');
const AccessReviewsPage = loadPage(() => import('@/pages/access-reviews/AccessReviewsPage'), 'AccessReviewsPage');
const AccessReviewDetailPage = loadPage(() => import('@/pages/access-reviews/AccessReviewDetailPage'), 'AccessReviewDetailPage');
const ReportsPage = loadPage(() => import('@/pages/reports/ReportsPage'), 'ReportsPage');
const ComplianceReportPage = loadPage(() => import('@/pages/reports/ComplianceReportPage'), 'ComplianceReportPage');
const PersonnelReportPage = loadPage(() => import('@/pages/reports/PersonnelReportPage'), 'PersonnelReportPage');
const RiskReportPage = loadPage(() => import('@/pages/reports/RiskReportPage'), 'RiskReportPage');
const VendorReportPage = loadPage(() => import('@/pages/reports/VendorReportPage'), 'VendorReportPage');
const AuditorLayout = loadPage(() => import('@/pages/auditor/AuditorLayout'), 'AuditorLayout');
const AuditorDashboardPage = loadPage(() => import('@/pages/auditor/AuditorDashboardPage'), 'AuditorDashboardPage');
const AuditorAuditPage = loadPage(() => import('@/pages/auditor/AuditorAuditPage'), 'AuditorAuditPage');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000, gcTime: 10 * 60 * 1000 },
  },
});

function RouteSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter>
        <SessionTimeoutProvider />
        <ErrorBoundary>
          <Suspense fallback={<RouteSkeleton />}>
        <Routes>
          {/* Landing page (public) */}
          <Route
            path="/"
            element={
              <GuestGuard>
                <LandingPage />
              </GuestGuard>
            }
          />

          {/* Public auth routes */}
          <Route
            element={
              <GuestGuard>
                <AuthLayout />
              </GuestGuard>
            }
          >
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/invite/:token" element={<AcceptInvitePage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Full-screen protected editor routes */}
          <Route
            path="/policies/:id/edit"
            element={
              <AuthGuard>
                <InternalGuard>
                  <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
                    <PolicyEditorPage />
                  </RoleGuard>
                </InternalGuard>
              </AuthGuard>
            }
          />

          <Route
            element={
              <AuditorGuard>
                <AuditorLayout />
              </AuditorGuard>
            }
          >
            <Route path="/auditor" element={<AuditorDashboardPage />} />
            <Route path="/auditor/audits/:id" element={<AuditorAuditPage />} />
            <Route path="/auditor/reports" element={<ReportsPage />} />
            <Route path="/auditor/reports/compliance" element={<ComplianceReportPage />} />
            <Route path="/auditor/reports/risk" element={<RiskReportPage />} />
            <Route path="/auditor/reports/vendor" element={<VendorReportPage />} />
          </Route>

          {/* Protected routes with sidebar */}
          <Route
            element={
              <AuthGuard>
                <InternalGuard>
                  <SidebarLayout />
                </InternalGuard>
              </AuthGuard>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/frameworks" element={<FrameworksPage />} />
            <Route path="/frameworks/:code" element={<FrameworkDetailPage />} />
            <Route path="/frameworks/:code/controls" element={<FrameworkDetailPage />} />
            <Route path="/frameworks/:code/readiness" element={<FrameworkDetailPage />} />
            <Route path="/controls" element={<ControlsPage />} />
            <Route path="/tests" element={<TestsPage />} />
            <Route path="/tests/:id" element={<TestDetailPage />} />
            <Route path="/audits" element={<AuditsPage />} />
            <Route path="/audits/:id" element={<AuditDetailPage />} />
            <Route
              path="/reports"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'AUDITOR']}>
                  <ReportsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/reports/compliance"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'AUDITOR']}>
                  <ComplianceReportPage />
                </RoleGuard>
              }
            />
            <Route
              path="/reports/personnel"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
                  <PersonnelReportPage />
                </RoleGuard>
              }
            />
            <Route
              path="/reports/risk"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'AUDITOR']}>
                  <RiskReportPage />
                </RoleGuard>
              }
            />
            <Route
              path="/reports/vendor"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'AUDITOR']}>
                  <VendorReportPage />
                </RoleGuard>
              }
            />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/policies/library" element={<PolicyLibraryPage />} />
            <Route path="/policies/:id" element={<PolicyDetailPage />} />
            <Route path="/documents" element={<EvidencePage />} />
            <Route path="/documents/:id" element={<DocumentDetailPage />} />
            <Route path="/evidence" element={<Navigate to="/documents" replace />} />
            <Route path="/risks" element={<RisksPage />} />
            <Route path="/risks/:id" element={<RiskDetailPage />} />
            <Route path="/risk-management/risk-scenario/:id" element={<RiskScenarioDetailPage />} />
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="/vendors/:id" element={<VendorDetailPage />} />
            <Route path="/personnel" element={<PersonnelTasksPage />} />
            <Route path="/personnel/training/:moduleId" element={<TrainingReadingPage />} />
            <Route path="/personnel/training/:moduleId/quiz" element={<TrainingQuizPage />} />
            <Route
              path="/access-reviews"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
                  <AccessReviewsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/access-reviews/:id"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
                  <AccessReviewDetailPage />
                </RoleGuard>
              }
            />
            <Route path="/devices" element={<DevicesPage />} />
            <Route
              path="/integrations"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
                  <IntegrationsHubPage />
                </RoleGuard>
              }
            />
            <Route
              path="/integrations/aws"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
                  <AwsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/integrations/hr"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
                  <HrPage />
                </RoleGuard>
              }
            />
            <Route path="/risk-library" element={<RiskLibraryPage />} />
            <Route
              path="/settings"
              element={
                <RoleGuard allowedRoles={['ADMIN']}>
                  <SettingsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/settings/people-groups"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
                  <PeopleGroupsPage />
                </RoleGuard>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
      <Toaster richColors position="bottom-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
