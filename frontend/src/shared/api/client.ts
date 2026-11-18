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
  const method = init?.method?.toUpperCase() ?? "GET";
  if (
    !["GET", "HEAD", "OPTIONS"].includes(method) &&
    !headers.has("X-CSRF-Token") &&
    typeof document !== "undefined"
  ) {
    const cookies = document.cookie.split(";").map((value) => value.trim().split("="));
    const csrf =
      cookies.find(([name]) => name === "__Host-crm_csrf") ??
      cookies.find(([name]) => name === "crm_csrf");
    if (csrf?.[1]) headers.set("X-CSRF-Token", decodeURIComponent(csrf[1]));
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const timeout = AbortSignal.timeout(15_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
  });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/") && typeof window !== "undefined")
      window.dispatchEvent(new Event("crm:unauthorized"));
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
