# Area Engine Integration Spec — v1

**Project:** Local SEO Page Builder
**Status:** Ready to build
**Last updated:** 2026-04-23

---

## Overview

This spec defines how the Area Opportunity Engine (`src/area/areaEngine.ts`) connects to the cluster page generation pipeline. The integration has three stages:

1. **Select** — user runs the area engine, reviews ranked results, and picks areas
2. **Configure** — selected areas are converted into cluster config JSON files
3. **Generate** — each cluster config is passed to `deployClusterPage.ts`, with area signals injected into the AI prompt

The engine already exists and is fully functional. This spec defines the wiring layer between it and page generation.

---

## 1. UI Flow

### 1.1 Input collection

The user provides three inputs before running the engine:

| Input | Type | Example | Source |
|---|---|---|---|
| City name | string | `"Sheffield"` | CLI arg or form field |
| Service name | string | `"Web Design"` | CLI arg or form field |
| Area count | integer | `8` | CLI arg or form field (default: 10) |

These map directly to `AreaEngineInput`:

```ts
const engineInput: AreaEngineInput = {
  cityName:          "Sheffield",
  serviceName:       "Web Design",
  maxPriorityAreas:  5,
  maxSecondaryAreas: 5,
};
```

### 1.2 Ranked results display

After `runAreaEngine(input)` returns, display `output.rankedAreas` as a numbered list:

```
Rank  Area                   Score  Tier
────  ─────────────────────  ─────  ─────────
  1   Ecclesall              85     ▲ Priority
  2   Fulwood                82     ▲ Priority
  3   Sheffield City Centre  80     ▲ Priority
  4   Broomhill              70     ▲ Priority
  5   Kelham Island          67     ▲ Priority
  6   Dore                   65     ◆ Secondary
  7   Hillsborough           63     ◆ Secondary
  8   Crookes                58     ◆ Secondary
```

Include a one-line summary of each area's character (from `output.contentSignals[area].character`).

### 1.3 Area selection

The user selects which areas to generate pages for. Two modes:

**A — All priority areas (default)**
Automatically select every area in the `"priority"` tier. No confirmation needed.

**B — Manual selection**
User enters a comma-separated list of area names or rank numbers:
```
> Select areas: 1,2,4,6
Selected: Ecclesall, Fulwood, Broomhill, Dore
```

Validate that every selection exists in `output.rankedAreas`. Reject unknown names with a clear message.

### 1.4 Passing selected areas into page generation

Each selected area becomes one cluster config file and one `deployClusterPage.ts` invocation:

```
for each selected area:
  1. Build cluster config JSON  → config/clusters/<slug>.json
  2. Run deployClusterPage.ts   → generates + deploys HTML
```

Generation order follows rollout logic (Section 5).

---

## 2. Data Flow

### 2.1 Selected areas → cluster config files

Each selected area name maps to a complete cluster config JSON via four data sources:

| Config field | Source |
|---|---|
| `service` | User's service input |
| `location` | Selected area name |
| `primaryKeyword` | `"<service> <area>"` pattern |
| `supportingKeywords` | Generated from area signals (Section 3) |
| `hubUrl` | Project config `domain + "/"` |
| `hubAnchor` | `"<service> <city>"` |
| `relatedPages` | `output.relatedAreaMap[area]` joined as a string |
| `remotePath` | `"/<slugify(area)>/"` |
| `imageGroup` | `"assets/<slugify(service)>"` |
| `heroImage` | `"hero-v1.png"` (default) |

### 2.2 Area signals → content prompts

Area signals from `AreaContentSignals` are injected into the cluster prompt as a new `LOCAL_AREA_CONTEXT` block. This block is inserted after the `INPUTS:` section in `prompts/cluster-page-prompt.txt` and contains five signal fields (Section 4).

The signals do **not** replace any existing prompt fields — they supplement them. The AI uses them to localise copy without being told to.

### 2.3 Priority flags → rollout order

`AreaScore.tier` drives the order in which pages are generated and deployed:

```
priority  → generated first, deployed immediately
secondary → generated after all priority pages succeed
tertiary  → generated last, or deferred to a manual run
```

If any priority area fails (content error, FTP error), it is retried once before moving to secondary areas.

---

## 3. Generated Page Inputs

For each selected area, the following inputs are defined before any file is written.

### 3.1 Core page definition

```ts
interface SelectedAreaPageDef {
  // Identification
  area:          string;    // e.g. "Ecclesall"
  city:          string;    // e.g. "Sheffield"
  service:       string;    // e.g. "Web Design"
  tier:          AreaTier;  // "priority" | "secondary" | "tertiary"

  // SEO
  primaryKeyword:     string;   // "<service> <area>"
  supportingKeywords: string[]; // derived from area signals

  // Linking
  hubUrl:        string;   // project domain root
  hubAnchor:     string;   // "<service> <city>"
  relatedPages:  string;   // comma-separated related area labels

  // Content
  signals:       AreaContentSignals;

  // File targets
  remotePath:    string;   // "/<area-slug>/"
  configPath:    string;   // "config/clusters/<project>-<service-slug>-<area-slug>.json"
}
```

### 3.2 Primary keyword pattern

```
primaryKeyword = `${serviceName} ${areaName}`
```

Examples:
- `"Web Design Ecclesall"`
- `"Web Design Fulwood"`
- `"Web Design Sheffield City Centre"`

No other pattern is used. City name is not appended — the area name is the locality.

### 3.3 Supporting keyword generation

Supporting keywords are derived from the area signals, not from AI. Three per area:

```ts
function deriveKeywords(serviceName: string, area: string, signals: AreaContentSignals): string[] {
  const svc = serviceName.toLowerCase();
  return [
    `affordable ${svc} ${area}`,
    `${svc} for ${signals.businessType.split(" ")[0]} businesses in ${area}`,
    `professional ${svc} ${area}`,
  ];
}
```

**Example — Ecclesall:**
```json
[
  "affordable web design Ecclesall",
  "web design for service-led businesses in Ecclesall",
  "professional web design Ecclesall"
]
```

**Example — Hillsborough:**
```json
[
  "affordable web design Hillsborough",
  "web design for high businesses in Hillsborough",
  "professional web design Hillsborough"
]
```

### 3.4 Related pages (for internal linking)

```ts
const relatedPages = output.relatedAreaMap[area]
  .map((name) => `${serviceName} ${name}`)
  .join(", ");
```

Example — Ecclesall's related areas are `["Broomhill", "Nether Edge", "Dore"]`:
```
"Web Design Broomhill, Web Design Nether Edge, Web Design Dore"
```

This string is passed as `{{RELATED_PAGES}}` in the cluster prompt, which instructs the AI to generate the `relatedResources` card links pointing to those sibling pages.

---

## 4. Content Integration

Area signals are injected into the cluster prompt as a structured context block. The block is added to `generateClusterContent.ts` as an extra section appended to the prompt string.

### 4.1 Area context block format

This block is appended to the cluster prompt before it is sent to the model:

```
LOCAL AREA CONTEXT (use this to localise copy — do not repeat verbatim):

Local context    : ${signals.localContext}
Demand note      : ${signals.demandNote}
Competition note : ${signals.competitionNote}
Competitor angle : ${signals.competitorAngle}
Messaging        : ${signals.messagingRegister}
Landmarks        : ${signals.landmarks.join(", ")}
```

The `(use this to localise copy — do not repeat verbatim)` instruction prevents the model from quoting the signals directly.

### 4.2 Signal-to-prompt mapping

| Signal field | Used in | Effect on copy |
|---|---|---|
| `localContext` | `split1.body`, `split2.body` | Anchors the copy to the specific area character |
| `demandNote` | `aiSummaryIntro`, `split1.body` | Sets urgency level — high demand = more direct |
| `competitionNote` | `split1.body` | Informs how competitive the market angle should feel |
| `competitorAngle` | `split2.body`, `cta.body` | Dictates differentiation strategy |
| `messagingRegister` | All sections | Controls tone — premium vs community vs balanced |
| `landmarks` | `localRelevance.body` (hub), `split1.body` | Adds local specificity — named streets, parks, areas |

### 4.3 Integration point in generateClusterContent.ts

The `buildPrompt()` function already appends the prompt text from `cluster-page-prompt.txt`. Area signals are appended after the file content:

```ts
function buildPrompt(inputs: ClusterPageInputs, signals?: AreaContentSignals): string {
  let prompt = fs.readFileSync(promptPath, "utf8");

  // existing substitutions ...

  if (signals) {
    prompt += `\n\nLOCAL AREA CONTEXT (use this to localise copy — do not repeat verbatim):\n\n` +
      `Local context    : ${signals.localContext}\n` +
      `Demand note      : ${signals.demandNote}\n` +
      `Competition note : ${signals.competitionNote}\n` +
      `Competitor angle : ${signals.competitorAngle}\n` +
      `Messaging        : ${signals.messagingRegister}\n` +
      `Landmarks        : ${signals.landmarks.join(", ")}\n`;
  }

  return prompt;
}
```

`signals` is optional — passing `undefined` preserves full backward compatibility with the existing deploy scripts.

### 4.4 Updated ClusterPageInputs

One new optional field is added:

```ts
export interface ClusterPageInputs {
  // ... existing fields unchanged ...
  areaSignals?: AreaContentSignals; // NEW — optional
}
```

`generateClusterContent()` passes `inputs.areaSignals` into `buildPrompt()`.

---

## 5. Rollout Logic

### 5.1 Generation order

Areas are processed strictly in tier order, then by rank within each tier:

```
Stage 1 — Priority areas   (rank 1 → maxPriorityAreas)
Stage 2 — Secondary areas  (rank n+1 → maxPriorityAreas + maxSecondaryAreas)
Stage 3 — Tertiary areas   (all remaining — optional, skipped by default)
```

Stage 2 does not begin until all Stage 1 pages have been generated and deployed without error.

### 5.2 Batch generation

Areas within a stage are generated **sequentially** (not in parallel) to:
- avoid API rate limits on concurrent OpenAI calls
- allow meaningful console progress output
- prevent FTP connection conflicts

Each page logs its own result line before the next begins:

```
[1/5] Generating: Web Design Ecclesall...
  AI content generated.
  Readability refined.
  Rendered → output/inboxingproweb-local/ecclesall/index.html
  Uploaded: /ecclesall/index.html
  Live at: https://local.inboxingproweb.com/ecclesall/

[2/5] Generating: Web Design Fulwood...
```

### 5.3 Error handling

| Failure point | Behaviour |
|---|---|
| AI generation fails (invalid JSON) | Retry once, then skip area — log warning |
| Refinement fails | Continue with unrefined content — log warning |
| FTP upload fails | Retry once, then skip area — log error |
| Cluster config already exists | Overwrite without prompt (idempotent) |

After all areas are processed, a summary is printed:

```
── Rollout complete ───────────────────────
  Generated : 5 / 5
  Deployed  : 5 / 5
  Skipped   : 0
  Warnings  : 0
```

### 5.4 Deferred tertiary areas

Tertiary areas are not generated in the default run. They are written to a deferred queue file:

```
output/<client-slug>/deferred-areas.json
```

The operator can run the deferred queue manually when ready to extend coverage:

```bash
pnpm exec tsx src/generator/runDeferredAreas.ts config/projects/<project>.json
```

---

## 6. Output Examples

### 6.1 Sample selected area object

After the user selects "Ecclesall" from the ranked list, the system builds this internal object:

```json
{
  "area": "Ecclesall",
  "city": "Sheffield",
  "service": "Web Design",
  "tier": "priority",
  "primaryKeyword": "Web Design Ecclesall",
  "supportingKeywords": [
    "affordable web design Ecclesall",
    "web design for service-led businesses in Ecclesall",
    "professional web design Ecclesall"
  ],
  "hubUrl": "https://local.inboxingproweb.com/",
  "hubAnchor": "Web Design Sheffield",
  "relatedPages": "Web Design Broomhill, Web Design Nether Edge, Web Design Dore",
  "signals": {
    "area": "Ecclesall",
    "postcode": "S11",
    "city": "Sheffield",
    "character": "affluent residential suburb with a strong professional and lifestyle demographic",
    "knownFor": "Ecclesall Road's independent restaurants, boutique retailers and professional service businesses",
    "businessType": "service-led and lifestyle-focused businesses with high average transaction values",
    "landmarks": ["Ecclesall Road", "Endcliffe Park", "Hunters Bar roundabout"],
    "nearbyAreas": ["Broomhill", "Nether Edge", "Dore"],
    "affluence": "premium",
    "competitionNote": "Web Design is a competitive market in this area — differentiation through quality, trust signals and local specificity is essential.",
    "demandNote": "Search demand for Web Design in Ecclesall is high — customers are actively looking, so visibility directly translates into enquiries.",
    "localContext": "Ecclesall is an affluent residential suburb with a strong professional and lifestyle demographic in Sheffield, known for Ecclesall Road's independent restaurants, boutique retailers and professional service businesses. The area's businesses are predominantly service-led and lifestyle-focused businesses with high average transaction values.",
    "competitorAngle": "Emphasise proven results, named local clients (where permitted), response speed and a clearly defined process. Avoid generic claims.",
    "messagingRegister": "Premium register: emphasise quality, ROI, and brand credibility. Avoid discount language. Target decision-makers who value outcomes over price."
  },
  "remotePath": "/ecclesall/",
  "configPath": "config/clusters/inboxingproweb-web-design-ecclesall.json"
}
```

### 6.2 Resulting cluster config JSON

Written to `config/clusters/inboxingproweb-web-design-ecclesall.json`:

```json
{
  "service": "Web Design",
  "location": "Ecclesall",
  "primaryKeyword": "Web Design Ecclesall",
  "supportingKeywords": [
    "affordable web design Ecclesall",
    "web design for service-led businesses in Ecclesall",
    "professional web design Ecclesall"
  ],
  "hubUrl": "https://local.inboxingproweb.com/",
  "hubAnchor": "Web Design Sheffield",
  "relatedPages": "Web Design Broomhill, Web Design Nether Edge, Web Design Dore",
  "remotePath": "/ecclesall/",
  "imageGroup": "assets/web-design",
  "heroImage": "hero-v1.png"
}
```

This file is already the format accepted by `deployClusterPage.ts` — no changes to the deploy script are needed for the config format.

### 6.3 Resulting area context block (appended to prompt)

```
LOCAL AREA CONTEXT (use this to localise copy — do not repeat verbatim):

Local context    : Ecclesall is an affluent residential suburb with a strong professional and lifestyle demographic in Sheffield, known for Ecclesall Road's independent restaurants, boutique retailers and professional service businesses. The area's businesses are predominantly service-led and lifestyle-focused businesses with high average transaction values.
Demand note      : Search demand for Web Design in Ecclesall is high — customers are actively looking, so visibility directly translates into enquiries.
Competition note : Web Design is a competitive market in this area — differentiation through quality, trust signals and local specificity is essential.
Competitor angle : Emphasise proven results, named local clients (where permitted), response speed and a clearly defined process. Avoid generic claims.
Messaging        : Premium register: emphasise quality, ROI, and brand credibility. Avoid discount language. Target decision-makers who value outcomes over price.
Landmarks        : Ecclesall Road, Endcliffe Park, Hunters Bar roundabout
```

### 6.4 Sample for a secondary area — Hillsborough

```json
{
  "area": "Hillsborough",
  "city": "Sheffield",
  "service": "Web Design",
  "tier": "secondary",
  "primaryKeyword": "Web Design Hillsborough",
  "supportingKeywords": [
    "affordable web design Hillsborough",
    "web design for high street businesses in Hillsborough",
    "professional web design Hillsborough"
  ],
  "hubUrl": "https://local.inboxingproweb.com/",
  "hubAnchor": "Web Design Sheffield",
  "relatedPages": "Web Design Walkley, Web Design Crookes, Web Design Chapeltown",
  "remotePath": "/hillsborough/",
  "configPath": "config/clusters/inboxingproweb-web-design-hillsborough.json"
}
```

Corresponding context block:

```
LOCAL AREA CONTEXT (use this to localise copy — do not repeat verbatim):

Local context    : Hillsborough is an established community area in the north of the city with a strong local high street in Sheffield, known for local retail, trades businesses and family-run services with deep community loyalty. The area's businesses are predominantly high street and service-based businesses serving a broad local population.
Demand note      : Search demand for Web Design in Hillsborough is consistent — steady local interest makes this a reliable target for organic lead generation.
Competition note : Web Design has relatively few established competitors in this area — a strong first-mover presence can capture significant organic traffic.
Competitor angle : Position as the established local specialist. Build authority through content depth and local signals before competitors arrive.
Messaging        : Balanced register: quality and value in equal measure. Acknowledge cost sensitivity without underselling the service.
Landmarks        : Hillsborough Barracks Retail Park, Hillsborough Park, Don Valley corridor
```

---

## 7. New Files to Build

| File | Purpose |
|---|---|
| `src/generator/selectAreas.ts` | CLI tool — runs engine, shows ranked list, collects selection |
| `src/generator/buildClusterConfigs.ts` | Converts selected area objects into cluster config JSON files |
| `src/generator/runAreaRollout.ts` | Orchestrates sequential generation for all selected areas |
| `src/generator/runDeferredAreas.ts` | Processes the deferred tertiary area queue |

### 7.1 selectAreas.ts interface

```
Usage:
  pnpm exec tsx src/generator/selectAreas.ts \
    --city Sheffield \
    --service "Web Design" \
    --project config/projects/inboxingproweb-local.json \
    [--areas 8] \
    [--auto]          # selects all priority areas without prompt

Output:
  Writes selected area objects to: output/<clientSlug>/selected-areas.json
```

### 7.2 runAreaRollout.ts interface

```
Usage:
  pnpm exec tsx src/generator/runAreaRollout.ts \
    config/projects/inboxingproweb-local.json \
    output/inboxingproweb-local/selected-areas.json \
    [--include-secondary]   # also generates secondary tier
    [--dry-run]             # writes configs only, no AI or FTP

Output:
  - Cluster config JSON files in config/clusters/
  - Rendered HTML in output/<clientSlug>/<area-slug>/
  - Deferred queue at output/<clientSlug>/deferred-areas.json
  - Rollout log at output/<clientSlug>/rollout-log.json
```

### 7.3 Rollout log format

```json
{
  "startedAt": "2026-04-23T10:00:00Z",
  "completedAt": "2026-04-23T10:12:44Z",
  "project": "inboxingproweb-local",
  "city": "Sheffield",
  "service": "Web Design",
  "results": [
    {
      "area": "Ecclesall",
      "tier": "priority",
      "status": "deployed",
      "liveUrl": "https://local.inboxingproweb.com/ecclesall/",
      "durationMs": 14200
    },
    {
      "area": "Fulwood",
      "tier": "priority",
      "status": "deployed",
      "liveUrl": "https://local.inboxingproweb.com/fulwood/",
      "durationMs": 13800
    }
  ],
  "deferred": ["Woodseats", "Chapeltown", "Walkley"]
}
```

---

## 8. Required Changes to Existing Files

| File | Change |
|---|---|
| `src/generator/generateClusterContent.ts` | Add optional `areaSignals?: AreaContentSignals` to `ClusterPageInputs`; update `buildPrompt()` to append area context block when signals are present |
| `prompts/cluster-page-prompt.txt` | No changes — context is appended dynamically, not hardcoded |
| `src/generator/deployClusterPage.ts` | No changes — `buildClusterConfigs.ts` produces configs in the existing format |
| `config/clusters/*.json` | New files generated automatically — existing files unchanged |

---

## 9. Implementation Order

Build in this sequence to keep each step testable independently:

1. Add `areaSignals?` to `ClusterPageInputs` and update `buildPrompt()` — verify with existing Ecclesall cluster
2. Build `buildClusterConfigs.ts` — test by generating configs for 3 areas and diffing against expected output
3. Build `selectAreas.ts` — test with `--auto` flag, check output JSON
4. Build `runAreaRollout.ts` with `--dry-run` — verify config files and rollout order
5. Run a full live rollout against one priority area end to end
6. Build `runDeferredAreas.ts` last
