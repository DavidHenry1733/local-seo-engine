# Growth Engine — Local Market Report V2

**Sprint:** Local Market Report V2 — Commercial Intelligence  
**Feature freeze:** Presentation layer only  
**Page:** `/api/growth-engine/local-market?slug={tenant}`  
**Date:** July 2026

---

## Objective

Transform **Your Local Market** into the platform's strongest commercial report — business intelligence from live Google Places, not SEO.

---

## Seven sections

| # | Section | Content |
|---|---------|---------|
| 1 | **Your Google Business Profile** | Premium summary card — rating, reviews, photos, categories, hours, contact, badges |
| 2 | **Local market overview** | Live counts: pharmacies, GP surgeries, hospitals, health centres, walk-in centres, care homes, other providers |
| 3 | **Competitor comparison** | Progress bars + premium competitor cards sorted by distance (no Place IDs) |
| 4 | **Market insights** | Max 6 plain-English observations from evidence |
| 5 | **Recommended actions** | Max 6 actions supported by live data |
| 6 | **Healthcare network** | Simple cards by provider type |
| 7 | **Local opportunity** | Executive summary, max 120 words |

---

## Design principles

- Cards, large numbers, progress comparisons — **no spreadsheets**
- **No SEO terminology** in customer HTML
- **No invented metrics** — counts and comparisons from `google-places-live` only
- Analysis engines unchanged (`growthEngineLocalMarketAnalysis.ts`, healthcare discovery)

---

## Files

| File | Role |
|------|------|
| `growthEngineLocalMarketReportView.ts` | V2 view model (insights, actions, opportunity) |
| `growthEngineLocalMarketPage.ts` | V2 page renderer |

---

## Validation

```bash
npx tsx scripts/validate-growth-engine-local-market-v2.ts
```

Regression:

```bash
npx tsx scripts/validate-growth-engine-local-market-v1.ts
npx tsx scripts/validate-growth-engine-product-reset-v1.ts
```
