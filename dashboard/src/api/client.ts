const API_BASE = import.meta.env.PROD ? 'https://api.retornabrasil.com' : ''

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> || {}),
    },
  })

  // Session expired or invalid → redirect to login
  if (res.status === 401) {
    const isAuthRoute = path.startsWith('/auth/')
    if (!isAuthRoute) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      window.location.href = '/login'
      throw new Error('Sessao expirada')
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Erro HTTP ${res.status}`)
  }

  // Handle 204 No Content (e.g. DELETE)
  if (res.status === 204) return undefined as unknown as T
  return res.json()
}
