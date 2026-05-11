import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildBrandCss, buildBrandJs, type BrandProfile } from "../../../../src/generator/brandImporter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");
const PROJECTS_DIR   = path.join(WORKSPACE_ROOT, "config", "projects");

/**
 * Inject approved brand CSS (colour/font overrides) and a JS runtime swapper
 * (logo, nav links, footer links) into a served HTML page.
 * No re-generation required — works on any already-built page.
 */
function injectBrandCss(html: string, clientSlug: string): string {
  const profilePath = path.join(PROJECTS_DIR, clientSlug, "brand-profile.json");
  if (!fs.existsSync(profilePath)) return html;
  try {
    const profile = JSON.parse(fs.readFileSync(profilePath, "utf8")) as BrandProfile;
    if (!profile.approved) return html;
    const css = buildBrandCss(profile);
    const js  = buildBrandJs(profile);
    // Inject CSS before </head> and JS just before </body>
    html = html.replace("</head>", css + "\n</head>");
    html = html.replace("</body>", js + "\n</body>");
    return html;
  } catch {
    return html;
  }
}

const router = Router();

router.get("/preview", (_req, res) => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    res.send("<h2>No output directory found. Run the generator first.</h2>");
    return;
  }

  const clients = fs.readdirSync(OUTPUT_DIR).filter((f) =>
    fs.statSync(path.join(OUTPUT_DIR, f)).isDirectory()
  );

  const rows = clients
    .map((client) => {
      const clientDir = path.join(OUTPUT_DIR, client);
      const pages = fs.readdirSync(clientDir).filter((f) =>
        fs.statSync(path.join(clientDir, f)).isDirectory()
      );
      const links = pages
        .map((p) => `<li><a href="/preview/${client}/${p}">${p}</a></li>`)
        .join("");
      return `<section style="margin-bottom:32px">
        <h2 style="color:#003A6D;border-bottom:2px solid #D9E2EC;padding-bottom:8px">${client}</h2>
        <ul style="line-height:2">${links}</ul>
      </section>`;
    })
    .join("");

  res.send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>Page Preview</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#334155}
  h1{color:#003A6D} a{color:#005EB8}
</style></head>
<body>
  <h1>Generated Pages</h1>
  <p style="color:#64748b">Click any page to preview the generated HTML output.</p>
  ${rows || "<p>No pages generated yet. Run the generator first.</p>"}
</body></html>`);
});

router.get("/preview/:clientSlug/:pageSlug/", (req, res) => {
  const { clientSlug, pageSlug } = req.params;

  // Validate slugs — only lowercase alphanumeric + hyphens
  if (!/^[a-z0-9][a-z0-9-]*$/.test(clientSlug) || !/^[a-z0-9][a-z0-9-]*$/.test(pageSlug)) {
    res.status(400).send("Invalid slug");
    return;
  }

  const filePath = path.join(OUTPUT_DIR, clientSlug, pageSlug, "index.html");

  if (!fs.existsSync(filePath)) {
    res.status(404).send(`<h2>Page not found: ${clientSlug}/${pageSlug}</h2>`);
    return;
  }

  let html = fs.readFileSync(filePath, "utf8");

  // Inject layout normaliser — overrides any baked-in container/image widths
  // so previews always reflect the current template defaults without regenerating.
  const layoutCss = `<style id="layout-normaliser">
  .wrap,.container{max-width:960px!important;padding:0 24px!important;}
  .hero-media img{max-height:380px!important;aspect-ratio:unset!important;}
  .enquiry-media img{max-height:320px!important;aspect-ratio:unset!important;}
  .image-band img{max-height:360px!important;}
</style>`;
  html = html.replace("</head>", layoutCss + "\n</head>");

  // Inject approved brand CSS override (live — no re-generation needed)
  html = injectBrandCss(html, clientSlug);

  // Rewrite absolute live-domain asset URLs to root-relative so images load from
  // the dev server (served by the per-project output static routes in app.ts)
  // rather than requiring an FTP deploy to the live domain first.
  // e.g. https://local.inboxingproweb.com/assets/rotherham-proof/emergencyplumber/hero.jpg
  //   →  /assets/rotherham-proof/emergencyplumber/hero.jpg
  html = html.replace(/https?:\/\/[^/\s"']+\/assets\//g, "/assets/");

  // Rewrite root-relative internal page links so they work in the preview context.
  // Matches href="/<service>-<area>/" patterns (web-hosting-*, local-seo-*, web-design-*)
  // and rewrites them to /preview/:clientSlug/<service>-<area>/ so navigation stays
  // inside the preview rather than hitting the API server at root.
  html = html.replace(
    /href="(\/(web-hosting|local-seo|web-design)-[a-z0-9][a-z0-9-]*\/)"/g,
    `href="/preview/${clientSlug}$1"`,
  );

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
});

// Also handle without trailing slash
router.get("/preview/:clientSlug/:pageSlug", (req, res) => {
  res.redirect(301, `/preview/${req.params.clientSlug}/${req.params.pageSlug}/`);
});

export default router;
