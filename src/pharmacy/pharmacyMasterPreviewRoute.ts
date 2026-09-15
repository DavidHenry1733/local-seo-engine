/**
 * Read-only HTML preview for pharmacy master content library human review.
 * No writes, no generation, no publishing side effects.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "docs/pharmacy-master-library"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

const WORKSPACE_ROOT = resolveWorkspaceRoot();
const MASTER_LIBRARY_DIR = path.join(WORKSPACE_ROOT, "docs/pharmacy-master-library");

type PreviewTab = { id: string; label: string; file: string };

type ServicePreviewConfig = {
  title: string;
  subtitle: string;
  banner: string;
  pageTitle: string;
  tabs: readonly PreviewTab[];
};

const SERVICE_PREVIEW_CONFIG: Record<string, ServicePreviewConfig> = {
  "pharmacy-first": {
    title: "Pharmacy First — Master Content Library",
    subtitle: "PharmaConnect Content Rebuild V1 · six versions for human review",
    banner: "READ ONLY — master content preview only. Not published.",
    pageTitle: "Pharmacy First — Master Content Preview",
    tabs: [
      { id: "master", label: "Master V1", file: "pharmacy-first-master-v1.md" },
      { id: "v1", label: "Variation 1", file: "pharmacy-first-variation-1.md" },
      { id: "v2", label: "Variation 2", file: "pharmacy-first-variation-2.md" },
      { id: "v3", label: "Variation 3", file: "pharmacy-first-variation-3.md" },
      { id: "v4", label: "Variation 4", file: "pharmacy-first-variation-4.md" },
      { id: "v5", label: "Variation 5", file: "pharmacy-first-variation-5.md" },
    ],
  },
  "blood-pressure-checks": {
    title: "Blood Pressure Checks — Master Content Library",
    subtitle: "Master V1 draft · human review before QA sign-off",
    banner: "MASTER LIBRARY PREVIEW — NOT APPROVED FOR PUBLISHING",
    pageTitle: "Blood Pressure Checks — Master Content Preview",
    tabs: [{ id: "master", label: "Master V1", file: "blood-pressure-checks-master-v1.md" }],
  },
  "travel-vaccinations": {
    title: "Travel Vaccinations — Master Content Library",
    subtitle: "Master V1 draft · human review before QA sign-off",
    banner: "MASTER LIBRARY PREVIEW — NOT APPROVED FOR PUBLISHING",
    pageTitle: "Travel Vaccinations — Master Content Preview",
    tabs: [{ id: "master", label: "Master V1", file: "travel-vaccinations-master-v1.md" }],
  },
  "prescription-dispensing": {
    title: "Prescription Dispensing — Master Content Library",
    subtitle: "Master V1 draft · human review before QA sign-off",
    banner: "MASTER LIBRARY PREVIEW — NOT APPROVED FOR PUBLISHING",
    pageTitle: "Prescription Dispensing — Master Content Preview",
    tabs: [{ id: "master", label: "Master V1", file: "prescription-dispensing-master-v1.md" }],
  },
};

const SERVICE_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

function escHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(text: string): string {
  let s = escHtml(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return s;
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function renderTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const [header, ...body] = rows;
  const thead = `<thead><tr>${header!.map((c) => `<th>${inlineFormat(c)}</th>`).join("")}</tr></thead>`;
  const tbody =
    body.length > 0
      ? `<tbody>${body.map((row) => `<tr>${row.map((c) => `<td>${inlineFormat(c)}</td>`).join("")}</tr>`).join("")}</tbody>`
      : "";
  return `<div class="table-wrap"><table>${thead}${tbody}</table></div>`;
}

function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    if (trimmed.startsWith("<!--") && trimmed.endsWith("-->")) {
      continue;
    }

    if (trimmed === "---") {
      closeList();
      out.push("<hr/>");
      continue;
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]!.trim())) {
      closeList();
      const tableRows: string[][] = [parseTableRow(trimmed)];
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith("|")) {
        tableRows.push(parseTableRow(lines[i]!.trim()));
        i++;
      }
      i--;
      out.push(renderTable(tableRows));
      continue;
    }

    if (trimmed.startsWith("# ")) {
      closeList();
      out.push(`<h1>${inlineFormat(trimmed.slice(2).trim())}</h1>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeList();
      out.push(`<h2>${inlineFormat(trimmed.slice(3).trim())}</h2>`);
      continue;
    }
    if (trimmed.startsWith("### ")) {
      closeList();
      out.push(`<h3>${inlineFormat(trimmed.slice(4).trim())}</h3>`);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inlineFormat(bullet[1]!)}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inlineFormat(trimmed)}</p>`);
  }

  closeList();
  return out.join("\n");
}

function loadTabContent(file: string): string {
  const filePath = path.join(MASTER_LIBRARY_DIR, file);
  if (!fs.existsSync(filePath)) {
    return `<p class="error">File not found: ${escHtml(file)}</p>`;
  }
  return markdownToHtml(fs.readFileSync(filePath, "utf8"));
}

function previewStyles(): string {
  return `<style>
:root { --bg:#f8fafc; --surface:#fff; --ink:#0f172a; --muted:#64748b; --border:#e2e8f0; --accent:#005eb8; --accent-soft:#eaf5fa; }
* { box-sizing:border-box; }
body { margin:0; font-family:Inter,system-ui,-apple-system,sans-serif; background:var(--bg); color:var(--ink); line-height:1.65; }
.preview-banner { background:#fef3c7; border-bottom:1px solid #fcd34d; padding:10px 24px; font-size:.875rem; font-weight:600; color:#92400e; letter-spacing:.01em; text-align:center; }
.preview-header { background:var(--surface); border-bottom:1px solid var(--border); padding:20px 24px 0; }
.preview-header h1 { margin:0 0 4px; font-size:1.35rem; }
.preview-header p { margin:0 0 16px; color:var(--muted); font-size:.9rem; }
.tab-bar { display:flex; flex-wrap:wrap; gap:6px; }
.tab-bar.single-tab { display:none; }
.tab-btn { appearance:none; border:1px solid var(--border); border-bottom:none; background:var(--bg); color:var(--ink); padding:10px 16px; border-radius:8px 8px 0 0; cursor:pointer; font-size:.875rem; font-weight:500; }
.tab-btn:hover { background:var(--accent-soft); }
.tab-btn.active { background:var(--surface); color:var(--accent); font-weight:600; position:relative; z-index:1; }
.preview-main { max-width:820px; margin:0 auto; padding:24px; }
.tab-panel { display:none; background:var(--surface); border:1px solid var(--border); border-radius:0 12px 12px 12px; padding:32px 36px; box-shadow:0 1px 3px rgba(15,23,42,.06); }
.tab-panel.active { display:block; }
.tab-panel.single-panel { display:block; border-radius:12px; }
.tab-panel h1 { font-size:1.5rem; margin:0 0 1rem; color:var(--accent); }
.tab-panel h2 { font-size:1.15rem; margin:2rem 0 .75rem; padding-top:.5rem; border-top:1px solid var(--border); color:#003087; }
.tab-panel h2:first-of-type { border-top:none; margin-top:0; padding-top:0; }
.tab-panel h3 { font-size:1rem; margin:1.25rem 0 .5rem; }
.tab-panel p { margin:0 0 1rem; }
.tab-panel ul { margin:0 0 1rem; padding-left:1.25rem; }
.tab-panel li { margin-bottom:.5rem; }
.tab-panel hr { border:none; border-top:1px solid var(--border); margin:1.5rem 0; }
.tab-panel code { background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:.875em; }
.tab-panel .table-wrap { overflow-x:auto; margin:0 0 1.25rem; }
.tab-panel table { width:100%; border-collapse:collapse; font-size:.875rem; }
.tab-panel th, .tab-panel td { border:1px solid var(--border); padding:8px 10px; text-align:left; vertical-align:top; }
.tab-panel th { background:var(--accent-soft); font-weight:600; }
.tab-panel .error { color:#b91c1c; }
@media (max-width:640px) { .preview-main{padding:12px} .tab-panel{padding:20px 18px} .tab-btn{padding:8px 12px;font-size:.8rem} }
</style>`;
}

function tabScript(): string {
  return `<script>
document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var id = btn.getAttribute('data-tab');
    document.querySelectorAll('.tab-btn').forEach(function(b) {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(function(p) {
      p.classList.toggle('active', p.id === 'panel-' + id);
    });
  });
});
</script>`;
}

export function renderPharmacyMasterPreviewPage(serviceId: string): string {
  const config = SERVICE_PREVIEW_CONFIG[serviceId];
  if (!config) {
    return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><title>Not found</title></head><body><h1>Not found</h1><p>No master preview for "${escHtml(serviceId)}".</p></body></html>`;
  }

  const singleTab = config.tabs.length === 1;
  const tabs = config.tabs.map((tab) => ({ ...tab, html: loadTabContent(tab.file) }));
  const tabButtons = singleTab
    ? ""
    : tabs
        .map(
          (t, i) =>
            `<button type="button" class="tab-btn${i === 0 ? " active" : ""}" data-tab="${t.id}" role="tab" aria-selected="${i === 0 ? "true" : "false"}">${escHtml(t.label)}</button>`,
        )
        .join("\n");
  const tabPanels = tabs
    .map(
      (t, i) =>
        `<article class="tab-panel${singleTab ? " single-panel active" : i === 0 ? " active" : ""}" id="panel-${t.id}" role="tabpanel">${t.html}</article>`,
    )
    .join("\n");

  const tabBarClass = singleTab ? "tab-bar single-tab" : "tab-bar";

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>${escHtml(config.pageTitle)}</title>
${previewStyles()}
</head>
<body>
<div class="preview-banner">${escHtml(config.banner)}</div>
<header class="preview-header">
  <h1>${escHtml(config.title)}</h1>
  <p>${escHtml(config.subtitle)}</p>
  <nav class="${tabBarClass}" role="tablist" aria-label="Content versions">${tabButtons}</nav>
</header>
<main class="preview-main">${tabPanels}</main>
${singleTab ? "" : tabScript()}
</body>
</html>`;
}

export function sanitiseMasterPreviewServiceId(raw: string): string | null {
  const clean = String(raw || "").trim().toLowerCase();
  return SERVICE_SLUG_RE.test(clean) ? clean : null;
}
