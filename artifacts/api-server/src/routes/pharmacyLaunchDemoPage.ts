import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const router = Router();

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "pharmaconnect";

function esc(v: unknown): string {
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

function demoStepStatus() {
  const profileDoc = readJson(path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`));
  const profile = profileDoc?.data || {};
  const localIntel = readJson(path.join(ROOT, "data/pharmacy-local-intelligence", `${SLUG}.json`));
  const competitorDash =
    readJson(path.join(ROOT, "data/pharmacy-competitor-intelligence", `${SLUG}-dashboard.json`)) ||
    readJson(path.join(ROOT, "data/pharmacy-opportunity-engine", `${SLUG}-dashboard.json`));
  const publishIndex = readJson(path.join(ROOT, "output/pharmacy-publish", SLUG, "_publish-index.json"));

  const required = ["pharmacyName", "postcode", "townCity", "gphcNumber", "phone"];
  const profileDone = required.every((f) => String(profile[f] || "").trim());

  const entityGroups = [
    "gpSurgeries", "hospitals", "healthCentres", "careHomes", "schools",
    "landmarks", "communityFacilities", "transportLinks", "retailCentres", "residentialAreas",
  ];
  const entitiesSelected = entityGroups.some((k) => Array.isArray(profile[k]) && profile[k].length > 0);
  const localIntelDone = Boolean(profile.localIntelligenceGenerated || localIntel?.gpSurgeries?.length);
  const competitorDone = Boolean(competitorDash?.competitors?.length);
  const pagesDone = (publishIndex?.pageCount || 0) >= 240;

  return [
    {
      n: 1,
      title: "Complete profile",
      desc: "Fill in pharmacy details, trust fields, location and services — then save on the Review tab.",
      href: "/api/pharmacy-setup",
      cta: "Open Setup",
      done: profileDone,
    },
    {
      n: 2,
      title: "Generate local intelligence",
      desc: "Discover nearby GP surgeries, hospitals, schools and community places from your pharmacy address.",
      href: "/api/pharmacy-setup",
      cta: "Local Intelligence tab",
      done: localIntelDone,
    },
    {
      n: 3,
      title: "Select local entities",
      desc: "Tick the places that are genuinely relevant to your patients, then save your profile.",
      href: "/api/pharmacy-setup",
      cta: "Review selections",
      done: entitiesSelected,
    },
    {
      n: 4,
      title: "Run competitor intelligence",
      desc: "Analyse nearby pharmacies, review gaps and service competition.",
      href: "/api/pharmacy-competitor-dashboard",
      cta: "Competitor Dashboard",
      done: competitorDone,
    },
    {
      n: 5,
      title: "Generate pages",
      desc: "240 publish-ready service, hub and area pages are built from your saved profile and selections.",
      href: "/api/pharmacy-executive-dashboard",
      cta: "View summary",
      done: pagesDone,
    },
    {
      n: 6,
      title: "Executive dashboard",
      desc: "Your primary growth view — competitor position, opportunities, local coverage and prioritised actions.",
      href: "/api/pharmacy-executive-dashboard",
      cta: "Executive Dashboard",
      done: pagesDone && competitorDone,
    },
  ];
}

router.get("/pharmacy-launch-demo", (_req, res) => {
  const steps = demoStepStatus();
  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  const stepHtml = steps
    .map(
      (s) => `
    <div class="step ${s.done ? "done" : "pending"}">
      <div class="step-num">${s.done ? "✓" : s.n}</div>
      <div class="step-body">
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.desc)}</p>
        <a class="btn ${s.done ? "secondary" : ""}" href="${esc(s.href)}">${esc(s.cta)}</a>
      </div>
    </div>`,
    )
    .join("");

  res.type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>PharmaConnect Launch Demo</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;background:#f8fafc;margin:0;color:#0f172a}
    header{background:#005eb8;color:white;padding:22px 30px}
    header h1{margin:0;font-size:24px}
    header p{margin:6px 0 0;color:#dbeafe}
    main{max-width:900px;margin:24px auto;padding:0 18px 40px}
    .progress{background:#e2e8f0;border-radius:999px;height:10px;margin:16px 0 24px;overflow:hidden}
    .progress-bar{background:#0f766e;height:100%;width:${pct}%;transition:width .3s}
    .step{display:flex;gap:16px;background:white;border:1px solid #e2e8f0;border-radius:14px;padding:18px;margin-bottom:12px}
    .step.done{border-color:#86efac;background:#f0fdf4}
    .step-num{width:36px;height:36px;border-radius:50%;background:#005eb8;color:white;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0}
    .step.done .step-num{background:#16a34a}
    .step-body h3{margin:0 0 6px;font-size:17px}
    .step-body p{margin:0 0 10px;color:#64748b;font-size:14px;line-height:1.5}
    .btn{display:inline-block;background:#005eb8;color:white;text-decoration:none;border-radius:8px;padding:8px 14px;font-weight:700;font-size:13px}
    .btn.secondary{background:#64748b}
    .toolbar{margin-bottom:20px}
    .toolbar a{margin-right:8px}
    .muted{color:#64748b;font-size:13px}
  </style>
</head>
<body>
<header>
  <h1>PharmaConnect Launch Demo</h1>
  <p>Guided path for demo and soft launch · ${completed}/${steps.length} steps complete (${pct}%)</p>
</header>
<main>
  <div class="toolbar">
    <a class="btn" href="/api/pharmacy-setup">Pharmacy Setup</a>
    <a class="btn secondary" href="/api/pharmacy-executive-dashboard">Executive Dashboard</a>
    <a class="btn secondary" href="/api/pharmacy-competitor-dashboard">Competitors</a>
  </div>
  <div class="progress"><div class="progress-bar"></div></div>
  <p class="muted">Follow these steps in order. Each step links to the right screen in PharmaConnect.</p>
  ${stepHtml}
</main>
</body>
</html>`);
});

export default router;
