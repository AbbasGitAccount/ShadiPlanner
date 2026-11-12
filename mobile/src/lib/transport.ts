export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(message: string, status = 0, fields?: Record<string, string>) { super(message); this.status = status; this.fields = fields; }
}
export function normalizeBase(value: string, development: boolean) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP(S) API URL without credentials, query parameters or a fragment.');
  if (!development && url.protocol !== 'https:') throw new Error('Release builds require an HTTPS API URL.');
  return value.replace(/\/+$/, '').replace(/\/api$/, '') + '/api';
}
export function createTransport(base: string, getToken: () => string | null, unauthorized: () => void) {
  return async function request<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', format: 'json' | 'text' = 'json'): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) throw new ApiError('Invalid API path');
    const token = getToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(base + path, { method, signal: controller.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const text = await response.text();
      let data: { message?: string; fieldErrors?: Record<string, string> } | undefined;
      try { data = text ? JSON.parse(text) : undefined; } catch { /* Proxy and startup failures may return plain text. */ }
      if (response.status === 401 && token && token === getToken()) unauthorized();
      if (!response.ok) throw new ApiError(data?.message || `The server could not complete this request (HTTP ${response.status}).`, response.status, data?.fieldErrors);
      if (format === 'text') return text as T;
      if (!data) throw new ApiError('The server returned an invalid response. Please try again.');
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted ? 'The request timed out. Check your connection and try again.' : 'Cannot reach ShadiPlanner. Check your connection and the API address.');
    } finally { clearTimeout(timeout); }
  };
}
