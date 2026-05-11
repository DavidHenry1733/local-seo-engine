#!/usr/bin/env node
/**
 * Regenerate all inboxingproweb pages in parallel, rebuild sitemaps,
 * then strip any company-number references left in body copy.
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_SLUG = "inboxingproweb";
const OUTPUT_DIR  = path.resolve(__dirname, "../../output");
const TOKEN       = process.env.SESSION_SECRET ?? "";

const CAMPAIGNS = [
  "barnsley-local_seo-206a54",
  "barnsley-web_design-0507ac",
  "barnsley-webho-ting-9ccc34",
  "doncaster-web_design-d52439",
  "doncaster-web_hosting-1ca775",
  "donca-ter-local-eo-0de297",
  "heffield-roofing-ervice-431bce",
  "rotherham-emailmarketing-266f98",
  "rotherham-emergencyplumber-897594",
  "rotherham-local_seo-05ba31",
  "rotherham-local_seo_rotherham-5b4666",
  "rotherham-webho-ting-5b9958",
  "sheffield-local_seo-6ea754",
  "sheffield-web_design-55d384",
  "sheffield-webho-ting-078586",
];

function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: "localhost", port: 80, path: urlPath, method,
      headers: {
        "X-Internal-Token": TOKEN, Accept: "application/json",
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runCampaign(campaignId) {
  const { status, body } = await apiRequest("POST", "/api/rollout", { clientSlug: CLIENT_SLUG, campaignId });
  if (status !== 200 || !body?.jobId) {
    return { campaignId, ok: false, error: body?.error ?? `HTTP ${status}` };
  }
  const jobId = body.jobId;
  const start = Date.now();
  while (Date.now() - start < 8 * 60 * 1000) {
    await sleep(4000);
    const { body: jb } = await apiRequest("GET", `/api/rollout/status/${jobId}`);
    const st = jb?.status ?? "unknown";
    if (st === "done") {
      const pages = (jb?.events ?? []).filter(e => e.type === "page").length;
      return { campaignId, ok: true, pages };
    }
    if (st === "error" || st === "cancelled") {
      return { campaignId, ok: false, error: jb?.error ?? st };
    }
  }
  return { campaignId, ok: false, error: "timeout" };
}

function fixBodyCopy(clientDir) {
  const copyright = "&copy; 2026 DHM Digital Limited &ndash; Company Number 16953956 &ndash; All Rights Reserved";
  let fixed = 0;
  const dirs = fs.readdirSync(clientDir).filter(d => {
    try { return fs.statSync(path.join(clientDir, d)).isDirectory() && d !== "assets"; } catch { return false; }
  });
  for (const d of dirs) {
    const p = path.join(clientDir, d, "index.html");
    if (!fs.existsSync(p)) continue;
    let html = fs.readFileSync(p, "utf8");
    const orig = html;
    const ph = "##COPYRIGHT##";
    html = html.replace(copyright, ph);
    html = html.replace(/registered as InboxingProWeb,\s*Company No\.\s*16953956[—–-]/g, "InboxingProWeb—");
    html = html.replace(/,?\s*\(Company No\.\s*16953956\)/g, "");
    html = html.replace(/,?\s*Company No\.\s*16953956/g, "");
    html = html.replace(/(?<!\d)16953956(?!\d)/g, "");
    html = html.replace(/  +/g, " ").replace(/ \./g, ".");
    html = html.replace(ph, copyright);
    if (html !== orig) { fs.writeFileSync(p, html, "utf8"); fixed++; }
  }
  return fixed;
}

function fixFooters(clientDir) {
  const correct = "&copy; 2026 DHM Digital Limited &ndash; Company Number 16953956 &ndash; All Rights Reserved";
  let fixed = 0;
  const dirs = fs.readdirSync(clientDir).filter(d => {
    try { return fs.statSync(path.join(clientDir, d)).isDirectory() && d !== "assets"; } catch { return false; }
  });
  for (const d of dirs) {
    const p = path.join(clientDir, d, "index.html");
    if (!fs.existsSync(p)) continue;
    let html = fs.readFileSync(p, "utf8");
    const orig = html;
    html = html.replace(/&copy; 2026 InboxingProWeb &ndash; All Rights Reserved/g, correct);
    html = html.replace(/&copy; 2026\s+&ndash; Company Number\s+&ndash; All Rights Reserved/g, correct);
    if (html !== orig) { fs.writeFileSync(p, html, "utf8"); fixed++; }
  }
  return fixed;
}

(async () => {
  console.log(`\n=== InboxingProWeb Parallel Regeneration (${CAMPAIGNS.length} campaigns) ===\n`);

  // Run all campaigns in parallel
  const promises = CAMPAIGNS.map(id => runCampaign(id).then(r => { console.log(`  ${r.ok ? "✓" : "✗"} ${r.campaignId}: ${r.ok ? `${r.pages ?? "?"} pages` : r.error}`); return r; }));
  const results = await Promise.all(promises);

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log(`\nRollout: ${passed}/${results.length} succeeded`);
  if (failed.length) failed.forEach(f => console.log(`  FAILED: ${f.campaignId} — ${f.error}`));

  // Fix footers on any pages regenerated with wrong footer
  console.log("\n=== Fixing footers ===");
  const clientDir = path.join(OUTPUT_DIR, CLIENT_SLUG);
  const footerFixed = fixFooters(clientDir);
  console.log(`Footer fix applied to ${footerFixed} pages`);

  // Fix body copy
  console.log("=== Fixing body copy ===");
  const bodyFixed = fixBodyCopy(clientDir);
  console.log(`Body copy fix applied to ${bodyFixed} pages`);

  // Sitemap rebuild
  console.log("\n=== Rebuilding sitemaps ===");
  const { status: ss, body: sb } = await apiRequest("POST", "/api/sitemap/rebuild", { clientSlug: CLIENT_SLUG });
  if (ss === 200) console.log(`✓ Sitemap rebuilt — ${sb?.totalPages ?? "?"} pages`);
  else console.error(`✗ Sitemap rebuild failed (${ss}): ${sb?.error ?? sb}`);

  // Final check
  const copyright = "&copy; 2026 DHM Digital Limited &ndash; Company Number 16953956 &ndash; All Rights Reserved";
  let footerOk = 0, footerBad = 0, bodyCopyDhm = 0;
  const dirs = fs.readdirSync(clientDir).filter(d => { try { return fs.statSync(path.join(clientDir, d)).isDirectory() && d !== "assets"; } catch { return false; } });
  for (const d of dirs) {
    const p = path.join(clientDir, d, "index.html");
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, "utf8");
    if (html.includes(copyright)) footerOk++; else footerBad++;
    const stripped = html.replace(copyright, "");
    if (/DHM Digital|dhmdigital/i.test(stripped)) bodyCopyDhm++;
  }
  console.log(`\n=== Final check ===`);
  console.log(`Footer correct: ${footerOk}, wrong: ${footerBad}`);
  console.log(`Body copy DHM refs remaining: ${bodyCopyDhm}`);
  console.log("\n✓ Done\n");
})().catch(e => { console.error("Fatal:", e); process.exit(1); });
