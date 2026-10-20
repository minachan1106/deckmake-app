async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } })
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${r.status}`)
  return r.json()
}
const body = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) })

export const api = {
  get: <T>(path: string) => j<T>('/api' + path),
  post: <T>(path: string, data: unknown) => j<T>('/api' + path, body('POST', data)),
  put: <T>(path: string, data: unknown) => j<T>('/api' + path, body('PUT', data)),
  del: <T>(path: string) => j<T>('/api' + path, { method: 'DELETE' }),
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
export async function readClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText()
  } catch {
    return null
  }
}
