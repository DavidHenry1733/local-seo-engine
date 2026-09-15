# PharmaConnect Platform Operating System V1

The Platform Dashboard is the **single operating system** for PharmaConnect. It sits above all existing modules as an orchestration layer — not a new dashboard and not a redesign. Every other module becomes a guided workflow step.

## Primary principle

The platform always answers one question:

**What should I do next?**

The pharmacy owner never needs to decide which module to open. The Platform OS decides and exposes a **Continue Next Step** button that opens the correct destination.

## Architecture

```
Platform Dashboard (orchestration)
        │
        ├── pharmacyPlatformOperatingSystemService.ts  ← workflow sequencing, locking, modes
        │
        └── Existing modules (state only)
                ├── Profile Dashboard
                ├── Website Analysis (Profile)
                ├── Campaign OS
                ├── Image Library
                ├── Campaign Improvements
                ├── Ready To Publish (Publishing Settings)
                ├── Growth Dashboard (Indexing)
                └── Growth Actions
```

Modules expose **completion %**, **status**, **blocking issues**, **last updated**, and a **deep link**. They do not own workflow sequencing.

## Workflow (9 steps)

| Step | Title | Module |
|------|-------|--------|
| 1 | Business Profile | Profile Dashboard |
| 2 | Analyse Existing Website | Profile Dashboard (Brand Import) |
| 3 | Target Areas | Profile Dashboard (Coverage) |
| 4 | Create Campaign | Campaign OS |
| 5 | Campaign Assets | Image Library + content ecosystem |
| 6 | Campaign Improvements | Enhancement Workspace |
| 7 | Ready To Publish | Publishing Settings |
| 8 | Submit To Google | Growth Dashboard (Indexing) |
| 9 | Monitor Results | Growth Dashboard |

## State model

Every step reports exactly one status:

| Status | Meaning |
|--------|---------|
| `NOT_STARTED` | Step not yet begun |
| `READY` | Available to start |
| `IN_PROGRESS` | Partially complete |
| `WAITING` | Waiting on external process (e.g. Google indexing) |
| `BLOCKED` | Prerequisites not met |
| `COMPLETE` | Step finished |

No custom states.

## Step locking

Later steps remain locked until prerequisites are satisfied:

- **Campaign Assets / Improvements** — blocked until a campaign exists (Step 4)
- **Submit To Google / Monitor Results** — blocked until publishing complete (Step 7)

## Build mode vs Growth mode

| Mode | When | UI |
|------|------|-----|
| **BUILD** | Campaign not yet published | 9 workflow step cards with Continue / View |
| **GROWTH** | Campaign published | Growth cards: Indexed Pages, Search Visibility, Rankings, Impressions, Clicks, Recommended Improvements, Opportunities, Recent Changes |

Mode switches automatically when `publishingStatus === "published"`.

## Progress bar

**Overall Campaign Completion** is the average completion % across all 9 steps. Completed steps are highlighted in the segment bar below the main progress fill.

## Simplified terminology

| Previous label | New label |
|----------------|-----------|
| Authority Audit | Content Quality |
| Publishing Settings | Ready To Publish |
| Growth Actions | Recommended Improvements |
| Visibility | Search Visibility |
| Campaign Improvements | *(unchanged)* |

## Key files

| File | Role |
|------|------|
| `src/pharmacy/pharmacyPlatformOperatingSystemService.ts` | Workflow orchestration |
| `src/pharmacy/pharmacyPlatformDashboardService.ts` | Dashboard aggregation (includes OS) |
| `artifacts/api-server/src/routes/pharmacyPlatformDashboardPage.ts` | Platform Dashboard HTML |
| `src/pharmacy/pharmacyPlatformNav.ts` | Shared nav labels |

## Validation

```bash
pnpm pharmacy:platform:operating-system:validate
```

Report: `data/validation-reports/pharmacy-platform-operating-system-v1.json`

## Retest URL

`/api/pharmacy-dashboard?slug=pharmaconnect`

## Future extension

- Multi-campaign focus selector on Platform Dashboard (Campaign OS remains full list)
- Website analysis checklist wired to Step 2 completion %
- Operator analytics overlay (hidden from pharmacy owners)
- Webhook-driven `WAITING` state when real GSC indexing confirms
