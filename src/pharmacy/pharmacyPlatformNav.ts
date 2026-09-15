/**
 * PharmaConnect Platform Navigation V1 — consistent module nav across authenticated pages.
 */
import { PRIMARY_PLATFORM_SERVICE_ID } from "./pharmacyPlatformDashboardService.ts";
import { resolveCampaignImprovementsServiceForTenant } from "./pharmacyCampaignImprovementsServiceAuthority.ts";

export type PlatformNavId =
  | "growth-engine"
  | "platform-dashboard"
  | "profile"
  | "campaign-os"
  | "images"
  | "authority"
  | "enhancement"
  | "growth-dashboard"
  | "publishing"
  | "indexing"
  | "visibility"
  | "growth-actions";

export interface PlatformNavItem {
  id: PlatformNavId;
  label: string;
  url: string;
}

export interface PharmacyPlatformNavOptions {
  slug: string;
  serviceId?: string;
  activeId?: PlatformNavId;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeSlug(v: string): string {
  return (
    String(v || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

/** Canonical platform module links — every link retains slug (and service where relevant). */
export function buildPlatformNavItems(slug: string, serviceId?: string): PlatformNavItem[] {
  const s = safeSlug(slug);
  const svc = serviceId || PRIMARY_PLATFORM_SERVICE_ID;
  const improvementsService =
    resolveCampaignImprovementsServiceForTenant(s, serviceId).resolvedServiceId || svc;
  return [
    { id: "growth-engine", label: "Growth Engine", url: `/api/growth-engine?slug=${s}` },
    { id: "platform-dashboard", label: "Dashboard", url: `/api/pharmacy-dashboard?slug=${s}` },
    { id: "profile", label: "Profile Wizard", url: `/api/pharmacy-profile-wizard?slug=${s}` },
    { id: "campaign-os", label: "Campaign OS", url: `/api/pharmacy-campaigns?slug=${s}` },
    { id: "images", label: "Image Library", url: `/api/pharmacy-image-library?slug=${s}&service=${svc}` },
    {
      id: "authority",
      label: "Content Review",
      url: `/api/pharmacy-authority-readiness?slug=${s}&service=${svc}`,
    },
    {
      id: "enhancement",
      label: "Campaign Improvements",
      url: `/api/pharmacy-enhancement-workspace?slug=${s}&service=${improvementsService}`,
    },
    { id: "growth-dashboard", label: "Growth Dashboard", url: `/api/pharmacy-growth-dashboard?slug=${s}` },
    {
      id: "publishing",
      label: "Ready To Publish",
      url: `/api/pharmacy-publishing-settings?slug=${s}&service=${svc}`,
    },
    { id: "indexing", label: "Indexing", url: `/api/pharmacy-growth-dashboard?slug=${s}#indexing` },
    { id: "visibility", label: "Search Visibility", url: `/api/pharmacy-growth-dashboard?slug=${s}#visibility` },
    { id: "growth-actions", label: "Recommended Improvements", url: `/api/pharmacy-growth-actions?slug=${s}` },
  ];
}

/** Compact workflow bar — Return to Dashboard + Continue Next Step */
export function renderPlatformWorkflowBar(options: {
  slug: string;
  nextStepUrl?: string | null;
  nextStepLabel?: string;
  previousStepUrl?: string | null;
  dashboardLabel?: string;
}): string {
  const s = safeSlug(options.slug);
  const growthUrl = `/api/pharmacy-dashboard?slug=${esc(s)}`;
  const dashboardLabel = options.dashboardLabel || "Return to Dashboard";
  const nextUrl = options.nextStepUrl || growthUrl;
  const nextLabel = options.nextStepLabel || "Continue Next Step";
  const prev =
    options.previousStepUrl &&
    `<a class="workflow-btn workflow-btn-ghost" href="${esc(options.previousStepUrl)}">Previous Step</a>`;
  return `<div class="platform-workflow-bar" data-component="platform-workflow-bar">
  <a class="workflow-btn workflow-btn-ghost" href="${growthUrl}">${esc(dashboardLabel)}</a>
  ${prev || ""}
  <a class="workflow-btn workflow-btn-primary" href="${esc(nextUrl)}">${esc(nextLabel)}</a>
</div>`;
}

export function platformPlatformNavCss(): string {
  return `${platformWorkflowBarCss()}
.platform-nav{margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.18)}
.platform-nav-back{display:inline-flex;align-items:center;gap:6px;margin-bottom:10px;padding:8px 14px;border-radius:8px;background:rgba(255,255,255,.22);color:#fff;font-weight:800;font-size:13px;text-decoration:none}
.platform-nav-back:hover{background:rgba(255,255,255,.32)}
.platform-nav-links{display:flex;flex-wrap:wrap;gap:8px}
.platform-nav-links a{border:0;border-radius:8px;padding:9px 14px;font-weight:700;font-size:13px;text-decoration:none;background:rgba(255,255,255,.15);color:#fff;white-space:nowrap}
.platform-nav-links a:hover{background:rgba(255,255,255,.25)}
.platform-nav-links a.active{background:#fff;color:#0f172a}
.platform-nav--light .platform-nav-back{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe}
.platform-nav--light .platform-nav-links a{background:#f8fafc;color:#1e40af;border:1px solid #e2e8f0}
.platform-nav--light .platform-nav-links a.active{background:#005eb8;color:#fff;border-color:#005eb8}`;
}

export function platformWorkflowBarCss(): string {
  return `.platform-workflow-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:16px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px}
.workflow-btn{display:inline-flex;align-items:center;padding:10px 16px;border-radius:9px;font-weight:800;font-size:13px;text-decoration:none;border:1px solid #cbd5e1;color:#1e293b;background:#fff}
.workflow-btn-primary{background:#005eb8;border-color:#005eb8;color:#fff}
.workflow-btn-ghost:hover{background:#eff6ff}
.field-tier{display:inline-block;font-size:10px;font-weight:800;text-transform:uppercase;border-radius:999px;padding:2px 7px;margin-left:6px;vertical-align:middle}
.field-tier-required{background:#fef2f2;color:#b91c1c}
.field-tier-optional{background:#f1f5f9;color:#64748b}
.save-banner{display:none;margin:12px 0;padding:12px 16px;border-radius:10px;font-weight:700;font-size:14px}
.save-banner.ok{display:block;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0}
.save-banner.err{display:block;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}`;
}

/** Renders back-to-dashboard link plus full module nav bar. */
export function renderPharmacyPlatformNavBar(options: PharmacyPlatformNavOptions): string {
  const s = safeSlug(options.slug);
  const svc = options.serviceId || PRIMARY_PLATFORM_SERVICE_ID;
  const items = buildPlatformNavItems(s, svc);
  const active = options.activeId;

  const links = items
    .filter((item) => item.id !== "platform-dashboard")
    .map((item) => {
      const cls = item.id === active ? ' class="active"' : "";
      return `<a href="${esc(item.url)}"${cls}>${esc(item.label)}</a>`;
    })
    .join("\n    ");

  return `<nav class="platform-nav" aria-label="Platform modules" data-component="pharmacy-platform-nav">
  <a class="platform-nav-back" href="/api/growth-engine?slug=${esc(s)}">← Back to Growth Engine</a>
  <div class="platform-nav-links">
    ${links}
  </div>
</nav>`;
}

/** Compact variant for pages with a light header (e.g. Publishing Settings). */
export function renderPharmacyPlatformNavBarLight(options: PharmacyPlatformNavOptions): string {
  const bar = renderPharmacyPlatformNavBar(options);
  return bar.replace('class="platform-nav"', 'class="platform-nav platform-nav--light"');
}
