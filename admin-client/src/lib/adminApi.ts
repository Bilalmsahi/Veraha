const BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api/v1').replace(/\/$/, '')

export type AdminOrg = {
  id: string
  name: string
  slug?: string
  status: 'pending' | 'active' | 'suspended'
  created_at?: string
  purchasedFrameworkCount: number
  averageReadinessPercent?: number
  assessedControlCompliancePercent?: number
  frameworkReadiness?: Array<{
    id: string
    code: string
    name: string
    readinessPercent: number
    complianceScore?: number
    gaps?: number
    passingRequirements?: number
    totalRequirements?: number
    ready?: boolean
  }>
  latestInvitationStatus: string | null
}

export type AdminFramework = {
  id: string
  name: string
  code: string
  slug: string
  purchased: boolean
  purchasedAt: string | null
  revokedAt: string | null
  readinessPercent: number
  complianceScore?: number
  gaps?: number
  passingRequirements?: number
  totalRequirements?: number
  ready?: boolean
}

export type AdminOrgDetail = {
  id: string
  name: string
  slug?: string
  status: 'pending' | 'active' | 'suspended'
  created_at?: string
  created_by?: string | null
  averageReadinessPercent?: number
  assessedControlCompliancePercent?: number
  frameworks: AdminFramework[]
  invitations: Array<{
    id: string
    email: string
    status: string
    expires_at: string
    created_at: string
  }>
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('veraha_admin_token')
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('veraha_admin_token')
    window.history.replaceState(null, '', '/login')
    window.dispatchEvent(new PopStateEvent('popstate'))
    throw new Error('Your super admin session expired. Sign in again to continue.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'The admin request could not be completed. Please try again.' }))
    throw new Error(err.error || err.message || 'The admin request could not be completed. Please try again.')
  }

  return res.json()
}

export const adminApi = {
  login: (email: string, password: string) =>
    adminFetch<{ token: string }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getOrganisations: () => adminFetch<AdminOrg[]>('/admin/organisations'),
  getOrganisation: (id: string) => adminFetch<AdminOrgDetail>(`/admin/organisations/${id}`),
  createOrganisation: (data: { name: string; slug: string; adminEmail: string }) =>
    adminFetch<{ organization: { _id: string }; organisation: { _id: string } }>('/admin/organisations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateOrgStatus: (id: string, status: 'active' | 'suspended') =>
    adminFetch<AdminOrgDetail>(`/admin/organisations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  addFramework: (orgId: string, frameworkId: string) =>
    adminFetch(`/admin/organisations/${orgId}/frameworks`, {
      method: 'POST',
      body: JSON.stringify({ frameworkId }),
    }),
  removeFramework: (orgId: string, frameworkId: string) =>
    adminFetch(`/admin/organisations/${orgId}/frameworks/${frameworkId}`, { method: 'DELETE' }),
  reinvite: (orgId: string) =>
    adminFetch<{ success: boolean }>(`/admin/organisations/${orgId}/reinvite`, { method: 'POST' }),
}
