import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const router = Router();

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "pharmaconnect";

function esc(v: unknown) {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m] || m));
}

function readJson(file: string): any | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function loadLaunchSummary(slug: string) {
  const profileDoc = readJson(path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`));
  const profile = profileDoc?.data || {};
  const serviceLib = readJson(path.join(ROOT, "data/pharmacy-service-library", `${slug}.json`));
  const publishIndex = readJson(path.join(ROOT, "output/pharmacy-publish", slug, "_publish-index.json"));
  const quality = readJson(path.join(ROOT, "data/pharmacy-quality-audit", `${slug}.json`));
  const competitorDash =
    readJson(path.join(ROOT, "data/pharmacy-competitor-intelligence", `${slug}-dashboard.json`)) ||
    readJson(path.join(ROOT, "data/pharmacy-opportunity-engine", `${slug}-dashboard.json`));

  const selectedServices = serviceLib?.selectedServices?.length || profile.selectedServices?.length || 0;
  const rankingAreas = profile.rankingAreas?.length || 0;
  const pagesGenerated = publishIndex?.pageCount || quality?.pageCount || 0;
  const qualityScore = quality?.averages?.overall || null;
  const competitorsFound = competitorDash?.competitorSummary?.count || competitorDash?.competitors?.length || 0;
  const opportunitiesFound = competitorDash?.opportunities?.length || 0;

  const entityGroups = [
    "gpSurgeries", "hospitals", "healthCentres", "careHomes", "schools",
    "landmarks", "communityFacilities", "transportLinks", "retailCentres", "residentialAreas",
  ];
  const entitiesSelected = entityGroups.reduce(
    (n, k) => n + (Array.isArray(profile[k]) ? profile[k].length : 0),
    0,
  );

  const requiredFields = ["pharmacyName", "postcode", "townCity", "gphcNumber", "phone"];
  const profileComplete = requiredFields.filter((f) => String(profile[f] || "").trim()).length;

  return {
    profileComplete: `${profileComplete}/${requiredFields.length}`,
    profileCompletePct: Math.round((profileComplete / requiredFields.length) * 100),
    servicesSelected: selectedServices,
    areasSelected: rankingAreas,
    entitiesSelected,
    pagesGenerated,
    qualityScore,
    competitorsFound,
    opportunitiesFound,
    pharmacyName: profile.pharmacyName || "Pharmacy",
  };
}

function list(items: unknown[], empty = "No data added yet.") {
  if (!Array.isArray(items) || !items.length) return `<p class="muted">${empty}</p>`;
  return `<ul>${items.map((x) => `<li>${esc(typeof x === "string" ? x : JSON.stringify(x))}</li>`).join("")}</ul>`;
}

router.get("/pharmacy-intelligence", (_req, res) => {
  const launch = loadLaunchSummary(SLUG);
  const wizardFile = path.join(ROOT, "data/pharmacy-intelligence", `${SLUG}.json`);
  const intel = readJson(wizardFile);
  const isWizard = intel && intel.pharmacy && intel.services;

  if (!intel && launch.pagesGenerated === 0) {
    res.type("html").send(`<!doctype html>
<html><head><meta charset="utf-8"/><title>Pharmacy Intelligence — PharmaConnect</title>
<style>body{font-family:Inter,Arial,sans-serif;background:#f8fafc;margin:0;color:#0f172a}header{background:#005eb8;color:white;padding:22px 30px}main{max-width:1100px;margin:24px auto;padding:0 18px}.card{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px}a.btn{display:inline-block;background:#005eb8;color:white;text-decoration:none;border-radius:8px;padding:11px 16px;font-weight:800;margin-right:8px}.muted{color:#64748b}</style>
</head><body><header><h1>Pharmacy Intelligence</h1><p>No intelligence report generated yet.</p></header>
<main><div class="card"><p>Complete setup and generate your first intelligence report.</p>
<a class="btn" href="/api/pharmacy-setup">Open Pharmacy Setup</a>
<a class="btn" href="/api/pharmacy-launch-demo">Launch Demo Guide</a></div></main></body></html>`);
    return;
  }

  let detailHtml = "";
  if (isWizard) {
    const p = intel.pharmacy || {};
    const loc = intel.location || {};
    const services = intel.services || {};
    const seo = intel.growthSeo || {};
    const content = intel.contentIntelligence || {};
    const assets = intel.nextContentAssets || {};

    const serviceRows = (services.selectedServices || []).map((s: any) =>
      `<tr><td><strong>${esc(s.label)}</strong><br><span class="muted">${esc(s.groupLabel)}</span></td><td>${esc(s.serviceType)}</td><td>${esc((s.keywords || []).join(", "))}</td></tr>`,
    ).join("");

    detailHtml = `
    <div class="card"><h2>Pharmacy Summary</h2><table>
      <tr><th>Name</th><td>${esc(p.name)}</td></tr>
      <tr><th>Website</th><td>${esc(p.website)}</td></tr>
      <tr><th>Phone</th><td>${esc(p.phone)}</td></tr>
      <tr><th>GPhC</th><td>${esc(p.gphcNumber)}</td></tr>
    </table></div>
    <div class="card"><h2>Location</h2><table>
      <tr><th>Town</th><td>${esc(loc.townCity)}</td></tr>
      <tr><th>Postcode</th><td>${esc(loc.postcode)}</td></tr>
      <tr><th>Ranking areas</th><td>${list(seo.rankingAreas || loc.rankingAreas || [])}</td></tr>
    </table></div>
    <div class="card"><h2>Selected Services</h2><table><thead><tr><th>Service</th><th>Type</th><th>Keywords</th></tr></thead><tbody>${serviceRows || `<tr><td colspan="3" class="muted">No services.</td></tr>`}</tbody></table></div>
    <div class="card"><h2>Authority Signals</h2>${list(content.authoritySignals)}</div>`;
  } else if (intel?.clusters) {
    const top = (intel.clusters || []).slice(0, 5).map((c: any) =>
      `<tr><td>${esc(c.serviceName)}</td><td>${esc(c.scores?.overall || "—")}/60</td><td>${esc(c.similarity?.riskLevel || "—")}</td><td>${esc(c.areaPageCount)}</td></tr>`,
    ).join("");
    detailHtml = `
    <div class="card"><h2>Content Cluster Health</h2>
    <p class="muted">Similarity audit across service clusters — ${esc(intel.clusterCount)} clusters analysed.</p>
    <table><thead><tr><th>Service</th><th>Health</th><th>Similarity</th><th>Area pages</th></tr></thead><tbody>${top}</tbody></table></div>`;
  }

  const summaryCards = `
    <div class="grid">
      <div class="card"><div class="metric">${esc(launch.profileComplete)}</div><div class="muted">Profile complete</div></div>
      <div class="card"><div class="metric">${esc(launch.servicesSelected)}</div><div class="muted">Services selected</div></div>
      <div class="card"><div class="metric">${esc(launch.areasSelected)}</div><div class="muted">Areas selected</div></div>
      <div class="card"><div class="metric">${esc(launch.pagesGenerated)}</div><div class="muted">Pages generated</div></div>
      <div class="card"><div class="metric">${esc(launch.competitorsFound)}</div><div class="muted">Competitors found</div></div>
      <div class="card"><div class="metric">${esc(launch.opportunitiesFound)}</div><div class="muted">Opportunities found</div></div>
    </div>`;

  res.type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Pharmacy Intelligence — ${esc(launch.pharmacyName)}</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;background:#f8fafc;margin:0;color:#0f172a}
    header{background:#005eb8;color:white;padding:22px 30px}
    header h1{margin:0;font-size:24px}
    header p{margin:6px 0 0;color:#dbeafe}
    main{max-width:1200px;margin:24px auto;padding:0 18px 40px}
    .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:16px}
    .card{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin-bottom:16px}
    .metric{font-size:28px;font-weight:900;color:#005eb8}
    .muted{color:#64748b;font-size:13px}
    h2{margin:0 0 12px;font-size:19px}
    table{width:100%;border-collapse:collapse}
    th,td{border-bottom:1px solid #e2e8f0;text-align:left;padding:10px;vertical-align:top;font-size:14px}
    th{background:#f1f5f9;color:#334155}
    ul{margin:8px 0 0;padding-left:20px}
    .btn{display:inline-block;background:#005eb8;color:white;text-decoration:none;border-radius:8px;padding:10px 14px;font-weight:800;margin-right:8px}
    .btn.alt{background:#0f766e}
    .btn.secondary{background:#334155}
    @media(max-width:900px){.grid{grid-template-columns:1fr 1fr}}
  </style>
</head>
<body>
<header>
  <h1>Pharmacy Intelligence</h1>
  <p>Launch summary for ${esc(launch.pharmacyName)}${launch.qualityScore != null ? ` · Quality ${launch.qualityScore}/50` : ""}</p>
</header>
<main>
  <p>
    <a class="btn" href="/api/pharmacy-executive-dashboard">Executive Dashboard</a>
    <a class="btn alt" href="/api/pharmacy-competitor-dashboard">Competitor Intelligence</a>
    <a class="btn secondary" href="/api/pharmacy-launch-demo">Launch Guide</a>
  </p>
  <section id="launch-summary" data-section="launch-summary">
    <h2 style="margin:0 0 14px;font-size:19px">Launch Readiness Summary</h2>
    ${summaryCards}
  </section>
  ${detailHtml}
</main>
</body>
</html>`);
});

export default router;
