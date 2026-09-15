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
section.pharmacy-service-notice{display:block;box-sizing:border-box;max-width:900px;width:calc(100% - 40px);margin:12px auto;padding:12px 20px !important;border:1px solid #bfdbfe;border-radius:12px;background:#f8fbff;color:#0f172a;text-align:center;overflow:visible}
section.pharmacy-service-notice[hidden],section.pharmacy-service-notice details{display:block !important}
section.pharmacy-service-notice .section-head{text-align:center;margin-left:auto;margin-right:auto}
section.pharmacy-service-notice .section-head h2{text-align:center}
section.pharmacy-service-notice > p{margin:0;font:400 16px/1.5 Inter,system-ui,sans-serif !important;color:#1e293b;text-align:center;overflow-wrap:anywhere}
section.pharmacy-service-notice .pharmacy-service-notice-banner{display:block;margin:0 0 8px;font:400 12px/1.5 Inter,system-ui,sans-serif !important;color:#1e3a8a;text-align:center}
@media (max-width:639px){
  section.pharmacy-service-notice{width:calc(100% - 40px);margin:12px auto;padding:12px 20px !important}
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
<div class="section-head center"><h2>${esc(notice.heading || SERVICE_NOTICE_HEADING)}</h2></div>
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

function insertBeforeHeadingSection(html: string, headingRe: RegExp, snippet: string): string | null {
  const h2Re = new RegExp(`<h2\\b[^>]*>\\s*${headingRe.source}[^<]*<\\/h2>`, "i");
  const h2 = h2Re.exec(html);
  if (!h2 || h2.index == null) return null;
  const open = html.lastIndexOf("<section", h2.index);
  if (open < 0) return null;
  return `${html.slice(0, open)}${snippet}\n${html.slice(open)}`;
}

function insertBeforeTemplateBlock(html: string, block: string, snippet: string): string | null {
  const re = new RegExp(`<section\\b[^>]*data-template-block="${block}"[^>]*>`, "i");
  const match = html.match(re);
  if (!match || match.index == null) return null;
  return `${html.slice(0, match.index)}${snippet}\n${html.slice(match.index)}`;
}

export function injectServiceNoticeBeneathOverview(
  html: string,
  noticeHtml: string,
  _pageKind: "service" | "local",
): string {
  if (/<section\b[^>]*data-component="pharmacy-service-notice"/i.test(html)) return html;
  const beforeConsultationBlock = insertBeforeTemplateBlock(html, "consultation", noticeHtml);
  if (beforeConsultationBlock) return beforeConsultationBlock;
  const beforeConsultationHeading = insertBeforeHeadingSection(
    html,
    /What happens during (?:the |your )?consultation/,
    noticeHtml,
  );
  if (beforeConsultationHeading) return beforeConsultationHeading;
  const beforeFaq = insertBeforeTemplateBlock(html, "faq", noticeHtml);
  if (beforeFaq) return beforeFaq;
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
