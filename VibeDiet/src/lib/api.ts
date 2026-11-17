export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const effectiveToken =
    token !== undefined
      ? token
      : typeof window !== 'undefined'
      ? window.localStorage.getItem('vibediet_admin_token') ||
        window.localStorage.getItem('vibediet_session_token') ||
        null
      : null;

  if (effectiveToken) {
    headers.set('Authorization', `Bearer ${effectiveToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errBody.error || `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}
