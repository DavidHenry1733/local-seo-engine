# Growth Engine — Live Integration Proof Report V1

**Sprint:** Live Integration Proof V1  
**Feature freeze:** Active — integration proof only, no new product features  
**Test tenant:** `dhmdigital` (primary)  
**Date:** June 2026

---

## Executive summary

This sprint proves which Growth Engine integrations work against **real external systems** before full end-to-end Growth Cycle testing. Each integration is probed for credentials, connection, live test results, and clear status labels. **No simulated data is presented as live.**

**Status page:** `/api/growth-engine/live-integration-proof?slug=dhmdigital`  
**JSON API:** `GET /api/growth-engine/:slug/live-integration-proof`  
**Run live tests:** `POST /api/growth-engine/:slug/live-integration-proof/run?live=all`

---

## Integration status matrix

| Integration | What it unlocks | Credential / config |
|-------------|-----------------|---------------------|
| Google Places API | Local Healthcare Intelligence, competitor discovery, pharmacy lookup | `GOOGLE_PLACES_API_KEY` |
| Website Import | Brand import, colours, logo, services, opening hours | Website URL on Business Profile |
| Image Generation (Ideogram) | AI images for campaigns and service pages | `IDEOGRAM_API_KEY` |
| Static Publishing | Local HTML output, sitemap, page tracker | Content generated + publish build |
| FTP / Live Publishing | Upload pages and sitemap to live website | `deploy` in project config + `DEPLOY_USERNAME` / `DEPLOY_PASSWORD` |
| Google Search Console | Indexing status, URL submission, performance | GSC OAuth or `GOOGLE_SERVICE_ACCOUNT_JSON` |
| Rank Tracking | Keyword positions and visibility dashboard | GSC OAuth + `output/{slug}/rank-tracking.json` |

---

## Status labels

| Label | Meaning |
|-------|---------|
| **Ready** | Live test passed; integration ready for Growth Cycle use |
| **Connected** | Live data confirmed |
| **Limited** | Credentials or partial data present; live test not yet run or incomplete |
| **Not Connected** | Missing credentials or prerequisites |
| **Error** | Live test failed (API rejection, connection error) |

---

## dhmdigital — expected findings

| Integration | Expected status | Notes |
|-------------|-----------------|-------|
| Google Places | Ready (with live test) | API key in `.env`; run discovery to refresh snapshot |
| Website Import | Ready (with live fetch) | Profile website `https://dhmdigital.net` |
| Ideogram | Connected / Limited | Depends on `IDEOGRAM_API_KEY` |
| Static Publishing | Ready / Limited | Depends on prior content generation |
| FTP Publishing | Not Connected | `config/projects/dhmdigital.json` has no `deploy` section |
| Google Search Console | Limited / Not Connected | Requires OAuth flow or service account |
| Rank Tracking | Not Connected / Limited | Requires GSC + `build-rank-tracking.ts` |

---

## Anti-fake-data rules

1. **Indexing dashboard** — `indexing.live` is true only when `index-tracking.json` has live GSC inspection records (`hasLiveGscIndexingData`).
2. **Rankings dashboard** — `rankings.live` is true only when `rank-tracking.json` has keyword data (`hasLiveRankTrackingData`).
3. **Integration proof page** — Checks marked **LIVE** only when `liveData: true` on the probe result.
4. **Simulated bridges** — When GSC/rank files are absent, operational dashboard shows placeholder notes, not “live” labels.

---

## Validation

```bash
# Static validation (no external calls beyond credential checks)
npx tsx scripts/validate-growth-engine-live-integration-proof-v1.ts

# Live probes (uses real APIs — may incur cost)
npx tsx scripts/validate-growth-engine-live-integration-proof-v1.ts \
  --live-places --live-website --live-ideogram --write-report

# FTP list test (requires deploy config)
npx tsx scripts/validate-growth-engine-live-integration-proof-v1.ts --live-ftp-list
```

---

## Files added / modified

| File | Purpose |
|------|---------|
| `src/pharmacy/growthEngineLiveIntegrationModel.ts` | Types, integration metadata |
| `src/pharmacy/growthEngineLiveIntegrationProofService.ts` | Probes, persistence, live-data helpers |
| `src/pharmacy/growthEngineLiveIntegrationProofPage.ts` | HTML status report |
| `artifacts/api-server/src/routes/growthEnginePageRouter.ts` | HTML route |
| `artifacts/api-server/src/routes/api/growthEngine.ts` | JSON + run routes |
| `src/pharmacy/growthEngineOperationalActions.ts` | Live vs simulated indexing/rank labels |
| `scripts/validate-growth-engine-live-integration-proof-v1.ts` | Validation suite |

---

## Next steps before full Growth Cycle E2E

1. Run **Live Integration Proof** with `live=all` for `dhmdigital`.
2. Connect **FTP deploy** in project config if live publishing is required.
3. Complete **GSC OAuth** and run index tracking refresh.
4. Build **rank tracking** layer after GSC is connected.
5. Confirm all **Ready** integrations before launching a full Growth Cycle test.


## Live test run — dhmdigital (2026-06-09)

Live probes run with `GOOGLE_PLACES_API_KEY` from `.env`. Results persisted to `data/growth-engine/dhmdigital-live-integration-proof.json`.

| Integration | Status | Result | Next action |
|-------------|--------|--------|-------------|
| Google Places API | **Ready** | Live discovery: 10 pharmacies, 60 healthcare providers | None — snapshot cached |
| Website Import | **Ready** | Live fetch of https://dhmdigital.net — name, logo, colours, contact, footer links, description | Services/hours not on site (N/A) |
| Image Generation (Ideogram) | **Not Connected** | `IDEOGRAM_API_KEY` not in server `.env` (present in `.env.production`) | Add key to runtime environment |
| Static Publishing | **Not Connected** | No publish output or sitemap yet | Generate content and build publish output |
| FTP / Live Publishing | **Not Connected** | No `deploy` section in project config | Configure deploy host + credentials |
| Google Search Console | **Limited** | OAuth refresh token available; no `index-tracking.json` yet | Register pages and run index refresh |
| Rank Tracking | **Not Connected** | No `rank-tracking.json` | Run `build-rank-tracking.ts` after GSC data |

**Overall:** 2/7 Ready, 1 Limited, 4 Not Connected — **not yet ready** for full end-to-end Growth Cycle testing (requires static publish + FTP + rank layer).

**Validation:** 42/42 checks passed (live integration proof), 26/26 operational, 36/36 framework, 40/40 cycle manager, 38/38 growth plan.
