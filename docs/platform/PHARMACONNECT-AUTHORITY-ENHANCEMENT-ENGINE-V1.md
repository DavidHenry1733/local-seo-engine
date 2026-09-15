# PharmaConnect Authority Enhancement Engine V1

The Authority Enhancement Engine is an **advisory AI Quality Consultant** layer. It analyses existing service pages, campaign data, profile, ecosystem assets, competitor intelligence, visibility and indexing — then recommends the highest-value improvements to maximise Google quality signals, E-E-A-T, local authority, information gain, AI citation readiness, patient usefulness and long-term visibility.

**This is not an audit.** The Authority Audit tells you where you are. The Enhancement Engine tells you exactly how to improve.

## Purpose

For every pharmacy service, the platform can explain:

- How strong the page is today
- What prevents it becoming an authority
- Exactly what should be improved
- Expected authority gain
- Expected AI citation gain
- Expected local visibility gain

All without modifying a single word of published content.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Read-only inputs                                           │
│  Authority Audit · Profile · Visual HTML · Ecosystem        │
│  Competitor Gap · Opportunity Engine · Growth Actions       │
│  Visibility · Indexing · Campaign OS                        │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  pharmacyAuthorityEnhancementService.ts                     │
│  155 signals · 10 categories · recommendation engine          │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  data/pharmacy-authority-enhancements/{slug}.json           │
│  Campaign OS section · Full dashboard HTML · JSON API       │
└─────────────────────────────────────────────────────────────┘
```

## Files

| File | Role |
|------|------|
| `src/pharmacy/pharmacyAuthorityEnhancementService.ts` | Core engine — signals, scoring, recommendations |
| `artifacts/api-server/src/routes/api/pharmacyAuthorityEnhancements.ts` | JSON API |
| `artifacts/api-server/src/routes/pharmacyAuthorityEnhancementsPage.ts` | Full HTML dashboard |
| `src/pharmacy/pharmacyCampaignControlCentreService.ts` | Campaign OS enrichment |
| `artifacts/api-server/src/routes/pharmacyCampaignsPage.ts` | Authority Enhancement Opportunities section |
| `scripts/validate-pharmacy-authority-enhancement-engine-v1.ts` | Validation |
| `data/pharmacy-authority-enhancements/{slug}.json` | Generated output |

**Not modified:** service masters, clinical copy, visual templates, published content.

## Signal model

**155 measurable enhancement signals** across 10 categories:

| Category | Focus |
|----------|--------|
| Human Expertise | Reviewer bio, experience, memberships, schema, accountability |
| Local Authority | Coverage, parking, transport, landmarks, GBP consistency |
| Information Gain | Arrival process, documents, aftercare, misconceptions |
| AI Citation | Definitions, FAQs, bullets, myth/fact, quick reference |
| Clinical Trust | Eligibility, exclusions, red flags, escalation, review schedule |
| Content Depth | Topic coverage, examples, images, internal links |
| Content Ecosystem | Blogs, guides, GBP, email, video, cross-links |
| Technical Quality | Schema, canonical, meta, alt text, noindex |
| Competitor Differentiation | Unique sections, USPs, gap closure |
| Patient Experience | Readability, booking clarity, CTA, trust near action |

Each signal: `present` / `missing` with evidence detail.

## Scoring

Per category:

- **Current Score** — % of signals present (0–100)
- **Potential Score** — 100 if all signals implemented
- **Improvement Potential** — gap to potential
- **Estimated Authority Gain** — derived from improvement potential
- **Estimated AI Citation Gain** — weighted for AI Citation category
- **Estimated Local Visibility Gain** — weighted for Local Authority category

Per service:

- **currentAuthorityScore** — from Authority Audit overall score
- **potentialAuthorityScore** — current + weighted recommendation gains
- **estimatedOverallImprovement** — potential minus current

## Recommendation model

Every recommendation includes:

| Field | Description |
|-------|-------------|
| title | Enhancement action |
| reason | Why it matters |
| evidence | Signal detail from analysis |
| difficulty | Easy · Medium · Advanced |
| estimatedImpact | Low · Medium · High |
| estimatedScoreGain | Authority points |
| estimatedAiGain | AI citation points |
| estimatedVisibilityGain | Local visibility points |
| linkedModule | Profile Dashboard, Image Library, etc. |
| recommendedNextAction | Specific next step |

Recommendations are ranked by impact, difficulty and score gain.

## Dashboard integration

### Campaign OS — Authority Enhancement Opportunities

Shows per active campaign:

- Current → Potential authority score
- Total recommendations, easy wins, high impact
- Estimated overall improvement
- Top 3 recommendations per service
- Platform top 10 recommendations

### Full page

`GET /api/pharmacy-authority-enhancements?slug={slug}&service={id}&category=&difficulty=&impact=`

Features:

- Service selector
- Category / difficulty / impact filters
- Category score grid with gain estimates
- Full recommendation list with evidence and links
- Refresh analysis button

### JSON API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/pharmacy-authority-enhancements/:slug` | Full JSON document + filtered dashboard |
| POST | `/api/pharmacy-authority-enhancements/:slug/refresh` | Re-run analysis |

## Validation

```bash
pnpm exec tsx scripts/validate-pharmacy-authority-enhancement-engine-v1.ts pharmaconnect
```

Report: `data/validation-reports/pharmacy-authority-enhancement-v1.json`

Checks:

1. ~150 signals defined
2. Enhancement JSON created
3. Four services analysed
4. All 10 categories scored
5. Recommendations generated
6. Current vs potential scores
7. Campaign OS integration
8. Enhancement page loads
9. No content/template/master modifications

## Example recommendations

Typical outputs for pharmaconnect demo profile:

| Recommendation | Difficulty | Impact | Module |
|----------------|------------|--------|--------|
| Enhance: Named accountability | Easy | High | Profile Dashboard |
| Enhance: Canonical URL | Medium | High | Authority Audit |
| Enhance: Remove noindex before live | Easy | High | Authority Audit |
| Enhance: Town-specific FAQs | Medium | High | Content review |
| Enhance: Reviewer schema opportunity | Advanced | High | Technical |
| Enhance: Add canonical URL | Medium | High | Authority Audit |
| Enhance: FAQ quality (5+ items) | Medium | High | Content Ecosystem |
| Enhance: GBP consistency | Easy | Medium | Profile Dashboard |

## Future roadmap

1. Persist profile professional review fields and auto-close enhancement signals
2. One-click "create growth action" from enhancement recommendation
3. Before/after score simulation when blockers resolved
4. Service-specific enhancement playbooks
5. Batch enhancement report export for client review

## Relationship to Authority Publish Gate

| Layer | Role |
|-------|------|
| Authority Audit | Where we are — publish gate PASS/FAIL |
| Authority Publish Gate | Blocks live publish when audit fails |
| Authority Enhancement | How to improve — advisory consultant |

Use audit + gate for go-live decisions. Use enhancement for prioritised improvement work.
