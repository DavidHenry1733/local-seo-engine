const SLUG_KEY = "selectedSlug";
const VIEW_KEY = "pharmacyWorkspaceView";

export type PharmacyWorkspacePanelId = "profile" | "import" | "catchment" | "campaigns";

export function readWorkspaceSlug(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return String(params.get("slug") || localStorage.getItem(SLUG_KEY) || "").trim();
}

export function isWorkspaceLandscapeOpen(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("slug")) return true;
  return localStorage.getItem(VIEW_KEY) === "landscape" && Boolean(localStorage.getItem(SLUG_KEY));
}

export function pharmacyWorkspaceHref(slug: string): string {
  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  params.set("slug", String(slug || "").trim());
  return `?${params.toString()}#workspace-profile`;
}

export function activatePharmacyWorkspace(slug: string, panel: PharmacyWorkspacePanelId = "profile"): void {
  const next = String(slug || "").trim();
  if (!next || typeof window === "undefined") return;
  localStorage.setItem(SLUG_KEY, next);
  localStorage.setItem(VIEW_KEY, "landscape");
  const params = new URLSearchParams(window.location.search);
  const alreadyOpen = params.get("slug") === next;
  params.set("slug", next);
  window.location.hash = `workspace-${panel}`;
  if (alreadyOpen) {
    window.dispatchEvent(new CustomEvent("pharmacy-workspace-activate", { detail: { slug: next, panel } }));
    return;
  }
  window.location.search = `?${params.toString()}`;
}

export function closePharmacyWorkspace(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VIEW_KEY, "picker");
  const url = new URL(window.location.href);
  url.searchParams.delete("slug");
  url.hash = "";
  window.history.pushState({ view: "picker" }, "", url.toString());
  window.dispatchEvent(new CustomEvent("pharmacy-workspace-close"));
}

export function workspacePanelFromHash(): PharmacyWorkspacePanelId {
  const hash = typeof window === "undefined" ? "" : window.location.hash;
  if (hash.includes("import")) return "import";
  if (hash.includes("catchment")) return "catchment";
  if (hash.includes("campaign")) return "campaigns";
  return "profile";
}

function copyLiveSearchToken(params: URLSearchParams): void {
  if (typeof window === "undefined") return;
  const token = new URLSearchParams(window.location.search).get("_t");
  if (token) params.set("_t", token);
}

export function campaignBuilderChooseUrl(slug: string, serviceKey: string): string {
  const params = new URLSearchParams();
  params.set("slug", String(slug || "").trim());
  params.set("step", "choose");
  params.set("campaign", String(serviceKey || "").trim());
  copyLiveSearchToken(params);
  return `/api/growth-engine/campaign-builder?${params.toString()}`;
}

export function pharmacyProfileWizardHref(slug: string): string {
  const params = new URLSearchParams();
  params.set("slug", String(slug || "").trim());
  copyLiveSearchToken(params);
  return `/api/pharmacy-profile-wizard?${params.toString()}`;
}
