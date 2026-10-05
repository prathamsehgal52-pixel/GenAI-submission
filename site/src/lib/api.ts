/** Typed fetch wrapper for the Armoire API. Errors carry user-safe messages. */
export class ApiError extends Error {
  status: number
  code: string
  data: Record<string, unknown>
  constructor(status: number, code: string, message: string, data: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.data = data
  }
}

type Opts = { method?: string; body?: unknown; signal?: AbortSignal }

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      signal: opts.signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ApiError(0, 'network', 'We couldn’t reach Armoire. Check your connection and try again.')
  }
  const text = await res.text()
  const json = text ? safeParse(text) : {}
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string } }).error
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? 'Something went wrong. Please try again.', (e ?? {}) as Record<string, unknown>)
  }
  return json as T
}

function safeParse(t: string) {
  try {
    return JSON.parse(t)
  } catch {
    return {}
  }
}

export type UploadProgress = (fraction: number) => void

/** Multipart upload with progress (fetch has no upload progress events). */
export function uploadFile<T>(path: string, file: File, onProgress: UploadProgress, method = 'POST'): { promise: Promise<T>; abort: () => void } {
  const xhr = new XMLHttpRequest()
  const promise = new Promise<T>((resolve, reject) => {
    xhr.open(method, `/api${path}`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onerror = () => reject(new ApiError(0, 'network', 'The upload was interrupted. Check your connection and try again.'))
    xhr.onabort = () => reject(new ApiError(0, 'aborted', 'Upload cancelled.'))
    xhr.onload = () => {
      const json = safeParse(xhr.responseText)
      if (xhr.status >= 200 && xhr.status < 300) resolve(json as T)
      else if (xhr.status === 422 && json.results) resolve(json as T)
      else reject(new ApiError(xhr.status, json.error?.code ?? 'error', json.error?.message ?? 'The upload failed. Please try again.'))
    }
    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
  return { promise, abort: () => xhr.abort() }
}

export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
