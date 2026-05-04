import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: false,
    },
  },
});

export async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(path, {
      credentials: "include",
      signal: controller.signal,
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    clearTimeout(timeoutId);

    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body?.error || `Request failed: ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please refresh the page.");
    }
    throw err;
  }
}
