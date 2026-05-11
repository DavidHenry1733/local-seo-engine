const TOKEN_KEY = "_seo_t";

function initToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("_t");
  if (urlToken) {
    sessionStorage.setItem(TOKEN_KEY, urlToken);
    params.delete("_t");
    const newSearch = params.toString();
    const newUrl =
      window.location.pathname +
      (newSearch ? "?" + newSearch : "") +
      window.location.hash;
    window.history.replaceState(null, "", newUrl);
    return urlToken;
  }
  return sessionStorage.getItem(TOKEN_KEY);
}

let _token: string | null = initToken();
let _redirecting = false;

function redirectToLogin(): void {
  if (_redirecting) return;
  _redirecting = true;
  sessionStorage.removeItem(TOKEN_KEY);
  _token = null;
  window.location.href =
    "/api/login?next=" + encodeURIComponent(window.location.pathname);
}

function withToken(url: string): string {
  if (!_token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return url + sep + "_t=" + encodeURIComponent(_token);
}

export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const r = await fetch(withToken(url), {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options?.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (r.status === 401) {
    redirectToLogin();
    return Promise.reject(new Error("Unauthorized — redirecting to login"));
  }

  // fetch() follows 302 redirects automatically — if we land on the HTML
  // login page we need to redirect the user rather than parse broken JSON.
  const contentType = r.headers.get("content-type") ?? "";
  if (r.ok && !contentType.includes("application/json")) {
    redirectToLogin();
    return Promise.reject(new Error("Session expired — redirecting to login"));
  }

  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || r.statusText);
  }

  return r.json() as Promise<T>;
}
