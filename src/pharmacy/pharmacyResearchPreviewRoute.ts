/**
 * Read-only HTML preview for pharmacy master library research documents.
 * No writes, no editing, no generation, no publishing side effects.
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
const RESEARCH_DIR = path.join(WORKSPACE_ROOT, "docs/pharmacy-master-library/research");

const RESEARCH_DOCUMENTS: Record<string, { file: string; title: string }> = {
  "blood-pressure-checks": {
    file: "blood-pressure-checks-research-v1.md",
    title: "Blood Pressure Checks — Stage 1 Research (V1)",
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

export function markdownToResearchHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeUl = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
  };

  const closeOl = () => {
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  const closeLists = () => {
    closeUl();
    closeOl();
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      closeLists();
      continue;
    }

    if (trimmed === "---") {
      closeLists();
      out.push("<hr/>");
      continue;
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]!.trim())) {
      closeLists();
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
      closeLists();
      out.push(`<h1>${inlineFormat(trimmed.slice(2).trim())}</h1>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeLists();
      out.push(`<h2>${inlineFormat(trimmed.slice(3).trim())}</h2>`);
      continue;
    }
    if (trimmed.startsWith("### ")) {
      closeLists();
      out.push(`<h3>${inlineFormat(trimmed.slice(4).trim())}</h3>`);
      continue;
    }
    if (trimmed.startsWith("#### ")) {
      closeLists();
      out.push(`<h4>${inlineFormat(trimmed.slice(5).trim())}</h4>`);
      continue;
    }

    const numbered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) {
      closeUl();
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inlineFormat(numbered[2]!)}</li>`);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      closeOl();
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inlineFormat(bullet[1]!)}</li>`);
      continue;
    }

    closeLists();
    out.push(`<p>${inlineFormat(trimmed)}</p>`);
  }

  closeLists();
  return out.join("\n");
}

function loadResearchContent(file: string): string {
  const filePath = path.join(RESEARCH_DIR, file);
  if (!fs.existsSync(filePath)) {
    return `<p class="error">Research file not found: ${escHtml(file)}</p>`;
  }
  return markdownToResearchHtml(fs.readFileSync(filePath, "utf8"));
}

function previewStyles(): string {
  return `<style>
:root { --bg:#f8fafc; --surface:#fff; --ink:#0f172a; --muted:#64748b; --border:#e2e8f0; --accent:#005eb8; --accent-soft:#eaf5fa; }
* { box-sizing:border-box; }
body { margin:0; font-family:Inter,system-ui,-apple-system,sans-serif; background:var(--bg); color:var(--ink); line-height:1.65; }
.research-banner { background:#fef3c7; border-bottom:1px solid #fcd34d; padding:10px 24px; font-size:.875rem; font-weight:700; color:#92400e; letter-spacing:.02em; text-align:center; }
.preview-header { background:var(--surface); border-bottom:1px solid var(--border); padding:20px 24px; }
.preview-header h1 { margin:0 0 4px; font-size:1.35rem; }
.preview-header p { margin:0 0 12px; color:var(--muted); font-size:.9rem; }
.preview-nav { display:flex; flex-wrap:wrap; gap:12px; align-items:center; font-size:.875rem; }
.preview-nav a { color:var(--accent); text-decoration:none; font-weight:500; }
.preview-nav a:hover { text-decoration:underline; }
.preview-nav .sep { color:var(--border); }
.preview-main { max-width:920px; margin:0 auto; padding:24px; }
.research-panel { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:32px 36px; box-shadow:0 1px 3px rgba(15,23,42,.06); }
.research-panel h1 { font-size:1.5rem; margin:0 0 1rem; color:var(--accent); }
.research-panel h2 { font-size:1.15rem; margin:2rem 0 .75rem; padding-top:.5rem; border-top:1px solid var(--border); color:#003087; }
.research-panel h2:first-of-type { border-top:none; margin-top:0; padding-top:0; }
.research-panel h3 { font-size:1rem; margin:1.25rem 0 .5rem; color:#0f172a; }
.research-panel h4 { font-size:.95rem; margin:1rem 0 .4rem; }
.research-panel p { margin:0 0 1rem; }
.research-panel ul, .research-panel ol { margin:0 0 1rem; padding-left:1.35rem; }
.research-panel li { margin-bottom:.45rem; }
.research-panel hr { border:none; border-top:1px solid var(--border); margin:1.5rem 0; }
.research-panel code { background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:.875em; }
.research-panel .table-wrap { overflow-x:auto; margin:0 0 1.25rem; }
.research-panel table { width:100%; border-collapse:collapse; font-size:.875rem; }
.research-panel th, .research-panel td { border:1px solid var(--border); padding:8px 10px; text-align:left; vertical-align:top; }
.research-panel th { background:var(--accent-soft); font-weight:600; }
.research-panel .error { color:#b91c1c; }
@media (max-width:640px) { .preview-main{padding:12px} .research-panel{padding:20px 18px} }
</style>`;
}

export function renderPharmacyResearchPreviewPage(serviceId: string): string {
  const doc = RESEARCH_DOCUMENTS[serviceId];
  if (!doc) {
    return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><title>Not found</title></head><body><h1>Not found</h1><p>No research preview for "${escHtml(serviceId)}".</p></body></html>`;
  }

  const content = loadResearchContent(doc.file);

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>${escHtml(doc.title)} — Research Preview</title>
${previewStyles()}
</head>
<body>
<div class="research-banner">RESEARCH DOCUMENT — NOT APPROVED FOR CONTENT GENERATION</div>
<header class="preview-header">
  <h1>${escHtml(doc.title)}</h1>
  <p>Stage 1 research foundation · read-only human review</p>
  <nav class="preview-nav" aria-label="Preview navigation">
    <a href="/api/pharmacy-master-preview/pharmacy-first">← Pharmacy Master Preview</a>
    <span class="sep">|</span>
    <span>Service: ${escHtml(serviceId)}</span>
  </nav>
</header>
<main class="preview-main">
  <article class="research-panel">${content}</article>
</main>
</body>
</html>`;
}

export function sanitiseResearchPreviewServiceId(raw: string): string | null {
  const clean = String(raw || "").trim().toLowerCase();
  return SERVICE_SLUG_RE.test(clean) ? clean : null;
}
