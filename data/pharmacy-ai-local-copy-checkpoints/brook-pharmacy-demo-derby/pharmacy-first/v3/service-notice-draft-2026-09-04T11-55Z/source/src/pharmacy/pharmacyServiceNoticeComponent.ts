/**
 * Shared service-notice component for service and local-area pages.
 * Renderer-owned wording. Never collapsed, never footer-only.
 */
import type { ServiceNoticeRecord } from "./pharmacyServiceNoticeCatalog.ts";
import { SERVICE_NOTICE_COMPONENT_VERSION } from "./pharmacyServiceNoticeCatalog.ts";
import type { ServiceNoticeSelectionMode } from "./pharmacyServiceNoticeSelection.ts";

export const SERVICE_NOTICE_HEADING = "Eligibility and important information";
export const SERVICE_NOTICE_DRAFT_BANNER =
  "Draft demonstration — not clinical approval. This notice is shown for placement only and is not selected from confirmed service facts for this pharmacy. Confirming a reviewer’s identity does not approve this page content.";
export const SERVICE_NOTICE_MATCHED_DRAFT_BANNER =
  "Draft — awaiting designated clinical reviewer approval of this page content. Confirming a reviewer’s identity does not approve this notice.";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function serviceNoticeComponentCss(): string {
  return `<style data-pharmacy-service-notice="css">
.pharmacy-service-notice{display:block;margin:16px 0 24px;padding:18px 20px;border:1px solid #bfdbfe;border-radius:12px;background:#f8fbff;color:#0f172a;box-sizing:border-box}
.pharmacy-service-notice[hidden],.pharmacy-service-notice details{display:block !important}
.pharmacy-service-notice-banner{display:block;margin:0 0 10px;font:700 12px/1.45 Inter,system-ui,sans-serif;color:#1e3a8a}
.pharmacy-service-notice h2{margin:0 0 10px;font:800 20px/1.3 Inter,system-ui,sans-serif;color:#0f172a}
.pharmacy-service-notice p{margin:0;font:400 15px/1.6 Inter,system-ui,sans-serif;color:#1e293b}
@media (max-width:639px){
  .pharmacy-service-notice{margin:12px 0 20px;padding:16px}
  .pharmacy-service-notice h2{font-size:18px}
}
</style>`;
}

export function renderServiceNoticeComponent(
  notice: ServiceNoticeRecord,
  options: { mode: ServiceNoticeSelectionMode; pageKind: "service" | "local" },
): string {
  const draft = notice.contentApproval.approved !== true || notice.status !== "approved";
  const banner =
    options.mode === "presentation-draft" ? SERVICE_NOTICE_DRAFT_BANNER : draft ? SERVICE_NOTICE_MATCHED_DRAFT_BANNER : "";
  const status = draft ? "draft" : "approved";
  return `<section class="pharmacy-service-notice" id="eligibility-and-important-information" data-component="pharmacy-service-notice" data-notice-id="${esc(notice.id)}" data-notice-version="${esc(notice.version)}" data-component-version="${SERVICE_NOTICE_COMPONENT_VERSION}" data-notice-status="${esc(status)}" data-selection="${esc(options.mode)}" data-page-kind="${esc(options.pageKind)}" data-ai-rewrite="forbidden">
${banner ? `<p class="pharmacy-service-notice-banner">${esc(banner)}</p>` : ""}
<h2>${esc(notice.heading || SERVICE_NOTICE_HEADING)}</h2>
<p>${esc(notice.body)}</p>
</section>`;
}

function matchingSectionEnd(html: string, start: number): number {
  if (!/^<section\b/i.test(html.slice(start))) return -1;
  const re = /<section\b|<\/section>/gi;
  re.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    if (match[0].toLowerCase().startsWith("<section")) depth += 1;
    else depth -= 1;
    if (depth === 0) return match.index + match[0].length;
  }
  return -1;
}

export function insertHtmlAfterTemplateBlock(html: string, block: string, snippet: string): string | null {
  const re = new RegExp(`<section\\b[^>]*data-template-block="${block}"[^>]*>`, "i");
  const match = html.match(re);
  if (!match || match.index == null) return null;
  const end = matchingSectionEnd(html, match.index);
  if (end < 0) return null;
  return `${html.slice(0, end)}\n${snippet}${html.slice(end)}`;
}

export function injectServiceNoticeBeneathOverview(
  html: string,
  noticeHtml: string,
  pageKind: "service" | "local",
): string {
  if (/data-component="pharmacy-service-notice"/i.test(html)) return html;
  const preferred = pageKind === "local" ? ["child-areas", "service-definition"] : ["service-definition", "child-areas"];
  for (const block of preferred) {
    const next = insertHtmlAfterTemplateBlock(html, block, noticeHtml);
    if (next) return next;
  }
  return html;
}

export function applyServiceNoticeToPageHtml(
  html: string,
  notice: ServiceNoticeRecord,
  options: { mode: ServiceNoticeSelectionMode; pageKind: "service" | "local" },
): string {
  const snippet = renderServiceNoticeComponent(notice, options);
  let out = String(html || "");
  if (!/data-pharmacy-service-notice="css"/i.test(out)) {
    out = out.includes("</head>")
      ? out.replace(/<\/head>/i, `${serviceNoticeComponentCss()}\n</head>`)
      : `${serviceNoticeComponentCss()}${out}`;
  }
  return injectServiceNoticeBeneathOverview(out, snippet, options.pageKind);
}
