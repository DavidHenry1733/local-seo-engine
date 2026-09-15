/**
 * Read-only Technical SEO + Structured Data contract audit report.
 * Does not repair pages, publish, or submit indexing.
 */
import { Router } from "express";
import { loadTechnicalSeoAudit, technicalSeoAuditPath } from "../../../../src/pharmacy/pharmacyTechnicalSeoAuditService.ts";
import { TECHNICAL_SEO_CONTRACT_VERSION, TECHNICAL_SEO_MANDATORY_RULES, TECHNICAL_SEO_PAGE_TYPES } from "../../../../src/pharmacy/pharmacyTechnicalSeoContract.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBarLight,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
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

router.get("/pharmacy-technical-seo-audit", (req, res) => {
  const slug = safeSlug(String(req.query.slug || "pharmaconnect"));
  const serviceId = String(req.query.service || "pharmacy-first");
  const audit = loadTechnicalSeoAudit(slug, serviceId);
  const artefact = technicalSeoAuditPath(slug, serviceId);
  const rows = (audit?.pages || [])
    .map((page) => {
      const status = !page.intendedIndexable ? "not-indexable" : page.eligible ? "eligible" : "blocked";
      const blockers = (page.blockers || []).map((item) => esc(item.message)).join("<br/>") || "—";
      const recs = (page.recommendations || []).map((item) => esc(item.message)).join("<br/>") || "—";
      return `<tr>
        <td>${esc(page.pageType)}</td>
        <td><a href="${esc(page.pageUrl)}" target="_blank" rel="noopener">${esc(page.pageUrl)}</a></td>
        <td>${page.httpStatus ?? "—"}</td>
        <td class="${status}">${status}</td>
        <td>${esc(page.canonical || "—")}</td>
        <td>${esc(page.title || "—")}</td>
        <td>${esc(page.robots || "—")}</td>
        <td>${esc((page.h1 || []).join(" | ") || "—")}</td>
        <td>${esc((page.schemaTypes || []).join(", ") || "—")}</td>
        <td>${blockers}</td>
        <td>${recs}</td>
      </tr>`;
    })
    .join("");

  res.type("html").send(`<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Technical SEO Contract Audit</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f8fafc;color:#0f172a}
main{max-width:1200px;margin:24px auto;padding:0 20px 48px}
.panel{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px}
h1{margin:0 0 8px;font-size:1.4rem}
.meta{color:#64748b;font-size:14px;line-height:1.5}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #e2e8f0;padding:8px;vertical-align:top;text-align:left}
th{background:#f1f5f9}
.eligible{color:#166534;font-weight:700}
.blocked{color:#991b1b;font-weight:700}
.not-indexable{color:#92400e;font-weight:700}
.badge{display:inline-block;padding:4px 10px;border-radius:999px;background:#dbeafe;color:#1e40af;font-size:12px;font-weight:700}
ul{margin:8px 0 0;padding-left:18px;color:#334155;font-size:14px}
${platformPlatformNavCss()}
</style></head><body>
${renderPharmacyPlatformNavBarLight({ slug, serviceId, activeId: "publishing" })}
<main>
<div class="panel">
  <span class="badge">${esc(TECHNICAL_SEO_CONTRACT_VERSION)}</span>
  <h1>Technical SEO + Structured Data Contract</h1>
  <p class="meta">${esc(slug)} · ${esc(serviceId)} · live HTML is authoritative for pre-index validation.<br/>
  Artefact: ${esc(artefact)}<br/>
  ${audit ? `Audited ${esc(audit.auditedAt)} · published ${audit.totalPublishedUrls} · intended indexable ${audit.intendedIndexableUrls} · non-indexable ${audit.intentionallyNonIndexableUrls} · eligible ${audit.eligibleCount} · blocked ${audit.blockedCount}` : "No audit artefact yet."}</p>
</div>
<div class="panel">
  <h2>Index eligibility</h2>
  ${audit ? `<p class="meta">Tenth page: ${esc(audit.tenthPageIdentity || "not identified")}</p>
  <table>
    <thead><tr><th>Type</th><th>URL</th><th>HTTP</th><th>Gate</th><th>Canonical</th><th>Title</th><th>Robots</th><th>H1</th><th>Schema</th><th>Blockers</th><th>Recommendations</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>` : "<p>Run the technical SEO validator to produce the live audit artefact. Nothing is submitted for indexing from this page.</p>"}
</div>
<div class="panel">
  <h2>Registered page types</h2>
  <p class="meta">${TECHNICAL_SEO_PAGE_TYPES.join(", ")}</p>
  <h2>Mandatory rules</h2>
  <ul>${TECHNICAL_SEO_MANDATORY_RULES.map((rule) => `<li>${esc(rule)}</li>`).join("")}</ul>
</div>
</main></body></html>`);
});

export default router;
