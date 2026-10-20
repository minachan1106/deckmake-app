async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const label = `${init?.method ?? 'GET'} ${url}`
  let r: Response
  try {
    r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' })
  } catch {
    throw new Error(`通信に失敗: ${label}（認証切れ/電波の可能性。ページを再読込してください）`)
  }
  if (r.redirected || !r.headers.get('content-type')?.includes('json')) {
    throw new Error(`想定外の応答(${r.status}): ${label}（認証画面に飛ばされた可能性。Safariで再ログイン）`)
  }
  if (!r.ok) throw new Error(`${((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'HTTP ' + r.status}: ${label}`)
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
