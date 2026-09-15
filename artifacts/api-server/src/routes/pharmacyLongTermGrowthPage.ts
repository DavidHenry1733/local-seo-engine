/**
 * How PharmaConnect Builds Long-Term Growth — customer education page.
 */
import { Router } from "express";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";
import { PRIMARY_PLATFORM_SERVICE_ID } from "../../../../src/pharmacy/pharmacyPlatformDashboardService.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

const TOPICS = [
  {
    title: "Google rewards trusted pharmacies",
    body: "Search engines prefer businesses that look genuine, local, and professionally run. Your growth programme builds that trust steadily — with accurate details, professional review, and helpful patient content.",
  },
  {
    title: "Real businesses grow over time",
    body: "A pharmacy that appears online once and disappears is less trusted than one that grows month by month. PharmaConnect is designed for months of progress, not a single rushed launch.",
  },
  {
    title: "Publishing strategically beats publishing everything at once",
    body: "We help you launch core services first, then expand into local areas and supporting content. That focused approach is better for patients and for long-term visibility.",
  },
  {
    title: "Continuous optimisation",
    body: "After your pages go live, we monitor performance and suggest improvements. Small regular updates keep your pharmacy ahead of competitors who set and forget their website.",
  },
  {
    title: "Professional review matters",
    body: "Healthcare content should clearly show who is responsible for clinical accuracy. Your programme includes steps to identify your pharmacist reviewer — something patients and search engines both value.",
  },
  {
    title: "Monitoring your local presence",
    body: "We track whether your pages are found, how visible you are locally, and what to improve next. You see simple summaries — we handle the technical monitoring.",
  },
  {
    title: "Building local authority",
    body: "Patients search for pharmacies near them. Your programme strengthens local signals — areas served, directions, services, and community relevance — so nearby patients can find you.",
  },
];

router.get("/pharmacy-long-term-growth", (req, res) => {
  const slug = esc(String(req.query.slug || "pharmaconnect"));
  const topics = TOPICS.map(
    (t) => `<article class="topic"><h2>${esc(t.title)}</h2><p>${esc(t.body)}</p></article>`,
  ).join("");

  res.type("html").send(`<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>How PharmaConnect Builds Long-Term Growth</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f4f6f9;color:#0f172a;line-height:1.6}
header{background:#0f172a;color:#fff;padding:24px 28px}
header h1{margin:0;font-size:24px;font-weight:800}
header p{margin:8px 0 0;color:#94a3b8;font-size:15px;max-width:640px}
main{max-width:720px;margin:28px auto 48px;padding:0 20px}
.intro{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;margin-bottom:20px;font-size:16px;color:#334155}
.topic{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;margin-bottom:14px}
.topic h2{margin:0 0 10px;font-size:18px;color:#0f172a}
.topic p{margin:0;font-size:15px;color:#475569}
.btn{display:inline-block;margin-top:20px;background:#005eb8;color:#fff;padding:12px 20px;border-radius:10px;font-weight:700;text-decoration:none}
${platformPlatformNavCss()}
</style>
</head>
<body>
<header>
  <h1>How PharmaConnect Builds Long-Term Growth</h1>
  <p>A simple guide for pharmacy owners — no technical jargon.</p>
  ${renderPharmacyPlatformNavBar({ slug: String(req.query.slug || "pharmaconnect"), serviceId: PRIMARY_PLATFORM_SERVICE_ID, activeId: "platform-dashboard" })}
</header>
<main>
  <div class="intro">
    <p>PharmaConnect is not a tool you switch on once. It is a <strong>managed growth programme</strong> that helps your pharmacy become more visible, more trusted, and more useful to local patients over time.</p>
  </div>
  ${topics}
  <a class="btn" href="/api/pharmacy-dashboard?slug=${slug}">← Back to your Growth Programme</a>
</main>
</body>
</html>`);
});

export default router;
