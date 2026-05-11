import { Router } from "express";

const router = Router();

const MOCKUP_BASE =
  "https://d5baf6ac-a720-47d6-a07f-171958cff9fa-00-3tfwp4f8nkoys.janeway.replit.dev/__mockup/preview";

const designs = [
  {
    id: "command",
    name: "Command Center",
    description: "Dark sidebar, data-dense dashboard",
    url: `${MOCKUP_BASE}/seo-wizard-command/CommandCenter`,
    tag: "Professional",
    tagColor: "#6366F1",
  },
  {
    id: "stepper",
    name: "Clean Stepper",
    description: "Light, focused step-by-step wizard",
    url: `${MOCKUP_BASE}/seo-wizard-stepper/CleanStepper`,
    tag: "Minimal",
    tagColor: "#059669",
  },
  {
    id: "glass",
    name: "Glass Pro",
    description: "Dark gradient, frosted glass, modern SaaS",
    url: `${MOCKUP_BASE}/seo-wizard-glass/GlassPro`,
    tag: "Premium",
    tagColor: "#7C3AED",
  },
];

router.get("/designs", (_req, res) => {
  const cards = designs
    .map(
      (d) => `
    <div class="design-card" id="card-${d.id}">
      <div class="card-header">
        <div class="card-meta">
          <span class="tag" style="background:${d.tagColor}20;color:${d.tagColor};border-color:${d.tagColor}40">${d.tag}</span>
          <h2>${d.name}</h2>
          <p>${d.description}</p>
        </div>
        <a href="${d.url}" target="_blank" class="open-btn">Open full size ↗</a>
      </div>
      <div class="frame-wrap">
        <iframe src="${d.url}" loading="lazy" title="${d.name}"></iframe>
      </div>
    </div>
  `,
    )
    .join("");

  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UI Design Variants — SEO Builder</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0F172A;
      color: #E2E8F0;
      min-height: 100vh;
    }
    header {
      padding: 28px 40px 20px;
      border-bottom: 1px solid #1E293B;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    header h1 { font-size: 1.25rem; font-weight: 700; color: #F8FAFC; }
    header p  { font-size: .85rem; color: #64748B; margin-top: 2px; }
    .nav-pills {
      display: flex; gap: 8px;
    }
    .nav-pills a {
      padding: 6px 16px; border-radius: 20px; font-size: .82rem;
      text-decoration: none; color: #94A3B8; border: 1px solid #1E293B;
      transition: all .15s;
    }
    .nav-pills a:hover { background: #1E293B; color: #F1F5F9; }

    main { padding: 32px 40px; display: flex; flex-direction: column; gap: 48px; }

    .design-card {
      border: 1px solid #1E293B;
      border-radius: 16px;
      overflow: hidden;
      background: #0D1526;
    }
    .card-header {
      padding: 20px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1E293B;
    }
    .card-meta { display: flex; align-items: center; gap: 16px; }
    .tag {
      font-size: .72rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: .05em; padding: 3px 10px; border-radius: 20px;
      border: 1px solid;
    }
    .card-meta h2 { font-size: 1rem; font-weight: 700; color: #F1F5F9; }
    .card-meta p  { font-size: .82rem; color: #64748B; margin-top: 1px; }
    .open-btn {
      padding: 8px 18px; border-radius: 8px; font-size: .82rem; font-weight: 600;
      background: #6366F1; color: #fff; text-decoration: none;
      transition: background .15s;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .open-btn:hover { background: #4F46E5; }

    .frame-wrap {
      width: 100%;
      height: 700px;
      position: relative;
      background: #000;
    }
    .frame-wrap iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>UI Design Variants</h1>
      <p>Three design directions for the Local SEO Builder — click "Open full size ↗" on any to view in a new tab</p>
    </div>
    <nav class="nav-pills">
      ${designs.map((d) => `<a href="#card-${d.id}">${d.name}</a>`).join("")}
    </nav>
  </header>
  <main>${cards}</main>
</body>
</html>`);
});

export default router;
