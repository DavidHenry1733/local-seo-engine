# Growth Engine — Founder Partner Dashboard Access V1

**Sprint:** Founder Partner Dashboard Access V1  
**Feature freeze:** Active — no new platform features, no generator or BPI changes  
**Test tenant:** `dhmdigital` (Blood Pressure Checks campaign)  
**Dashboard entry:** `/api/growth-engine/dashboard?slug=dhmdigital`  
**Date:** June 2026

---

## Objective

Make the Founder Partner dashboard the **single operational interface** for completing a first campaign. Testers should not need SSH, PuTTY, terminal, JSON editing, or hidden API routes.

---

## Workflow audit (Blood Pressure Checks)

| Step | Dashboard action | Previously required terminal/API? | Status |
|------|------------------|-------------------------------------|--------|
| Business Profile | Open → `/api/growth-engine/business-intelligence` | No | ✅ Dashboard |
| Local Healthcare Intelligence | Open → `/api/growth-engine/local-market` (discover on page) | No | ✅ Dashboard |
| Website Intelligence | Open → `/api/growth-engine/website-intelligence` (analyse on page) | No | ✅ Dashboard |
| Growth Intelligence | Open → `/api/growth-engine/growth-intelligence` | No | ✅ Dashboard |
| Growth Plan | Open → `/api/growth-engine/growth-plan` | No | ✅ Dashboard |
| Generate Campaign | Open → content package page (generate on page) | No | ✅ Dashboard |
| Review Assets | Open → `/api/pharmacy-asset-review` | No | ✅ Dashboard |
| Approve Content | Open → asset review approval | No | ✅ Dashboard |
| Prepare Publish Output | **Run →** `POST /api/pharmacy-publishing/:slug/prepare` | Yes — API/terminal | ✅ Dashboard (V1) |
| Test FTP Connection | **Run →** `POST /api/pharmacy-publishing/:slug/ftp-test` | Yes — API/terminal | ✅ Dashboard (V1) |
| Publish to Live Website | **Run →** `POST /api/pharmacy-publishing/:slug/publish` (confirm) | Yes — API/terminal | ✅ Dashboard (V1) |
| Register Pages for Indexing | **Run →** `POST /api/pharmacy-indexing/:slug/register` | Yes — hidden API | ✅ Dashboard |
| Submit to Search Console | **Run →** `POST /api/pharmacy-indexing/:slug/submit` | Yes — hidden API | ⚠️ Gap if OAuth not connected |

---

## Changes applied (V1)

1. **Founder Partner Campaign Workflow panel** on the Growth Journey dashboard — 13-step checklist with status badges (Done / Ready / Pending / Gap).
2. **Dashboard branding** — "Founder Partner Dashboard" as operational home.
3. **API actions from dashboard** — Prepare, FTP test, publish, register indexing, and GSC submit via in-page **Run →** buttons (no JSON editing).
4. **Enhanced API handler** — Supports `data-body` (e.g. `{ serviceId }`, `{ serviceId, confirm: true }`) and `data-confirm` for publish.
5. **Today's tasks** — Prepare / FTP / publish surfaced as API tasks when cycle stage warrants (up to 8 tasks).
6. **Operational gaps** — FTP and GSC steps show **Gap** badge and explanatory notes when configuration or OAuth is missing.

---

## Operational gaps (displayed, not bugs)

| Gap | When shown | What the tester sees |
|-----|------------|----------------------|
| **FTP not configured** | `deploy` block missing or `DEPLOY_USERNAME` / `DEPLOY_PASSWORD` unset | Gap badge on FTP Test and Publish steps |
| **GSC OAuth not connected** | No `/tmp/.gsc-oauth-tokens.json` and no `GSC_OAUTH_REFRESH_TOKEN` | Gap badge on Submit to Search Console |
| **GSC submit local-only** | OAuth connected but Indexing API not fully wired | Submit may update local tracker only — see Live Integration Proof |

These gaps are **intentionally visible** so Founder Partners know what requires platform configuration outside the dashboard workflow.

---

## Actions still on sub-pages (not gaps)

These steps open dedicated pages where the action already existed — no terminal required:

- **Local discover** — button on Local Healthcare Intelligence page
- **Website analyse** — button on Website Intelligence page
- **Content generate** — button on content package page
- **Asset review / approve** — asset review page

---

## Validation

```bash
npx tsx scripts/validate-growth-engine-founder-partner-dashboard-v1.ts
```

Also run regression suites:

```bash
npx tsx scripts/validate-growth-engine-operational-completion-v1.ts
npx tsx scripts/validate-growth-engine-framework-v1.ts
npx tsx scripts/validate-growth-engine-live-integration-proof-v1.ts
npx tsx scripts/validate-growth-engine-live-publishing-v1.ts
```

---

## Expected tester experience

1. Open **Founder Partner Dashboard** for `dhmdigital`.
2. Follow the **Founder Partner Campaign Workflow** checklist top to bottom.
3. Use **Open →** for intelligence, plan, content, and review steps.
4. Use **Run →** for prepare, FTP test, publish, register, and GSC submit.
5. If FTP or GSC is not configured, read the **Operational gaps** box — no guessing, no developer tools.

No SSH, PuTTY, terminal, or manual JSON editing is required for any step that has backend support wired to the dashboard.
