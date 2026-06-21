import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Building2, LayoutDashboard, Loader2, LogOut, Plus } from 'lucide-react'
import { adminApi, type AdminFramework, type AdminOrg, type AdminOrgDetail } from '@/lib/adminApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import './App.css'

type Route = { path: string; id?: string }

function parseRoute(): Route {
  const path = window.location.pathname
  if (path === '/organisations/new') return { path }
  const orgMatch = path.match(/^\/organisations\/([^/]+)$/)
  if (orgMatch) return { path: '/organisations/:id', id: orgMatch[1] }
  return { path }
}

function navigate(path: string) {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function userError(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

function statusBadge(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'active' || status === 'purchased' || status === 'completed') return 'default'
  if (status === 'suspended' || status === 'expired' || status === 'revoked') return 'destructive'
  return 'secondary'
}

function App() {
  const [route, setRoute] = useState(parseRoute())
  const [token, setToken] = useState(() => localStorage.getItem('veraha_admin_token'))

  useEffect(() => {
    const onRoute = () => setRoute(parseRoute())
    window.addEventListener('popstate', onRoute)
    return () => window.removeEventListener('popstate', onRoute)
  }, [])

  const login = (nextToken: string) => {
    localStorage.setItem('veraha_admin_token', nextToken)
    setToken(nextToken)
    navigate('/dashboard')
  }

  const logout = () => {
    localStorage.removeItem('veraha_admin_token')
    setToken(null)
    navigate('/login')
  }

  if (!token || route.path === '/login') return <LoginPage onLogin={login} />

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar px-4 py-5 md:flex md:flex-col">
        <div className="mb-8 flex items-center">
          <img src="/logo-brand.png" alt="Veraha Admin" className="h-8 object-contain dark:hidden" />
          <img src="/logo-brand-white-text.png" alt="Veraha Admin" className="hidden h-8 object-contain dark:block" />
        </div>
        <nav className="space-y-1">
          <NavButton active={route.path === '/dashboard' || route.path === '/'} onClick={() => navigate('/dashboard')} icon={<LayoutDashboard className="size-4" />} label="Dashboard" />
          <NavButton active={route.path.startsWith('/organisations')} onClick={() => navigate('/organisations')} icon={<Building2 className="size-4" />} label="Organisations" />
        </nav>
        <Button variant="ghost" className="mt-auto justify-start" onClick={logout}>
          <LogOut className="mr-2 size-4" /> Sign out
        </Button>
      </aside>
      <main className="min-h-screen p-4 md:ml-64 md:p-8">
        {route.path === '/' || route.path === '/dashboard' ? <DashboardPage /> : null}
        {route.path === '/organisations' ? <OrganisationsPage /> : null}
        {route.path === '/organisations/new' ? <NewOrganisationPage /> : null}
        {route.path === '/organisations/:id' && route.id ? <OrganisationDetailPage id={route.id} /> : null}
      </main>
    </div>
  )
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60'}`}
    >
      {icon}
      {label}
    </button>
  )
}

function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await adminApi.login(email, password)
      onLogin(res.token)
    } catch (err) {
      setError(userError(err, 'Unable to sign in. Check the credentials and try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader>
          <div className="mb-2">
            <img src="/logo-brand.png" alt="Veraha Admin" className="h-8 object-contain dark:hidden" />
            <img src="/logo-brand-white-text.png" alt="Veraha Admin" className="hidden h-8 object-contain dark:block" />
          </div>
          <CardTitle>Veraha Admin</CardTitle>
          <CardDescription>Sign in with your super admin credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? <><Loader2 className="mr-2 size-4 animate-spin" /> Signing in...</> : 'Sign in'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function useOrganisations() {
  const [data, setData] = useState<AdminOrg[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      setData(await adminApi.getOrganisations())
    } catch (err) {
      setError(userError(err, 'Unable to load organisations. Try refreshing this list.'))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void refresh() }, [])
  return { data, error, loading, refresh }
}

function DashboardPage() {
  const orgs = useOrganisations()
  const stats = useMemo(() => ({
    total: orgs.data.length,
    active: orgs.data.filter((org) => org.status === 'active').length,
    pendingInvites: orgs.data.filter((org) => org.latestInvitationStatus === 'pending').length,
    averageReadiness: orgs.data.length
      ? Math.round(orgs.data.reduce((sum, org) => sum + (org.averageReadinessPercent || 0), 0) / orgs.data.length)
      : 0,
  }), [orgs.data])

  return (
    <PageShell title="Dashboard" action={<Button onClick={() => navigate('/organisations/new')}><Plus className="mr-2 size-4" /> New Organisation</Button>}>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total organisations" value={stats.total} />
        <StatCard label="Active organisations" value={stats.active} />
        <StatCard label="Pending invitations" value={stats.pendingInvites} />
        <StatCard label="Average framework readiness" value={`${stats.averageReadiness}%`} />
      </div>
      <Card>
        <CardHeader><CardTitle>Recent organisations</CardTitle></CardHeader>
        <CardContent><OrgTable orgs={orgs.data.slice(0, 5)} loading={orgs.loading} error={orgs.error} /></CardContent>
      </Card>
    </PageShell>
  )
}

function OrganisationsPage() {
  const orgs = useOrganisations()
  return (
    <PageShell title="Organisations" action={<Button onClick={() => navigate('/organisations/new')}><Plus className="mr-2 size-4" /> New Organisation</Button>}>
      <Card><CardContent className="pt-6"><OrgTable orgs={orgs.data} loading={orgs.loading} error={orgs.error} /></CardContent></Card>
    </PageShell>
  )
}

function OrgTable({ orgs, loading, error }: { orgs: AdminOrg[]; loading: boolean; error: string }) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading organisations...</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Frameworks</TableHead><TableHead>Readiness</TableHead><TableHead>Created</TableHead><TableHead /></TableRow></TableHeader>
      <TableBody>
        {orgs.map((org) => (
          <TableRow key={org.id}>
            <TableCell><div className="font-medium">{org.name}</div><div className="text-xs text-muted-foreground">{org.slug}</div></TableCell>
            <TableCell><Badge variant={statusBadge(org.status)}>{org.status}</Badge></TableCell>
            <TableCell>{org.purchasedFrameworkCount}</TableCell>
            <TableCell><ReadinessBar value={org.averageReadinessPercent || 0} /></TableCell>
            <TableCell>{formatDate(org.created_at)}</TableCell>
            <TableCell><Button variant="outline" size="sm" onClick={() => navigate(`/organisations/${org.id}`)}>View</Button></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function NewOrganisationPage() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [createdId, setCreatedId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const res = await adminApi.createOrganisation({ name, slug, adminEmail })
      setCreatedId(res.organization?._id || res.organisation?._id)
      setNotice(`Organisation ${name} created and an invitation was sent to ${adminEmail}.`)
    } catch (err) {
      setError(userError(err, 'Unable to create organisation. Check the details and try again.'))
    } finally {
      setLoading(false)
    }
  }

  if (createdId) {
    return (
      <PageShell title="New Organisation">
        <Card><CardContent className="space-y-4 pt-6">{notice && <StatusMessage tone="success">{notice}</StatusMessage>}<div className="flex gap-2"><Button onClick={() => navigate(`/organisations/${createdId}`)}>View Organisation</Button><Button variant="outline" onClick={() => { setName(''); setSlug(''); setAdminEmail(''); setCreatedId(''); setNotice('') }}>Create Another</Button></div></CardContent></Card>
      </PageShell>
    )
  }

  return (
    <PageShell title="New Organisation">
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Create organisation</CardTitle><CardDescription>The admin user will receive an invitation email.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(event) => { setName(event.target.value); setSlug(slugify(event.target.value)) }} required /></div>
            <div className="space-y-2"><Label>Slug</Label><Input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required /><p className="text-xs text-muted-foreground">{slug || 'organisation-slug'}</p></div>
            <div className="space-y-2"><Label>Admin email</Label><Input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} required /></div>
            <Button disabled={loading}>{loading ? <><Loader2 className="mr-2 size-4 animate-spin" /> Creating organisation...</> : 'Create Organisation'}</Button>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  )
}

function OrganisationDetailPage({ id }: { id: string }) {
  const [org, setOrg] = useState<AdminOrgDetail | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const load = async () => {
    setLoading(true)
    setError('')
    try { setOrg(await adminApi.getOrganisation(id)) } catch (err) { setError(userError(err, 'Unable to load organisation. Try opening it again from the organisations list.')) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [id])

  const updateStatus = async (status: 'active' | 'suspended') => {
    if (status === 'suspended' && !window.confirm(`Suspend ${org?.name}? Organisation users will not be able to access the platform until it is reactivated.`)) return
    setError('')
    setNotice('')
    setAction(`status:${status}`)
    try {
      const updated = await adminApi.updateOrgStatus(id, status)
      setOrg(updated)
      setNotice(status === 'active' ? `${updated.name} was activated.` : `${updated.name} was suspended.`)
    } catch (err) {
      setError(userError(err, `Unable to ${status === 'active' ? 'activate' : 'suspend'} organisation. Try again.`))
    } finally {
      setAction('')
    }
  }

  const updateFramework = async (framework: AdminFramework) => {
    if (framework.purchased) {
      if (!window.confirm(`Revoke ${org?.name}'s access to ${framework.name}? Their readiness data will be retained.`)) return
      setAction(`framework:${framework.id}`)
      setError('')
      setNotice('')
      try {
        await adminApi.removeFramework(id, framework.id)
        const updated = await adminApi.getOrganisation(id)
        setOrg(updated)
        setNotice(`${framework.name} access revoked for ${updated.name}. Readiness data was retained.`)
      } catch (err) {
        setError(userError(err, `Unable to revoke ${framework.name}. Try again.`))
      } finally {
        setAction('')
      }
    } else {
      if (!window.confirm(`Grant ${org?.name} access to ${framework.name}?`)) return
      setAction(`framework:${framework.id}`)
      setError('')
      setNotice('')
      try {
        await adminApi.addFramework(id, framework.id)
        const updated = await adminApi.getOrganisation(id)
        setOrg(updated)
        setNotice(`${framework.name} access granted to ${updated.name}. Linked data is available now.`)
      } catch (err) {
        setError(userError(err, `Unable to grant ${framework.name}. Try again.`))
      } finally {
        setAction('')
      }
    }
  }

  if (loading) return <PageShell title="Organisation"><p className="text-sm text-muted-foreground">Loading organisation...</p></PageShell>
  if (error || !org) return <PageShell title="Organisation"><p className="text-sm text-destructive">{error || 'Organisation not found'}</p></PageShell>
  const latestInvitation = org.invitations[0]

  return (
    <PageShell title={org.name} description={org.slug}>
      {notice && <StatusMessage tone="success">{notice}</StatusMessage>}
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      <Tabs defaultValue="overview">
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="frameworks">Frameworks</TabsTrigger><TabsTrigger value="invitation">Invitation</TabsTrigger></TabsList>
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={statusBadge(org.status)}>{org.status}</Badge>
                <p className="text-sm text-muted-foreground">Created {formatDate(org.created_at)} by {org.created_by || 'system'}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Average framework readiness</h3>
                  <ReadinessBar value={org.averageReadinessPercent || 0} className="mt-2 max-w-xl" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Assessed-control compliance: {Math.round(org.assessedControlCompliancePercent || 0)}%
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">By framework</h3>
                  {org.frameworks.filter((framework) => framework.purchased).map((framework) => (
                    <div key={framework.id} className="flex items-center gap-3 rounded-md p-2">
                      <span className="w-24 shrink-0 text-sm font-medium">{framework.name}</span>
                      <ReadinessBar value={framework.readinessPercent} className="flex-1" />
                    </div>
                  ))}
                  {org.frameworks.every((framework) => !framework.purchased) && (
                    <p className="text-sm text-muted-foreground">No purchased frameworks yet.</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">{org.status === 'suspended' ? <Button onClick={() => updateStatus('active')} disabled={!!action}>{action === 'status:active' ? <><Loader2 className="mr-2 size-4 animate-spin" /> Activating...</> : 'Activate'}</Button> : <Button variant="destructive" onClick={() => updateStatus('suspended')} disabled={!!action}>{action === 'status:suspended' ? <><Loader2 className="mr-2 size-4 animate-spin" /> Suspending...</> : 'Suspend'}</Button>}</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="frameworks" className="mt-4">
          <Card><CardContent className="pt-6"><Table><TableHeader><TableRow><TableHead>Framework</TableHead><TableHead>Status</TableHead><TableHead>Readiness</TableHead><TableHead>Purchased</TableHead><TableHead /></TableRow></TableHeader><TableBody>{org.frameworks.map((framework) => <TableRow key={framework.id}><TableCell>{framework.name}</TableCell><TableCell><Badge variant={framework.purchased ? 'default' : 'secondary'}>{framework.purchased ? 'Purchased' : 'Not purchased'}</Badge></TableCell><TableCell>{framework.readinessPercent}%</TableCell><TableCell>{formatDate(framework.purchasedAt)}</TableCell><TableCell><Button variant={framework.purchased ? 'destructive' : 'default'} size="sm" disabled={!!action} onClick={() => updateFramework(framework)}>{action === `framework:${framework.id}` ? <><Loader2 className="mr-2 size-4 animate-spin" /> {framework.purchased ? 'Revoking...' : 'Granting...'}</> : framework.purchased ? 'Revoke' : 'Grant Access'}</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="invitation" className="mt-4">
          <Card><CardContent className="space-y-4 pt-6">{latestInvitation ? <><div><p className="font-medium">{latestInvitation.email}</p><p className="text-sm text-muted-foreground">Expires {formatDate(latestInvitation.expires_at)}</p></div><Badge variant={statusBadge(latestInvitation.status)}>{latestInvitation.status}</Badge><div><Button disabled={!!action} onClick={async () => { setAction('reinvite'); setError(''); setNotice(''); try { await adminApi.reinvite(id); const updated = await adminApi.getOrganisation(id); setOrg(updated); setNotice(`Invitation resent to ${latestInvitation.email}.`) } catch (err) { setError(userError(err, 'Unable to resend invitation. Try again.')) } finally { setAction('') } }}>{action === 'reinvite' ? <><Loader2 className="mr-2 size-4 animate-spin" /> Resending...</> : 'Resend Invitation'}</Button></div></> : <p className="text-sm text-muted-foreground">No invitation has been sent.</p>}</CardContent></Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return <Card><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-3xl">{value}</CardTitle></CardHeader></Card>
}

function ReadinessBar({ value, className = '' }: { value: number; className?: string }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value || 0)))
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${safeValue}%` }} />
      </div>
      <span className="w-10 text-right text-sm font-medium text-primary">{safeValue}%</span>
    </div>
  )
}

function StatusMessage({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  const classes =
    tone === 'success'
      ? 'border-primary/30 bg-primary/10 text-primary'
      : 'border-destructive/30 bg-destructive/10 text-destructive'
  return <div className={`rounded-md border px-3 py-2 text-sm ${classes}`}>{children}</div>
}

function PageShell({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-2xl font-semibold">{title}</h1>{description && <p className="text-sm text-muted-foreground">{description}</p>}</div>
        {action}
      </div>
      {children}
    </div>
  )
}

export default App
