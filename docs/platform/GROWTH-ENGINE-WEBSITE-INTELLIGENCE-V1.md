# Growth Engine — Website Intelligence V1 (Step 3)

**Status:** Complete  
**Sprint:** Product Refinement — Sprint 3  
**Route:** `/api/growth-engine/website-intelligence?slug={tenant}`  
**API:** `POST /api/growth-engine/:slug/website-intelligence/analyse`

## Purpose

Website Intelligence is a **Website Understanding Engine** — not an SEO audit.

It answers:

- What does my website currently contain?
- What important pharmacy content am I missing?
- What can PharmaConnect improve?

This step bridges **Business Intelligence** and **Growth Intelligence**.

## Workflow position

| Step | ID | Title |
|------|-----|-------|
| 1 | business-intelligence | Business Intelligence |
| 2 | local-market | Local Healthcare Intelligence |
| 3 | **website-intelligence** | **Website Intelligence** |
| 4 | growth-intelligence | Growth Intelligence |
| 5 | growth-plan | Growth Plan |
| 6 | generate | Generate Ecosystem |
| 7 | dashboard | Growth Dashboard |

## What it does

### Website analysis
Crawls the pharmacy website (homepage, sitemap, internal links — up to 60 pages) and classifies each page:

Homepage · About · Contact · Services · Service Pages · Locations · Blogs · Guides · FAQs · Policies · Booking · News · Resources · Other

**No scores. No audit. Understanding only.**

### Pharmacy service detection
Matches 20+ service patterns (Pharmacy First, Blood Pressure, Travel Clinic, Flu/Covid vaccination, etc.) from URL and page content.

Per detected service: page count, main page, supporting blogs/FAQs/guides/local pages.

### Content inventory
Counts service pages, blogs, guides, FAQs, locations, news, videos, downloads — identification only, no quality analysis.

### Content coverage
Compares **Business Profile `selectedServices`** vs website detection with genuine supporting content counts.

### Missing content
Evidence-backed gaps: no service page, no FAQs, no guide, no local pages, no blog support.

### Content opportunities
Every recommendation references evidence (e.g. enabled but not detected, present but thin supporting content).

### Technical overview
Basic signals only: HTTPS, sitemap, robots.txt, schema, meta title/description, Open Graph, canonical. **No SEO/health/authority scores.**

### Visual summary
Current website page counts vs **recommended ecosystem** pages derived from enabled services and target areas in the Business Profile.

### Content map
Visual structure: Home → Services → Supporting → Blogs → Guides → FAQs → Locations.

## Key files

| File | Role |
|------|------|
| `growthEngineWebsiteIntelligenceModel.ts` | Types and snapshot schema |
| `growthEngineWebsiteCrawler.ts` | Fetch, sitemap, link discovery |
| `growthEngineWebsiteClassifier.ts` | Page classification |
| `growthEngineWebsiteServiceDetection.ts` | Service pattern matching |
| `growthEngineWebsiteIntelligenceAnalysis.ts` | Inventory, coverage, missing, opportunities |
| `growthEngineWebsiteIntelligenceService.ts` | Analyse + persist snapshot |
| `growthEngineWebsiteIntelligencePage.ts` | Step 3 page renderer |

## Snapshot

Stored at `data/growth-engine/{slug}-website-intelligence.json`

## Validation

```bash
npx tsx scripts/validate-growth-engine-website-intelligence-v1.ts
npx tsx scripts/validate-growth-engine-framework-v1.ts
npx tsx scripts/validate-growth-engine-growth-intelligence-v1.ts
npx tsx scripts/validate-growth-engine-local-healthcare-v1.ts
npx tsx scripts/validate-growth-engine-sprint1-bi-v1.ts
```

## Locked systems (unchanged)

Do **not** modify: Business Profile Intelligence, Business Profile Wizard, generators, long form, service/cluster pages, **Growth Intelligence engine**, approval gates, deployment, registry, lifecycle, health audit, dashboard analytics, **Local Healthcare Intelligence**.

## Expected result

The pharmacy owner immediately understands what they have, what they lack, and what PharmaConnect will build — before Growth Intelligence.

Run **Analyse website** on Step 3 after Business Intelligence includes a website URL.
