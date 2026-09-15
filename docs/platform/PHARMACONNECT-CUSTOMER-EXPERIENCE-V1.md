# PharmaConnect Customer Experience & Growth Programme V1

This sprint redesigns the **customer journey** so PharmaConnect feels like a **managed digital growth programme** — not SEO software, not an AI engine, and not an instant publishing platform.

## Primary principle

A pharmacy owner should never feel they are operating SEO software. They should feel they have enrolled their pharmacy into a structured growth programme.

Every screen reinforces:

- **We guide you.**
- **We do the technical work.**
- **You simply complete the next step.**

Internal APIs and services still use **campaign** naming. Customer-facing UI uses **Growth Plan** terminology only in the presentation layer.

## Customer journey

```
First login
    │
    ▼
Welcome screen (Growth Programme dashboard)
    │  • What PharmaConnect does
    │  • Why long-term growth matters
    │  • Programme timeline (Week 1 → Months 4–6)
    │
    ▼
Outstanding Tasks
    │  • Only actions that need the owner today
    │  • Title, estimated time, why it matters, Continue
    │
    ▼
Current Growth Plan → Progress → Performance
    │
    └── Advanced Tools (collapsed) — full module access when needed
```

Post-login destination remains `/api/pharmacy-dashboard?slug=…` (Growth Programme).

## Growth philosophy

PharmaConnect builds **long-term local authority** for community pharmacies:

| Idea | Customer message |
|------|------------------|
| Trust over time | Real businesses grow month by month, not overnight |
| Strategic publishing | Core services first, then local areas and patient content |
| Professional review | Healthcare content shows who is clinically responsible |
| Continuous optimisation | Monitoring and improvements after pages go live |
| Local relevance | Patients search for pharmacies near them |

Full plain-language guide: `/api/pharmacy-long-term-growth?slug=…`

## Platform simplification

The Growth Programme dashboard has **five sections**:

1. **Outstanding Tasks** — renamed from “Today’s Tasks”; action-only list
2. **Current Growth Plan** — active service plan with Start / Manage CTA
3. **Progress** — Growth Journey phase + Growth Progress %
4. **Performance** — visibility, indexing, recommended improvements, tier
5. **Advanced Tools** — collapsed `<details>` panel

Nothing is removed. Technical modules move under Advanced Tools.

## Progressive disclosure

| Audience | Experience |
|----------|------------|
| New pharmacy owners | Welcome, timeline, outstanding tasks, simple progress |
| Experienced users | Expand Advanced Tools for Campaign OS, Content Review, Publishing, Search Visibility, Reports, Growth Analytics |

Technical reports remain available but do not dominate the first-screen experience.

## Terminology mapping (UI only)

| Internal | Customer UI |
|----------|-------------|
| Campaign | Growth Plan |
| Campaign Progress | Growth Journey |
| Campaign Completion | Growth Progress |
| Platform Dashboard | Growth Programme |
| Today’s Tasks | Outstanding Tasks |

## Commercial Growth Plans (presentation)

Three tiers prepare future packaging. **Campaign generation is unchanged.**

| Tier | Positioning |
|------|-------------|
| **Starter** | Perfect for pharmacies beginning their digital growth |
| **Professional** | Expanded local visibility across core services |
| **Complete** | Full long-term growth programme with ongoing optimisation |

Active tier is derived from overall completion % and active campaign count (`pharmacyCustomerExperienceService.ts`).

## Advanced Tools grouping

| Label | Route |
|-------|-------|
| Campaign Management | `/api/pharmacy-campaigns` |
| Content Review | `/api/pharmacy-authority-readiness` |
| Publishing | `/api/pharmacy-publishing-settings` |
| Search Visibility | `/api/pharmacy-growth-dashboard#visibility` |
| Recommended Improvements | `/api/pharmacy-growth-actions` |
| Reports | `/api/pharmacy-growth-dashboard` |
| Growth Analytics | `/api/pharmacy-growth-dashboard#indexing` |
| Profile Dashboard | `/api/pharmacy-profile-dashboard` |

## Architecture

```
pharmacyPlatformDashboardService.ts     ← existing data + OS
        │
        └── pharmacyCustomerExperienceService.ts   ← V1 presentation layer
                    │
                    ├── pharmacyPlatformDashboardPage.ts   ← Growth Programme UI
                    └── pharmacyLongTermGrowthPage.ts      ← education page
```

No changes to authority enhancement engine, visual templates, or content generation pipelines.

## Future onboarding

This sprint lays groundwork for:

- Tier-based commercial packaging (Starter / Professional / Complete)
- Welcome-first onboarding before task lists
- Programme timeline as expectation-setting during sales and signup
- Optional welcome dismissal after first visit (not implemented in V1 — welcome always shown)

## Validation

```bash
pnpm run pharmacy:customer-experience:validate
```

Checks: welcome screen, outstanding tasks, Growth Journey/Progress, collapsed Advanced Tools, Growth Plan terminology, timeline, commercial tiers, long-term growth page, no workflow dead ends, no engine or content generation changes.

Report: `data/validation-reports/pharmacy-customer-experience-v1.json`

## Success criteria

Within five minutes a first-time pharmacy owner should understand:

1. What PharmaConnect does
2. Why long-term growth matters
3. What they need to do today
4. What happens next
5. How their pharmacy will grow over the coming months

The platform should feel like a **managed digital growth programme delivered by experienced professionals**, not a collection of SEO tools or AI generators.
