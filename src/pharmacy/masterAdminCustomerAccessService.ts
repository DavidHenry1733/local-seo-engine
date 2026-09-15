/**
 * Master Admin Customer Access V1 — safe admin dashboard viewing with audit trail.
 */
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import fs from "node:fs";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";

export interface MasterAdminCustomerAccessSession {
  slug: string;
  pharmacyName: string;
  dashboardUrl: string;
  accessUrl: string;
  returnUrl: string;
  readOnly: boolean;
  accessedAt: string;
  accessedBy: string;
}

export function openMasterAdminCustomerDashboardAccess(
  slug: string,
  accessedBy: string,
): MasterAdminCustomerAccessSession {
  const safe = safeAdminSlug(slug);
  if (!safe) throw new Error("Invalid tenant slug");

  let pharmacyName = safe;
  const profileFile = profilePath(safe);
  if (fs.existsSync(profileFile)) {
    try {
      const doc = JSON.parse(fs.readFileSync(profileFile, "utf8")) as { data?: Record<string, unknown> };
      pharmacyName = normalizeProfileData(doc.data || {}).pharmacyName || safe;
    } catch {
      /* ignore */
    }
  }

  const returnUrl = "/api/admin/master";
  const dashboardUrl = `/api/pharmacy-dashboard?slug=${encodeURIComponent(safe)}&masterAdminView=1`;
  const accessUrl = `/api/admin/master/customer-access/${encodeURIComponent(safe)}`;

  recordMasterAdminAudit({
    user: accessedBy,
    slug: safe,
    action: "admin_customer_dashboard_access",
    status: "success",
    evidence: `Master Admin opened customer dashboard for ${pharmacyName}`,
    meta: { readOnly: true, returnUrl, dashboardUrl },
  });

  return {
    slug: safe,
    pharmacyName,
    dashboardUrl,
    accessUrl,
    returnUrl,
    readOnly: true,
    accessedAt: new Date().toISOString(),
    accessedBy,
  };
}

export function renderMasterAdminCustomerAccessHtml(session: MasterAdminCustomerAccessSession): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Admin View · ${esc(session.pharmacyName)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;height:100vh;display:flex;flex-direction:column}
.admin-banner{background:#f59e0b;color:#0f172a;padding:10px 20px;display:flex;align-items:center;gap:16px;font-size:.85rem;font-weight:700;flex-shrink:0}
.admin-banner a{color:#0f172a;text-decoration:underline}
.admin-banner .pill{background:#0f172a;color:#f59e0b;padding:3px 10px;border-radius:999px;font-size:.7rem}
.frame-wrap{flex:1;border:none}
iframe{width:100%;height:100%;border:none;background:#fff}
</style>
</head>
<body>
<div class="admin-banner">
  <span class="pill">MASTER ADMIN</span>
  <span>Viewing customer dashboard: <strong>${esc(session.pharmacyName)}</strong> (${esc(session.slug)}) — read-only impersonation</span>
  <span style="margin-left:auto"><a href="${esc(session.returnUrl)}">← Return to Master Admin</a></span>
</div>
<div class="frame-wrap">
  <iframe src="${esc(session.dashboardUrl)}" title="Customer dashboard"></iframe>
</div>
</body>
</html>`;
}
