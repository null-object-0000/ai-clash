import { API_BASE_URL } from './api'

export type AuthUser = {
  id: number
  displayName?: string
  avatarUrl?: string
  status: 'pending' | 'active' | 'suspended' | 'deleted' | string
  email?: string
  provider?: string
  providerLogin?: string
  identities?: Array<{
    provider: string
    providerLogin?: string
    providerEmail?: string
    providerEmailVerified?: boolean
    providerDisplayName?: string
    providerAvatarUrl?: string
  }>
}

export type AuthState =
  | { authenticated: false; user?: undefined }
  | { authenticated: true; user: AuthUser }

export type AuthStatus = 'loading' | 'ready'

export type SiteAuth = {
  state: AuthState
  status: AuthStatus
  refresh: () => Promise<void>
}

export async function fetchAuthState(): Promise<AuthState> {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
  const data = await res.json().catch(() => null) as AuthState | null
  if (!res.ok || !data) return { authenticated: false }
  return data.authenticated ? data : { authenticated: false }
}

export function startGithubLogin() {
  window.location.href = `${API_BASE_URL}/api/auth/github/start?returnTo=${encodeURIComponent(window.location.href)}`
}

export function startGoogleLogin() {
  window.location.href = `${API_BASE_URL}/api/auth/google/start?returnTo=${encodeURIComponent(window.location.href)}`
}

export function startMicrosoftLogin() {
  window.location.href = `${API_BASE_URL}/api/auth/microsoft/start?returnTo=${encodeURIComponent(window.location.href)}`
}

export async function updateProfile(profile: { displayName: string; avatarUrl?: string }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(profile),
  })
  const data = await res.json().catch(() => null) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
}

export async function logout() {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}
