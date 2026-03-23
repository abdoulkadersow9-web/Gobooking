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
  options: RequestInit & { token?: string; timeoutMs?: number } = {}
): Promise<T> {
  const { token, timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(rest.headers as Record<string, string> | undefined),
  };

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${BASE_URL}${path}`,
      { ...rest, headers },
      timeoutMs
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Délai dépassé — vérifiez votre connexion réseau");
    }
    throw err;
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}
