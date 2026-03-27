export const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * fetch() avec AbortController timeout.
 * Si le serveur ne répond pas dans `timeoutMs`, rejette avec "Request timeout".
 */
function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

export async function apiFetch<T>(
  path: string,
  options: (Omit<RequestInit, "body"> & { token?: string; timeoutMs?: number; body?: unknown }) = {}
): Promise<T> {
  const { token, timeoutMs = DEFAULT_TIMEOUT_MS, body, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(rest.headers as Record<string, string> | undefined),
  };

  /* Auto-serialize plain-object bodies to JSON */
  const serializedBody: BodyInit | null | undefined =
    body === undefined || body === null
      ? undefined
      : typeof body === "string" || body instanceof Blob || body instanceof FormData
        ? (body as BodyInit)
        : JSON.stringify(body);

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${BASE_URL}${path}`,
      { ...rest, body: serializedBody, headers },
      timeoutMs
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Délai dépassé — vérifiez votre connexion réseau");
    }
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    const err = new Error(body.error || `HTTP ${res.status}`) as Error & Record<string, unknown>;
    /* Preserve all server fields (code, bookingRef, passenger, …) on the error object */
    Object.assign(err, body);
    /* Always expose the HTTP status for auth-error detection */
    err.httpStatus = res.status;
    throw err;
  }

  return res.json();
}
