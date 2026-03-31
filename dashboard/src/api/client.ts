export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Erro HTTP ${res.status}`)
  }
  // Handle 204 No Content (e.g. DELETE)
  if (res.status === 204) return undefined as T
  return res.json()
}
