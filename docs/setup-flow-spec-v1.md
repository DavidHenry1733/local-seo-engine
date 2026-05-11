# Setup Flow Spec v1 — Local SEO Page Builder

**Status:** Draft v1  
**Date:** 2026-04-23  
**Scope:** End-to-end user setup flow from initial business inputs to ready-to-deploy page generation.

---

## Contents

1. [Overview](#1-overview)
2. [Stage 1 — Business Setup](#2-stage-1--business-setup)
3. [Stage 2 — Campaign Setup](#3-stage-2--campaign-setup)
4. [Stage 3 — Area Opportunity](#4-stage-3--area-opportunity)
5. [Stage 4 — Keyword Configuration](#5-stage-4--keyword-configuration)
6. [Stage 5 — Generation](#6-stage-5--generation)
7. [Stage 6 — Validation](#7-stage-6--validation)
8. [Stage 7 — Output](#8-stage-7--output)
9. [Data Flow Between Stages](#9-data-flow-between-stages)
10. [Recommended UI Layout](#10-recommended-ui-layout)
11. [Implementation Notes for Replit Build](#11-implementation-notes-for-replit-build)

---

## 1. Overview

The setup flow is a **seven-stage wizard** that produces three types of artefact:

| Artefact | Location | Consumed by |
|---|---|---|
| Project config JSON | `config/projects/<slug>.json` | All generators |
| Cluster config JSON(s) | `config/clusters/<slug>-<svc>-<area>.json` | `deployClusterPage.ts` |
| Rollout log + deferred queue | `output/<slug>/` | `runAreaRollout.ts`, `runDeferredAreas.ts` |

Each stage has a clear **input**, **action**, and **output**. Stages are sequential; the output of each stage is the validated input to the next. No stage performs irreversible operations (AI or FTP) until Stage 5, which requires explicit user confirmation.

```
Stage 1  Business Setup
  ↓  ProjectConfig (partial)
Stage 2  Campaign Setup
  ↓  ProjectConfig (complete) + CampaignInput
Stage 3  Area Opportunity
  ↓  AreaEngineOutput + SelectedAreaPageDef[]
Stage 4  Keyword Configuration
  ↓  SelectedAreaPageDef[] (with confirmed keywords)
Stage 5  Generation
  ↓  RolloutLog + ClusterConfigEnriched files
Stage 6  Validation
  ↓  QA report + content score + readiness summary
Stage 7  Output
  ↓  Generated HTML files + deferred queue + final log
```

---

## 2. Stage 1 — Business Setup

### 2.1 Purpose

Capture or load the business profile that anchors every page in the campaign. The result is written to `config/projects/<clientSlug>.json` and must satisfy the `ProjectConfig` + `RenderProjectConfig` types.

### 2.2 Inputs

The user provides or selects:

| Field | Type | Notes |
|---|---|---|
| Business name | string | Used in `<title>`, hero, schema |
| Legal / registered name | string | Footer only — e.g. "DHM Digital Limited" |
| Company number | string | Optional — displayed in footer |
| Client slug | string | URL-safe — becomes the directory key, e.g. `inboxingproweb-local` |
| Domain | string | Full URL with protocol, e.g. `https://local.inboxingproweb.com` |
| Phone | string | Used in schema and footer |
| Email | string | Used in footer |
| Business address | string | Comma-separated — used in map embed and schema |
| Primary CTA text | string | e.g. "Request a Quote" |
| Primary CTA URL | string | e.g. `https://inboxingproweb.com/contact/` |
| Logo URL | string | Absolute URL to hosted image |
| Privacy URL | string | Default `/privacy-policy/` |
| Terms URL | string | Default `/terms/` |
| Primary brand colour | hex | e.g. `#005EB8` |
| Accent colour | hex | e.g. `#1CA9C9` |
| Nav items | `{ label, href }[]` | Up to 6 links |
| FTP host | string | For deployment |
| FTP port | number | Default 21 |
| FTP remote root | string | Default `/` |

### 2.3 Actions

- **Load existing**: Select from `config/projects/*.json` — pre-fills all fields.
- **Create new**: Enter all fields in the form. Validate before proceeding:
  - `clientSlug` must be URL-safe (matches `/^[a-z0-9-]+$/`)
  - `domain` must start with `https://`
  - At least one nav item required

### 2.4 Output

**Written file:** `config/projects/<clientSlug>.json`

```json
{
  "clientSlug": "inboxingproweb-local",
  "businessName": "InboxingProWeb",
  "domain": "https://local.inboxingproweb.com",
  "phone": "0114 000 0000",
  "email": "info@inboxingproweb.com",
  "primaryCtaText": "Request a Quote",
  "primaryCtaUrl": "https://inboxingproweb.com/contact/",
  "businessAddress": "Moorgate Crofts Business Centre, South Grove, Rotherham, S60 2DH",
  "logoUrl": "https://inboxingproweb.com/logo.png",
  "privacyUrl": "https://inboxingproweb.com/privacy-policy/",
  "termsUrl": "https://inboxingproweb.com/terms/",
  "footerCompanyName": "DHM Digital Limited",
  "footerCompanyNumber": "16953956",
  "navItems": [ ... ],
  "branding": { "primaryColor": "#005EB8", "accentColor": "#1CA9C9" },
  "services": [],
  "locations": [],
  "deploy": {
    "enabled": true,
    "protocol": "ftp",
    "host": "ftp.example.com",
    "port": 21,
    "remoteRoot": "/"
  }
}
```

**Passed to Stage 2:** `clientSlug`, `businessName`, `domain`, full `RenderProjectConfig`

---

## 3. Stage 2 — Campaign Setup

### 3.1 Purpose

Define the scope of this generation campaign: which city, which service, and how many areas to target.

### 3.2 Inputs

| Field | Type | Notes |
|---|---|---|
| City | string | Must match a `city` field in a loaded `areaData/*.json` file, e.g. "Sheffield" |
| Service name | string | Free text — appears in keyword and page title patterns, e.g. "Web Design" |
| Service key | `ServiceKey` | Maps to `ProjectConfig.services[].key`, e.g. `"web_design"` |
| Max priority areas | number | Default 5 — areas assigned to Stage 1 of the rollout |
| Max secondary areas | number | Default 4 — areas assigned to Stage 2 |
| Include secondary in this run | boolean | Default false — secondary areas deferred unless checked |
| Hub page URL | string | Auto-derived: `{domain}/` — editable |

### 3.3 Actions

- Validate that the city matches a bundled `areaData/*.json` file (check `src/area/areaData/`).
- Append the selected service to `ProjectConfig.services[]`.
- Derive `hubUrl` from `domain` + `/`.
- Store `maxPriorityAreas` and `maxSecondaryAreas` as `AreaEngineInput` ready for Stage 3.

### 3.4 Output

**In-memory:** `CampaignInput`

```ts
interface CampaignInput {
  cityName:          string;        // "Sheffield"
  serviceName:       string;        // "Web Design"
  serviceKey:        ServiceKey;    // "web_design"
  maxPriorityAreas:  number;        // 5
  maxSecondaryAreas: number;        // 4
  includeSecondary:  boolean;       // false
  hubUrl:            string;        // "https://local.inboxingproweb.com/"
}
```

**Updated file:** `config/projects/<clientSlug>.json` (services array updated)

**Passed to Stage 3:** `CampaignInput` → `AreaEngineInput`

---

## 4. Stage 3 — Area Opportunity

### 4.1 Purpose

Run the area intelligence engine, display the ranked list with scores and tiers, and let the user select which areas to include in this campaign.

### 4.2 Action: Run area engine

```ts
// src/area/areaEngine.ts
const engineOutput: AreaEngineOutput = runAreaEngine({
  cityName:          campaign.cityName,
  serviceName:       campaign.serviceName,
  maxPriorityAreas:  campaign.maxPriorityAreas,
  maxSecondaryAreas: campaign.maxSecondaryAreas,
});
```

`AreaEngineOutput` contains:
- `rankedAreas: AreaScore[]` — all areas sorted by composite score (0–100)
- `contentSignals: Record<string, AreaContentSignals>` — AI prompt signals per area
- `relatedAreaMap: Record<string, string[]>` — internal linking map
- `coverageReport: AreaCoverageReport` — gap analysis

### 4.3 Scoring system (read-only display)

| Component | Weight | Source field |
|---|---|---|
| Search demand | 30 pts | `searchDemand` (high=30, medium=20, low=10) |
| Competition | 20 pts | `competition` (low=20, medium=12, high=5) |
| Affluence | 25 pts | `affluenceTier` (premium=25, professional=20, mixed=12, community=8) |
| Priority override | 25 pts | `priority` (rank 1=25, rank 2=22, ...) |

### 4.4 Ranked area display

Show a table with one row per area:

| Rank | Area | Score | Tier | Postcode | Demand | Competition | Affluence | Select |
|---|---|---|---|---|---|---|---|---|
| 1 | Ecclesall | 85 | priority | S11 | high | high | premium | ✓ |
| 2 | Fulwood | 82 | priority | S10 | high | low | professional | ✓ |
| ... | | | | | | | | |

Colour-code tiers: priority = green, secondary = amber, tertiary = grey.

### 4.5 Selection modes

**Auto (priority only):** Pre-select all areas with `tier === "priority"`. Recommended default.

**Manual:** The user ticks individual rows or types area names/rank numbers into a text input (e.g. `1,3,7` or `Ecclesall, Broomhill, Hillsborough`).

**Validation rules:**
- Minimum 1 area must be selected.
- If an area not in the ranked list is typed, show an error — do not allow unknown areas.

### 4.6 Output

**In-memory:** `SelectedAreaPageDef[]` built via:

```ts
// src/generator/buildClusterConfigs.ts
const defs: SelectedAreaPageDef[] = buildAllSelectedAreaDefs(
  selectedAreaNames,
  engineOutput,
  project.domain,
  project.clientSlug
);
```

Each `SelectedAreaPageDef` contains:
- `area`, `city`, `service`, `tier`
- `primaryKeyword` — `"<service> <area>"` (no parent city)
- `supportingKeywords` — three deterministic keywords (no AI)
- `hubUrl`, `hubAnchor`, `relatedPages`
- `signals: AreaContentSignals` — full prompt context
- `remotePath`, `configPath`

**Written file:** `output/<clientSlug>/selected-areas.json`

```json
[
  { "area": "Ecclesall", "tier": "priority", "primaryKeyword": "Web Design Ecclesall", ... },
  { "area": "Hillsborough", "tier": "secondary", "primaryKeyword": "Web Design Hillsborough", ... }
]
```

**Passed to Stage 4:** `SelectedAreaPageDef[]`

---

## 5. Stage 4 — Keyword Configuration

### 5.1 Purpose

Review and optionally customise the keyword inputs for each selected area before any content is generated. All defaults are pre-filled deterministically — no AI call is made in this stage.

### 5.2 Display: per-area keyword panel

For each `SelectedAreaPageDef`, show an editable card:

```
┌──────────────────────────────────────────────────────────────┐
│  Ecclesall  ·  priority  ·  score 85                         │
├──────────────────────────────────────────────────────────────┤
│  Focus keyword (H1 / title tag)                              │
│  [Web Design Ecclesall                                     ]  │
│                                                              │
│  Supporting keywords (comma-separated)                       │
│  [affordable web design Ecclesall, web design for            │
│   service-led businesses in Ecclesall, professional          │
│   web design Ecclesall                                     ]  │
│                                                              │
│  [Suggest more keywords ↗]  (future: calls keyword API)     │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Focus keyword rules

- Pre-filled as `"<service> <area>"` — e.g. `"Web Design Ecclesall"`.
- The parent city must **not** be appended (spec rule — see `buildClusterConfigs.ts` Section 3.2).
- User may edit — warn if city name is appended: *"Including the parent city in cluster keywords reduces topical focus. Are you sure?"*
- Minimum 2 words required.

### 5.4 Supporting keyword derivation

Defaults are generated by `deriveKeywords()` in `src/generator/buildClusterConfigs.ts`:

```ts
[
  `affordable ${svc} ${area}`,                               // e.g. "affordable web design Ecclesall"
  `${svc} for ${modifier} businesses in ${area}`,            // uses keywordModifier if set in area data
  `professional ${svc} ${area}`,                             // e.g. "professional web design Ecclesall"
]
```

Users may:
- Edit any of the three defaults.
- Add a fourth keyword (cap at 5 total to avoid prompt bloat).
- Remove a keyword (minimum 1 required).

### 5.5 Suggested keywords (optional feature)

A "Suggest more keywords" button calls a future `suggestKeywords()` helper that queries the AI with the area signals and returns 5 long-tail alternatives. The user then cherry-picks. This is not implemented in v1 — the button should be visible but labelled "Coming soon."

### 5.6 Bulk edit mode

A toggle allows the user to paste a raw CSV of area + keyword overrides:

```
area,focusKeyword,supportingKeywords
Ecclesall,Web Design Ecclesall,"affordable web design Ecclesall,professional web design Ecclesall"
Hillsborough,Web Design Hillsborough,affordable web design Hillsborough
```

### 5.7 Output

**In-memory:** Updated `SelectedAreaPageDef[]` with confirmed (possibly user-edited) keywords.

If any keyword was changed from the default, the `def` is marked `keywordsCustomised: true` so the rollout log can record it.

**Passed to Stage 5:** Confirmed `SelectedAreaPageDef[]`

---

## 6. Stage 5 — Generation

### 6.1 Purpose

Write cluster config files, show the planned rollout order, offer a dry run for verification, and — on explicit user confirmation — run the full AI + FTP pipeline.

### 6.2 Pre-generation: write configs

Before any AI call, all cluster configs are written to disk:

```ts
for (const def of defs) {
  const config = buildClusterConfig(def);          // buildClusterConfigs.ts
  writeClusterConfig(def, config);                 // writes config/clusters/*.json
}
```

This is always done first, in all modes, so configs can be inspected before committing to generation.

### 6.3 Rollout order preview

Display the planned generation sequence:

```
── Rollout order ─────────────────────────────────────
  Stage 1 — Priority (3 areas)
    [1] Web Design Ecclesall      /ecclesall/
    [2] Web Design Fulwood        /fulwood/
    [3] Web Design Broomhill      /broomhill/

  Stage 2 — Secondary (2 areas)  [included]
    [4] Web Design Hillsborough   /hillsborough/
    [5] Web Design Dore           /dore/

  Deferred — Tertiary (4 areas)
    Woodseats, Chapeltown, Walkley, Nether Edge
    → will be written to deferred-areas.json

  Mode: [Dry Run ○]  [Live Generation ●]
  [Run Rollout →]
```

### 6.4 Dry run mode

When `dryRun: true`:
- Config files are written (already done in 6.2).
- AI and FTP are skipped.
- The rollout log is written with `status: "success"` for all processed areas (config-only).
- Console output shows `[dry-run]` tag on each area line.

Use dry run to verify:
- Config JSON correctness (keyword, remotePath, imageGroup)
- Rollout order
- Deferred queue content

### 6.5 Live generation mode

When `dryRun: false`, for each area in the active stages:

```
Step 1  Write cluster config   buildClusterConfig() + writeClusterConfig()
Step 2  Generate AI content    generateClusterContent(inputs with areaSignals)
Step 3  Refine readability     refineClusterContent(rawAi)  [non-fatal on fail]
Step 4  Render HTML            renderClusterHtml({ project, cluster, ai })
Step 5  Write output file      output/<slug>/<area>/index.html
Step 6  FTP upload             basic-ftp → remote server
```

One retry is attempted on any failure at Steps 2 or 6.  
Refinement failure at Step 3 is non-fatal — the run continues with unrefined content.

### 6.6 Progress display (live)

```
[1/5] Web Design Ecclesall  (priority)
  ✓ Config written
  ✓ AI content generated  (4.2s)
  ✓ Readability refined
  ✓ Rendered → output/inboxingproweb-local/ecclesall/index.html  (42,180 bytes)
  ✓ Uploaded: /ecclesall/index.html
  ✓ Live at: https://local.inboxingproweb.com/ecclesall/
  Done in 14.3s

[2/5] Web Design Fulwood  (priority)
  ...
```

### 6.7 Orchestration

```ts
// src/generator/rolloutRunner.ts
const log: RolloutLog = await runAreaRollout(defs, project, {
  includeSecondary: campaign.includeSecondary,
  dryRun:           userSelectedDryRun,
  deferTertiary:    true,
});
```

### 6.8 Output

| File | Path |
|---|---|
| Cluster configs | `config/clusters/<slug>-<svc>-<area>.json` |
| Rendered HTML | `output/<slug>/<area>/index.html` |
| Rollout log | `output/<slug>/rollout-log.json` |
| Deferred queue | `output/<slug>/deferred-areas.json` |

**Passed to Stage 6:** `RolloutLog` + list of successfully generated output HTML paths

---

## 7. Stage 6 — Validation

### 7.1 Purpose

Run QA validation and content scoring against each generated page to confirm quality before the campaign is considered complete.

### 7.2 QA validator

**Endpoint:** `POST /api/validate` (existing `validatePage` API)  
**Input:** `{ id: "<clientSlug>-<areaSlug>" }` or raw HTML string  
**Output:** Pass/fail per check category

QA checks performed:

| Category | Checks |
|---|---|
| Structure | H1 present and unique, meta title ≤ 60 chars, meta description ≤ 155 chars |
| Keywords | H1 contains primary keyword, keyword in first 100 words |
| Links | Hub link present with correct anchor text, 2+ internal links, no broken hrefs |
| Schema | WebPage and Service schema present and valid JSON-LD |
| Content | Word count ≥ 600, ≥ 3 FAQ items, trust strip populated |
| Local signals | Area name mentioned ≥ 3×, at least 1 landmark referenced |

### 7.3 Content scoring

**Module:** `src/generator/` content scoring engine  
**Output:** Score per category (0–100) + overall weighted score

| Category | Weight |
|---|---|
| Keyword optimisation | 20% |
| Content depth | 20% |
| Local relevance | 20% |
| Internal linking | 15% |
| Technical SEO | 15% |
| Conversion elements | 10% |

**Minimum thresholds for rollout readiness:**

| Threshold | Meaning |
|---|---|
| Overall ≥ 75 | Page is ready to deploy |
| Overall 60–74 | Marginal — flag for manual review |
| Overall < 60 | Block deployment — regenerate required |

### 7.4 Validation output display

```
── Validation Report ─────────────────────────────────────────
  Pages validated: 5

  Ecclesall          Overall: 86%  ✓ Ready
    Keyword optimisation : 90
    Content depth        : 85
    Local relevance      : 88
    Internal linking     : 80
    Technical SEO        : 88
    Conversion elements  : 82

  Hillsborough       Overall: 81%  ✓ Ready
    ...

  Fulwood            Overall: 72%  ⚠ Review recommended
    Content depth        : 65  ← below threshold

── Rollout Readiness ─────────────────────────────────────────
  Ready      : 4 / 5
  Review     : 1 / 5  (Fulwood)
  Blocked    : 0 / 5
  Deferred   : 4 (tertiary queue)

  Action:
    [Deploy ready pages now →]
    [Regenerate Fulwood →]
    [Skip Fulwood and deploy remaining →]
```

### 7.5 Output

**In-memory:** `ValidationSummary`

```ts
interface PageValidationResult {
  area:         string;
  overallScore: number;
  readiness:    "ready" | "review" | "blocked";
  categories:   Record<string, number>;
  qaIssues:     string[];
}

interface ValidationSummary {
  ready:    PageValidationResult[];
  review:   PageValidationResult[];
  blocked:  PageValidationResult[];
  deferred: string[];            // area names in the deferred queue
}
```

**Passed to Stage 7:** `ValidationSummary` + final `RolloutLog`

---

## 8. Stage 7 — Output

### 8.1 Purpose

Present all generated artefacts, confirm what was deployed, and provide clear paths for what happens next (deferred areas, failed areas, monitoring).

### 8.2 File summary panel

```
── Generated files ────────────────────────────────────────────
  config/clusters/
    inboxingproweb-local-web-design-ecclesall.json        ✓
    inboxingproweb-local-web-design-fulwood.json          ✓
    inboxingproweb-local-web-design-hillsborough.json     ✓

  output/inboxingproweb-local/
    ecclesall/index.html        42,180 bytes   Live ✓
    fulwood/index.html          41,920 bytes   Live ✓
    hillsborough/index.html     41,650 bytes   Live ✓
    deferred-areas.json         4 areas queued
    rollout-log.json            run ad40b1fc

── Deferred queue ─────────────────────────────────────────────
  Woodseats  ·  Chapeltown  ·  Walkley  ·  Nether Edge
  Run deferred areas:
    pnpm exec tsx src/generator/runDeferredAreas.ts \
      config/projects/inboxingproweb-local.json

── Rollout log ────────────────────────────────────────────────
  Run ID     : ad40b1fc-8b16-4166-9a00-2f4a18bef16a
  Started    : 2026-04-23T10:00:00Z
  Finished   : 2026-04-23T10:12:44Z
  Generated  : 3 / 3
  Failed     : 0
  Deferred   : 4
```

### 8.3 Live URL verification

For each deployed page, show a clickable link and a status indicator:

| Page | URL | Status |
|---|---|---|
| Web Design Ecclesall | `https://local.inboxingproweb.com/ecclesall/` | ✓ Live |
| Web Design Fulwood | `https://local.inboxingproweb.com/fulwood/` | ✓ Live |

### 8.4 Next actions

Present four clearly labelled next-action buttons:

1. **Run deferred areas** → launches `runDeferredAreas.ts` for the tertiary queue
2. **Add another campaign** → returns to Stage 2 with the same business profile
3. **Regenerate failed pages** → re-queues any `status: "failed"` entries through Stage 5
4. **Export project** → runs `exportProject.ts` to produce a zip of all output files

---

## 9. Data Flow Between Stages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 1 — Business Setup                                                   │
│  Input:  User form / existing JSON                                          │
│  Output: config/projects/<slug>.json  →  RenderProjectConfig                │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ RenderProjectConfig
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 2 — Campaign Setup                                                   │
│  Input:  city, service, area counts, includeSecondary                       │
│  Output: CampaignInput  →  AreaEngineInput                                  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ AreaEngineInput
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 3 — Area Opportunity                                                 │
│  Action: runAreaEngine(input)                                                │
│  Input:  AreaEngineInput                                                    │
│  Output: AreaEngineOutput  +  SelectedAreaPageDef[]                         │
│          output/<slug>/selected-areas.json                                  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ SelectedAreaPageDef[] (with signals)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 4 — Keyword Configuration                                            │
│  Input:  SelectedAreaPageDef[] (auto-derived keywords)                      │
│  Action: User edits keywords in UI; deriveKeywords() provides defaults      │
│  Output: SelectedAreaPageDef[] (with confirmed keywords)                    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ Confirmed SelectedAreaPageDef[]
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 5 — Generation                                                       │
│  Input:  SelectedAreaPageDef[], RenderProjectConfig, RolloutOptions         │
│  Action: runAreaRollout() → sequential AI + refine + render + FTP           │
│  Output: RolloutLog                                                         │
│          config/clusters/*.json                                             │
│          output/<slug>/<area>/index.html                                    │
│          output/<slug>/rollout-log.json                                     │
│          output/<slug>/deferred-areas.json                                  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ RolloutLog + output HTML paths
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 6 — Validation                                                       │
│  Input:  Generated HTML paths from RolloutLog.entries                       │
│  Action: POST /api/validate per page + content scoring engine               │
│  Output: ValidationSummary (ready / review / blocked per page)              │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ ValidationSummary + RolloutLog
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 7 — Output                                                           │
│  Input:  ValidationSummary, RolloutLog, deferred queue                     │
│  Action: Display file summary, live URLs, next-action buttons               │
│  Output: User-facing summary + deferred queue run path                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.1 Shared state object

All stages read and write to a single `SetupSession` object held in memory (or in a lightweight session file at `output/<slug>/session.json`):

```ts
interface SetupSession {
  stage:          1 | 2 | 3 | 4 | 5 | 6 | 7;
  projectPath:    string;              // config/projects/<slug>.json
  project:        RenderProjectConfig;
  campaign?:      CampaignInput;
  engineOutput?:  AreaEngineOutput;
  selectedDefs?:  SelectedAreaPageDef[];
  rolloutOptions?: RolloutOptions;
  rolloutLog?:    RolloutLog;
  validation?:    ValidationSummary;
}
```

Stage transitions must validate that the required fields from the previous stage are present before advancing.

---

## 10. Recommended UI Layout

### 10.1 Shell structure

The setup flow runs as a **multi-step wizard** inside the existing API server (`artifacts/api-server`). Each stage occupies a full-screen step view. A persistent progress bar at the top shows the current stage.

```
┌────────────────────────────────────────────────────────────────────┐
│  [●]──[●]──[●]──[○]──[○]──[○]──[○]                               │
│   1    2    3    4    5    6    7       ← stage progress           │
│                                                                    │
│  ← Back    Stage 3 — Area Opportunity                 Next →       │
│                                                                    │
│  [Main content area — changes per stage]                           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 10.2 Stage-specific layout

**Stage 1 — Business Setup**
- Left column: Form with grouped sections (Identity / Contact / Branding / Deploy)
- Right column: Live JSON preview of the `ProjectConfig` being built
- Action: "Save and continue →"

**Stage 2 — Campaign Setup**
- Compact form: city autocomplete (from available `areaData/*.json` cities), service dropdown, area count sliders
- Below form: derived `hubUrl` and `hubAnchor` previews
- Action: "Check area availability →"

**Stage 3 — Area Opportunity**
- Full-width ranked area table with tier colour bands
- Above table: engine summary card (total areas, priority count, top score)
- Below table: selection toolbar (Auto-select priority / Clear / Manual input box)
- Action: "Confirm selection →"

**Stage 4 — Keyword Configuration**
- One collapsible card per selected area (priority areas expanded by default)
- Each card: focus keyword input + supporting keyword tag editor
- Global toggle: "Bulk edit (CSV)"
- Action: "Confirm keywords →"

**Stage 5 — Generation**
- Left panel: rollout order list (all areas, colour-coded by tier)
- Right panel: mode selector (Dry Run / Live) + options (include secondary checkbox)
- On run: replace right panel with live scrolling progress log
- Action: "Run Rollout →" (requires explicit click — not auto-triggered)

**Stage 6 — Validation**
- Table: one row per generated page with score bar and readiness badge
- Expandable rows: per-category breakdown + QA issue list
- Below table: Rollout Readiness summary card with action buttons
- Action: "View output →" / "Regenerate [area] →"

**Stage 7 — Output**
- Three columns: Generated Files | Deployed URLs | Next Actions
- Deferred queue section with copy-ready CLI command
- Log download button (downloads `rollout-log.json`)
- Action buttons: Run Deferred / New Campaign / Export

### 10.3 Navigation rules

| Rule | Detail |
|---|---|
| Forward | Only enabled when the current stage has valid output |
| Back | Always enabled — returns to previous stage without re-running |
| Jump | Disabled after Stage 5 begins (prevents state corruption during live run) |
| Refresh | Session state persists in `output/<slug>/session.json` — wizard resumes from last completed stage |

---

## 11. Implementation Notes for Replit Build

### 11.1 API routes to add

All setup flow state mutations go through the API server (`artifacts/api-server`). New routes needed:

| Method | Route | Handler action |
|---|---|---|
| `GET` | `/api/projects` | List all `config/projects/*.json` |
| `POST` | `/api/projects` | Write new project config to disk |
| `GET` | `/api/area-engine` | `?city=Sheffield&service=Web+Design&maxP=5&maxS=4` → returns `AreaEngineOutput` |
| `POST` | `/api/selected-areas` | Accepts area names array, returns `SelectedAreaPageDef[]`, writes `selected-areas.json` |
| `POST` | `/api/rollout` | Accepts `{ defs, projectPath, options }`, runs `runAreaRollout()`, streams progress via SSE |
| `GET` | `/api/validate/:slug` | Runs QA + scoring against `output/<slug>/`, returns `ValidationSummary` |
| `GET` | `/api/session/:slug` | Returns current `SetupSession` for resuming |

### 11.2 Progress streaming

Stage 5 (generation) must stream progress to the UI in real time. Use **Server-Sent Events (SSE)**:

```ts
// Server
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");

// Emit on each area completion
res.write(`data: ${JSON.stringify({ area: "Ecclesall", status: "success", durationMs: 14200 })}\n\n`);

// Emit on completion
res.write(`data: ${JSON.stringify({ done: true, log })}\n\n`);
res.end();
```

```ts
// Client
const es = new EventSource("/api/rollout");
es.onmessage = (e) => {
  const update = JSON.parse(e.data);
  if (update.done) { es.close(); advance to Stage 6; }
  else { appendProgressLine(update); }
};
```

### 11.3 Session persistence

Write `SetupSession` to disk after each stage transition:

```ts
// Lightweight helper — no database needed
fs.writeFileSync(
  `output/${clientSlug}/session.json`,
  JSON.stringify(session, null, 2)
);
```

On page load, check for an existing session file and offer "Resume last session" if found.

### 11.4 Module mapping

| Stage | Modules called |
|---|---|
| 1 | Read/write `config/projects/*.json`, validate `RenderProjectConfig` |
| 2 | Validate city against `src/area/areaData/`, update `ProjectConfig.services` |
| 3 | `src/area/areaEngine.ts → runAreaEngine()`, `src/generator/buildClusterConfigs.ts → buildAllSelectedAreaDefs()` |
| 4 | `src/generator/buildClusterConfigs.ts → deriveKeywords()` (read-only; user edits applied in memory) |
| 5 | `src/generator/rolloutRunner.ts → runAreaRollout()`, `src/generator/buildClusterConfigs.ts → buildClusterConfig() + writeClusterConfig()` |
| 6 | `POST /api/validate` (existing), content scoring engine |
| 7 | Read `output/<slug>/rollout-log.json`, `output/<slug>/deferred-areas.json` |

### 11.5 Build order

Build in this sequence to keep each step independently testable:

```
1. GET /api/projects + POST /api/projects  (Stage 1 — no dependencies)
2. GET /api/area-engine                     (Stage 3 — calls runAreaEngine)
3. POST /api/selected-areas                 (Stage 3 → 4 — calls buildAllSelectedAreaDefs)
4. POST /api/rollout with SSE streaming     (Stage 5 — calls runAreaRollout)
5. GET /api/validate/:slug                  (Stage 6 — calls existing validate API)
6. GET /api/session/:slug + persistence     (session resume — last)
7. Frontend wizard shell + stage views      (after all API routes confirmed)
```

### 11.6 Environment variables required

| Variable | Purpose |
|---|---|
| `DEPLOY_USERNAME` | FTP username — already set |
| `DEPLOY_PASSWORD` | FTP password — already set |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI proxy base URL — already set |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI proxy key — already set |
| `SESSION_SECRET` | Express session signing — already set |

No new secrets are required for the setup flow.

### 11.7 File outputs summary

```
config/
  projects/
    <slug>.json                         ← Stage 1
  clusters/
    <slug>-<svc>-<area>.json            ← Stage 5 (one per area)

output/
  <slug>/
    selected-areas.json                 ← Stage 3
    session.json                        ← written after each stage
    rollout-log.json                    ← Stage 5
    deferred-areas.json                 ← Stage 5 (when tertiary present)
    <area>/
      index.html                        ← Stage 5 (one per area)
```

---

*End of Setup Flow Spec v1*
