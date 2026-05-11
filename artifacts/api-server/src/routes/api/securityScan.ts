/**
 * securityScan.ts
 *
 * POST /api/security-scan/:slug/run      — start async scan job
 * GET  /api/security-scan/:slug/job/:id  — poll job status / progress
 * GET  /api/security-scan/:slug          — return cached report
 * POST /api/security-scan/:slug/autofix  — apply safe auto-fixes (token-guarded in app.ts)
 */

import { Router }        from "express";
import fs                from "node:fs";
import path              from "node:path";
import { randomUUID }    from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename     = fileURLToPath(import.meta.url);
const __dirname      = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");
const PROJECTS_DIR   = path.join(WORKSPACE_ROOT, "config", "projects");

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScanSeverity = "pass" | "warning" | "fail";
export type ScanJobStatus = "running" | "done" | "error";

export interface SecurityIssue {
  id:           string;
  severity:     "warning" | "fail";
  type:         "suspicious-file" | "malicious-code" | "seo-injection" | "external-script"
                | "asset-invalid" | "htaccess" | "file-modified" | "unknown-file" | "hidden-content";
  file:         string;
  evidence:     string;
  suggestedFix: string;
  canAutoFix:   boolean;
  fixData?:     Record<string, string>;
}

export interface SecurityScanReport {
  runAt:              string;
  slug:               string;
  overallStatus:      ScanSeverity;
  filesScanned:       number;
  pagesScanned:       number;
  assetsScanned:      number;
  suspiciousFiles:    number;
  maliciousPatterns:  number;
  injectedScripts:    number;
  seoInjections:      number;
  unexpectedChanges:  number;
  lastDeployAt:       string | null;
  issues:             SecurityIssue[];
}

interface ScanJob {
  status:    ScanJobStatus;
  startedAt: string;
  progress:  { done: number; total: number; stage: string };
  report?:   SecurityScanReport;
  error?:    string;
}

const jobs = new Map<string, ScanJob>();

// ── Constants ─────────────────────────────────────────────────────────────────

const ALLOWED_SCRIPT_DOMAINS = [
  "inboxingproweb.com",
  "local.inboxingproweb.com",
  "google.com",
  "googletagmanager.com",
  "googleapis.com",
  "gstatic.com",
  "cloudflare.com",
  "cdnjs.cloudflare.com",
  "jquery.com",
  "bootstrapcdn.com",
  "w3.org",
  "schema.org",
  "facebook.net",
  "twitter.com",
];

const SUSPICIOUS_EXTENSIONS = [".php", ".php3", ".php4", ".php5", ".phtml",
  ".asp", ".aspx", ".cfm", ".cgi", ".pl", ".py", ".rb", ".sh", ".bash",
  ".htpasswd", ".env", ".bak", ".old", ".backup", ".sql", ".db", ".sqlite"];

const SUSPICIOUS_FILENAMES = [
  /shell/i, /backdoor/i, /webshell/i, /adminer/i, /phpinfo/i, /c99/i,
  /r57/i, /b374k/i, /alfa/i, /wso/i, /bypass/i, /config\.old/i,
  /config\.bak/i, /wp-config/i, /credentials/i, /passwd/i,
  /^(?=.*[a-f])[a-f0-9]{16,}$/i,  // hex hash filenames (not pure numeric timestamps)
];

const MALICIOUS_CODE_PATTERNS: Array<{ re: RegExp; label: string; severity: "warning" | "fail" }> = [
  { re: /eval\s*\(\s*atob\s*\(/gi,               label: "eval(atob()) — base64 code execution",   severity: "fail"    },
  { re: /eval\s*\(\s*unescape\s*\(/gi,           label: "eval(unescape()) — encoded execution",   severity: "fail"    },
  { re: /document\.write\s*\(\s*unescape\s*\(/gi,label: "document.write(unescape())",             severity: "fail"    },
  { re: /String\.fromCharCode\s*\(/gi,           label: "String.fromCharCode() — char obfuscation",severity: "warning" },
  { re: /<\?php/gi,                              label: "PHP tag in HTML output",                  severity: "fail"    },
  { re: /base64_decode\s*\(/gi,                  label: "base64_decode() function call",           severity: "fail"    },
  { re: /shell_exec\s*\(/gi,                     label: "shell_exec() — server-side shell command",severity: "fail"    },
  { re: /passthru\s*\(/gi,                       label: "passthru() — shell command execution",    severity: "fail"    },
  { re: /\bexec\s*\(\s*['"`]/gi,                 label: "exec() — shell command execution",        severity: "fail"    },
  { re: /document\.cookie\s*=/gi,                label: "Cookie manipulation",                     severity: "warning" },
  { re: /window\s*\[\s*['"]eval['"]\s*\]/gi,     label: "Obfuscated eval access",                 severity: "fail"    },
];

const SEO_SPAM_KEYWORDS = [
  "casino", "poker", "gambling", "blackjack", "roulette", "slots",
  "viagra", "cialis", "levitra", "pharmacy", "pharmaceutic",
  "payday loan", "quick loan", "replica watch", "replica handbag",
  "escort", "adult dating", "xxx", "free porn",
];

const SPAM_TLDS = [".ru", ".cn", ".tk", ".ml", ".ga", ".cf", ".gq", ".pw", ".top",
  ".click", ".download", ".stream", ".xxx"];

const VALID_IMAGE_MAGIC: Array<{ ext: string; magic: number[] }> = [
  { ext: ".jpg",  magic: [0xFF, 0xD8, 0xFF] },
  { ext: ".jpeg", magic: [0xFF, 0xD8, 0xFF] },
  { ext: ".png",  magic: [0x89, 0x50, 0x4E, 0x47] },
  { ext: ".gif",  magic: [0x47, 0x49, 0x46, 0x38] },
  { ext: ".webp", magic: [0x52, 0x49, 0x46, 0x46] },
  { ext: ".avif", magic: [0x00, 0x00, 0x00] },
  { ext: ".svg",  magic: [] }, // text file, skip magic check
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadProject(slug: string): Record<string, unknown> | null {
  const p = path.join(PROJECTS_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return null; }
}

function cachePath(slug: string): string {
  return path.join(OUTPUT_DIR, slug, "security-scan.json");
}

function walkDir(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    try {
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walkDir(full, out);
      else out.push(full);
    } catch { /* skip unreadable */ }
  }
  return out;
}

function readFirstBytes(filePath: string, n: number): Buffer {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(n);
  fs.readSync(fd, buf, 0, n, 0);
  fs.closeSync(fd);
  return buf;
}

function isDomainAllowed(domain: string): boolean {
  return ALLOWED_SCRIPT_DOMAINS.some((d) =>
    domain === d || domain.endsWith("." + d),
  );
}

function extractUrlDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith("//") ? "https:" + url : url);
    return u.hostname;
  } catch {
    return null;
  }
}

function truncateEvidence(s: string, max = 120): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

function relPath(slug: string, abs: string): string {
  return abs.replace(path.join(OUTPUT_DIR, slug) + "/", "");
}

function pruneJobs() {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (new Date(job.startedAt).getTime() < cutoff) jobs.delete(id);
  }
}

function getLastDeployTime(slug: string): Date | null {
  const logPath = path.join(OUTPUT_DIR, slug, "rollout-log.json");
  if (!fs.existsSync(logPath)) return null;
  try {
    const entries = JSON.parse(fs.readFileSync(logPath, "utf8")) as Array<{ timestamp?: string; at?: string }>;
    if (!Array.isArray(entries) || entries.length === 0) return null;
    const last = entries[entries.length - 1];
    const ts = last.timestamp ?? last.at;
    return ts ? new Date(ts) : null;
  } catch {
    return null;
  }
}

// ── Scan engine ───────────────────────────────────────────────────────────────

async function runSecurityScan(slug: string, job: ScanJob): Promise<SecurityScanReport> {
  const clientDir = path.join(OUTPUT_DIR, slug);
  const issues: SecurityIssue[] = [];

  const addIssue = (issue: Omit<SecurityIssue, "id">) =>
    issues.push({ id: randomUUID(), ...issue });

  // ── Discover all files ──────────────────────────────────────────────────────
  job.progress = { done: 0, total: 100, stage: "Discovering files…" };
  const allFiles = walkDir(clientDir);
  const htmlFiles = allFiles.filter((f) => f.endsWith(".html"));
  const assetFiles = allFiles.filter((f) => {
    const rel = relPath(slug, f);
    return rel.startsWith("assets/") || rel.includes("/assets/");
  });

  let done = 0;
  const total = htmlFiles.length + assetFiles.length + 3; // +3 for file scan, htaccess, change tracking

  // ── STEP 1: Suspicious file names & extensions ──────────────────────────────
  job.progress = { done: done++, total, stage: "Checking for suspicious files…" };
  const systemGeneratedFiles = new Set<string>([
    "index.html", "sitemap.xml", "sitemap-index.xml", "robots.txt",
    "system-health.json", "security-scan.json", "session.json",
    "rollout-log.json", "selected-areas.json", "selected-area-defs.json",
    "page-data.json", "keyword-tracking.json", "indexing-status.json",
    "index-tracking.json", "deferred-areas.json", "image-meta.json",
    "pre-publish-qa.json",
  ]);

  for (const f of allFiles) {
    const base    = path.basename(f);
    const ext     = path.extname(f).toLowerCase();
    const relFile = relPath(slug, f);
    // Skip system-managed upload directory (files named by timestamp)
    if (relFile.startsWith("uploads/")) continue;

    if (SUSPICIOUS_EXTENSIONS.includes(ext)) {
      addIssue({
        severity: "fail",
        type: "suspicious-file",
        file: relPath(slug, f),
        evidence: `File has suspicious extension: ${ext}`,
        suggestedFix: "Remove this file immediately — it should not exist in the output directory.",
        canAutoFix: true,
        fixData: { action: "remove-file", filePath: f },
      });
    } else if (SUSPICIOUS_FILENAMES.some((re) => re.test(path.basename(f, ext)))) {
      addIssue({
        severity: "fail",
        type: "suspicious-file",
        file: relPath(slug, f),
        evidence: `File name matches known malicious pattern: ${base}`,
        suggestedFix: "Remove this file — it matches a known web shell or malicious filename pattern.",
        canAutoFix: true,
        fixData: { action: "remove-file", filePath: f },
      });
    } else if (!systemGeneratedFiles.has(base) && !base.startsWith(".") &&
               ext !== ".html" && ext !== ".xml" && ext !== ".txt" &&
               ext !== ".json" && ext !== ".jpg" && ext !== ".jpeg" &&
               ext !== ".png" && ext !== ".webp" && ext !== ".gif" &&
               ext !== ".svg" && ext !== ".avif" && ext !== ".ico" &&
               ext !== ".css" && ext !== ".js" && ext !== ".woff" &&
               ext !== ".woff2" && ext !== ".ttf" && ext !== ".eot" &&
               ext !== ".map" && ext !== ".mp4" && ext !== ".mp3" &&
               ext !== ".pdf") {
      addIssue({
        severity: "warning",
        type: "unknown-file",
        file: relPath(slug, f),
        evidence: `Unknown file type (${ext || "no extension"}) found in output directory`,
        suggestedFix: "Verify this file is legitimate and was placed here intentionally.",
        canAutoFix: false,
      });
    }
  }

  // ── STEP 2: Change tracking ─────────────────────────────────────────────────
  job.progress = { done: done++, total, stage: "Checking file modification times…" };
  const lastDeployDate = getLastDeployTime(slug);
  if (lastDeployDate) {
    for (const f of allFiles) {
      const ext = path.extname(f).toLowerCase();
      if (ext !== ".html") continue;
      try {
        const mtime = fs.statSync(f).mtime;
        if (mtime > lastDeployDate) {
          const minutesAgo = Math.round((Date.now() - mtime.getTime()) / 60000);
          addIssue({
            severity: "warning",
            type: "file-modified",
            file: relPath(slug, f),
            evidence: `Modified ${minutesAgo < 60 ? minutesAgo + " min ago" : Math.round(minutesAgo / 60) + "h ago"} — after last deploy (${lastDeployDate.toISOString().slice(0, 10)})`,
            suggestedFix: "Verify this page was re-generated by the system. If not, restore from last deploy.",
            canAutoFix: false,
          });
        }
      } catch { /* skip */ }
    }
  }

  // ── STEP 3: HTML malicious code scan ───────────────────────────────────────
  job.progress = { done: done++, total, stage: "Scanning HTML pages for malicious code…" };
  for (const htmlFile of htmlFiles) {
    const rel = relPath(slug, htmlFile);

    let html: string;
    try { html = fs.readFileSync(htmlFile, "utf8"); }
    catch { continue; }

    // Malicious code patterns
    for (const { re, label, severity } of MALICIOUS_CODE_PATTERNS) {
      re.lastIndex = 0;
      const m = re.exec(html);
      if (m) {
        const ctx = html.slice(Math.max(0, m.index - 10), m.index + 60);
        addIssue({
          severity,
          type: "malicious-code",
          file: rel,
          evidence: `${label}: ${truncateEvidence(ctx)}`,
          suggestedFix: "This pattern is a strong indicator of malicious injection. Review the full file and remove the suspicious code block.",
          canAutoFix: false,
        });
      }
    }

    // External script tag check
    const scriptRe = /<script[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let sm: RegExpExecArray | null;
    while ((sm = scriptRe.exec(html)) !== null) {
      const src = sm[1];
      if (src.startsWith("/") || src.startsWith("./") || !src.includes("//")) continue;
      const domain = extractUrlDomain(src);
      if (!domain) continue;
      if (!isDomainAllowed(domain)) {
        addIssue({
          severity: "warning",
          type: "external-script",
          file: rel,
          evidence: `Unknown external script: ${truncateEvidence(src)}`,
          suggestedFix: `Verify this script is intentional. If not, remove the <script src="${domain}..."> tag from the page.`,
          canAutoFix: false,
        });
      }
    }

    // Hidden iframe check
    const iframeRe = /<iframe([^>]*)>/gi;
    let im: RegExpExecArray | null;
    while ((im = iframeRe.exec(html)) !== null) {
      const attrs = im[1];
      const srcM  = /src=["']([^"']+)["']/i.exec(attrs);
      const src   = srcM?.[1] ?? "";
      const isHidden = /display\s*:\s*none|width\s*:\s*0|height\s*:\s*0|visibility\s*:\s*hidden/i.test(attrs);
      const domain = src ? extractUrlDomain(src) : null;
      if (isHidden && domain && !isDomainAllowed(domain)) {
        addIssue({
          severity: "fail",
          type: "malicious-code",
          file: rel,
          evidence: `Hidden iframe injected: ${truncateEvidence(src)}`,
          suggestedFix: "Remove this hidden iframe — it is a common malware injection technique.",
          canAutoFix: false,
        });
      }
    }

    // SEO spam / hidden content check
    const hiddenTextRe = /style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|color\s*:\s*(?:#fff|white|#ffffff))[^"']*["'][^>]*>([^<]{10,})/gi;
    let hm: RegExpExecArray | null;
    while ((hm = hiddenTextRe.exec(html)) !== null) {
      const text = hm[1].trim();
      if (!text || text.length < 5) continue;
      addIssue({
        severity: "warning",
        type: "hidden-content",
        file: rel,
        evidence: `Hidden text detected: "${truncateEvidence(text)}"`,
        suggestedFix: "Hidden text is a black-hat SEO technique and can get the site penalised. Remove the element or make it visible.",
        canAutoFix: false,
      });
    }

    // SEO spam keyword injection
    const linkRe = /<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(html)) !== null) {
      const href   = lm[1];
      const anchor = lm[2].toLowerCase().trim();

      // Use word-boundary matching to avoid false positives like "specialist" → "cialis"
      if (SEO_SPAM_KEYWORDS.some((kw) => new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`).test(anchor))) {
        addIssue({
          severity: "fail",
          type: "seo-injection",
          file: rel,
          evidence: `Spam anchor text: "${truncateEvidence(lm[2])}" linking to ${truncateEvidence(href)}`,
          suggestedFix: "Remove this link — spam anchor text is a sign of SEO injection.",
          canAutoFix: false,
        });
        continue;
      }

      if (href.startsWith("http")) {
        const domain = extractUrlDomain(href);
        if (domain && SPAM_TLDS.some((tld) => domain.endsWith(tld))) {
          addIssue({
            severity: "fail",
            type: "seo-injection",
            file: rel,
            evidence: `Link to suspicious TLD domain: ${domain} (anchor: "${truncateEvidence(lm[2])}")`,
            suggestedFix: "Remove this link — it points to a domain associated with spam.",
            canAutoFix: false,
          });
        }
      }
    }

    done++;
    job.progress = { done, total, stage: `Scanning pages… (${done}/${htmlFiles.length})` };
  }

  // ── STEP 4: Asset validation ────────────────────────────────────────────────
  job.progress = { done, total, stage: "Validating assets…" };
  for (const assetFile of assetFiles) {
    const rel = relPath(slug, assetFile);
    const ext = path.extname(assetFile).toLowerCase();

    if (SUSPICIOUS_EXTENSIONS.includes(ext)) {
      addIssue({
        severity: "fail",
        type: "asset-invalid",
        file: rel,
        evidence: `Script/executable file (${ext}) found in assets folder`,
        suggestedFix: "Remove this file immediately — scripts must never exist in the assets directory.",
        canAutoFix: true,
        fixData: { action: "remove-file", filePath: assetFile },
      });
      continue;
    }

    const imageExts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".ico", ".svg"];
    if (imageExts.includes(ext) && ext !== ".svg") {
      try {
        const bytes = readFirstBytes(assetFile, 12);
        // Check if it matches ANY known valid image format (not just the declared ext)
        const isJpeg  = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
        const isPng   = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
        const isGif   = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
        const isWebP  = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
                        && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
        const isIco   = bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00;
        const isAvif  = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
        const isValidImage = isJpeg || isPng || isGif || isWebP || isIco || isAvif;
        if (!isValidImage) {
          addIssue({
            severity: "fail",
            type: "asset-invalid",
            file: rel,
            evidence: `File does not match any valid image format — may be a disguised script`,
            suggestedFix: "Remove this file and re-upload a legitimate image. A script disguised as an image is a severe security risk.",
            canAutoFix: true,
            fixData: { action: "remove-file", filePath: assetFile },
          });
        }
      } catch { /* skip unreadable */ }
    }

    done++;
    job.progress = { done, total, stage: `Validating assets… (${done - htmlFiles.length}/${assetFiles.length})` };
  }

  // ── STEP 5: .htaccess check (if deployed alongside) ────────────────────────
  job.progress = { done: done++, total, stage: "Checking .htaccess files…" };
  const htaccessFiles = allFiles.filter((f) => path.basename(f) === ".htaccess");
  for (const hf of htaccessFiles) {
    let content: string;
    try { content = fs.readFileSync(hf, "utf8"); }
    catch { continue; }

    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      if (/base64/i.test(trimmed)) {
        addIssue({
          severity: "fail",
          type: "htaccess",
          file: relPath(slug, hf),
          evidence: `Base64 code in .htaccess: ${truncateEvidence(trimmed)}`,
          suggestedFix: "Remove this rule — base64 in .htaccess is a strong indicator of injection.",
          canAutoFix: false,
        });
      } else if (/RewriteRule.*https?:\/\//i.test(trimmed)) {
        const destM = /RewriteRule.*?(https?:\/\/[^\s]+)/i.exec(trimmed);
        const dest  = destM?.[1] ?? "";
        const destDomain = extractUrlDomain(dest);
        if (destDomain && !isDomainAllowed(destDomain)) {
          addIssue({
            severity: "fail",
            type: "htaccess",
            file: relPath(slug, hf),
            evidence: `Redirect to external domain: ${truncateEvidence(dest)}`,
            suggestedFix: "Remove this redirect rule if you did not add it — external redirects in .htaccess are a common hack.",
            canAutoFix: false,
          });
        }
      }
    }
  }

  // ── Compute totals ──────────────────────────────────────────────────────────
  const suspiciousFiles   = issues.filter((i) => i.type === "suspicious-file" || i.type === "unknown-file").length;
  const maliciousPatterns = issues.filter((i) => i.type === "malicious-code").length;
  const injectedScripts   = issues.filter((i) => i.type === "external-script").length;
  const seoInjections     = issues.filter((i) => i.type === "seo-injection" || i.type === "hidden-content").length;
  const unexpectedChanges = issues.filter((i) => i.type === "file-modified").length;

  const failCount    = issues.filter((i) => i.severity === "fail").length;
  const overallStatus: ScanSeverity =
    failCount > 0           ? "fail"
    : issues.length > 0     ? "warning"
    : "pass";

  return {
    runAt:             new Date().toISOString(),
    slug,
    overallStatus,
    filesScanned:      allFiles.length,
    pagesScanned:      htmlFiles.length,
    assetsScanned:     assetFiles.length,
    suspiciousFiles,
    maliciousPatterns,
    injectedScripts,
    seoInjections,
    unexpectedChanges,
    lastDeployAt:      lastDeployDate?.toISOString() ?? null,
    issues,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET cached report
router.get("/security-scan/:slug", (req, res) => {
  const slug = path.basename(req.params.slug);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) { res.status(400).json({ error: "Invalid slug" }); return; }
  const cache = cachePath(slug);
  if (!fs.existsSync(cache)) { res.json({ cached: false, report: null }); return; }
  try {
    const report: SecurityScanReport = JSON.parse(fs.readFileSync(cache, "utf8"));
    res.json({ cached: true, report });
  } catch {
    res.json({ cached: false, report: null });
  }
});

// POST start scan job
router.post("/security-scan/:slug/run", (req, res) => {
  const slug = path.basename(req.params.slug);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) { res.status(400).json({ error: "Invalid slug" }); return; }

  const project = loadProject(slug);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const clientDir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(clientDir)) { res.status(400).json({ error: "No output found for this project" }); return; }

  pruneJobs();
  const jobId = randomUUID();
  const job: ScanJob = {
    status:    "running",
    startedAt: new Date().toISOString(),
    progress:  { done: 0, total: 1, stage: "Starting…" },
  };
  jobs.set(jobId, job);

  // Run async
  runSecurityScan(slug, job).then((report) => {
    job.status = "done";
    job.report = report;
    job.progress = { done: job.progress.total, total: job.progress.total, stage: "Complete" };
    // Cache to disk
    try { fs.writeFileSync(cachePath(slug), JSON.stringify(report, null, 2)); } catch { /* ignore */ }
  }).catch((err: unknown) => {
    job.status = "error";
    job.error  = err instanceof Error ? err.message : String(err);
  });

  res.json({ jobId });
});

// GET poll job
router.get("/security-scan/:slug/job/:id", (req, res) => {
  const slug = path.basename(req.params.slug);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) { res.status(400).json({ error: "Invalid slug" }); return; }

  const job = jobs.get(req.params.id);
  if (!job) { res.status(404).json({ error: "Job not found or expired" }); return; }

  res.json({
    status:   job.status,
    progress: job.progress,
    report:   job.status === "done" ? job.report : undefined,
    error:    job.error,
  });
});

// POST auto-fix (guarded by X-Internal-Token in app.ts via prefix /api/security-scan/*/autofix)
router.post("/security-scan/:slug/autofix", (req, res) => {
  const slug = path.basename(req.params.slug);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) { res.status(400).json({ error: "Invalid slug" }); return; }

  const { fixes } = req.body as { fixes?: Array<{ issueId: string; action: string; filePath: string }> };
  if (!Array.isArray(fixes) || fixes.length === 0) {
    res.status(400).json({ error: "fixes array is required" });
    return;
  }

  const clientDir  = path.join(OUTPUT_DIR, slug);
  const trashDir   = path.join(clientDir, `_quarantine_${Date.now()}`);
  const results: Array<{ issueId: string; ok: boolean; detail: string }> = [];

  for (const fix of fixes) {
    try {
      if (fix.action === "remove-file" && fix.filePath) {
        // Safety check: file must be inside the client output dir
        const resolved = path.resolve(fix.filePath);
        if (!resolved.startsWith(clientDir)) {
          results.push({ issueId: fix.issueId, ok: false, detail: "Path outside client directory" });
          continue;
        }
        if (!fs.existsSync(resolved)) {
          results.push({ issueId: fix.issueId, ok: false, detail: "File not found" });
          continue;
        }
        if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });
        const dest = path.join(trashDir, path.basename(resolved));
        fs.renameSync(resolved, dest);
        results.push({ issueId: fix.issueId, ok: true, detail: `Moved to quarantine: ${path.basename(resolved)}` });
      } else {
        results.push({ issueId: fix.issueId, ok: false, detail: "Unknown fix action" });
      }
    } catch (err) {
      results.push({ issueId: fix.issueId, ok: false, detail: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  // Invalidate cache so next load re-runs
  try { if (fs.existsSync(cachePath(slug))) fs.unlinkSync(cachePath(slug)); } catch { /* ignore */ }

  res.json({ ok: true, results, trashDir: path.relative(OUTPUT_DIR, trashDir) });
});

export default router;
