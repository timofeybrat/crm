export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API request failed (${status})`);
    this.name = "ApiError";
  }
}

// Browser requests use the same-origin Next.js proxy. Server-side callers must
// provide an absolute backend URL instead of using this browser client.
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const timeout = AbortSignal.timeout(15_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const response = await fetch(`/api${path}`, { ...init, headers, signal });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
