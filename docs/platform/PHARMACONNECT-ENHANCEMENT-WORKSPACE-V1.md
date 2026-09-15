# PharmaConnect Enhancement Workspace V1

Converts the Authority Enhancement Engine from a recommendation system into an **operational workspace**. Every recommendation becomes an actionable task with a primary action link, status tracking, and platform refresh on completion.

## Architecture

```
Enhancement Engine (recommendations)
        ↓
Enhancement Workspace Service (task state + test mode scoring)
        ↓
data/pharmacy-enhancement-workspace/{slug}.json
        ↓
Workspace UI + Campaign OS Enhancement Progress
        ↓
Mark Complete → refresh audit / enhancement / growth / launch queue
```

## Files

| File | Role |
|------|------|
| `src/pharmacy/pharmacyEnhancementWorkspaceService.ts` | State, task board, actions, refresh sequence |
| `artifacts/api-server/src/routes/pharmacyEnhancementWorkspacePage.ts` | Workspace HTML UI |
| `artifacts/api-server/src/routes/api/pharmacyEnhancementWorkspace.ts` | JSON API (status, complete) |
| `artifacts/api-server/src/routes/pharmacyPublishingSettingsPlaceholderPage.ts` | Canonical / noindex / schema placeholder |
| `artifacts/api-server/src/routes/pharmacyFaqWorkspacePlaceholderPage.ts` | FAQ enhancement placeholder |
| `src/pharmacy/pharmacyCampaignControlCentreService.ts` | Enhancement progress fields |
| `artifacts/api-server/src/routes/pharmacyCampaignsPage.ts` | Enhancement Progress section |
| `data/pharmacy-enhancement-workspace/{slug}.json` | Completion log |

## Workflow

1. Open **Enhancement Workspace** from Campaign OS
2. Review task board: Ready → In Progress → Completed → Deferred
3. Click **primary action** (Profile Dashboard, Image Library, Publishing Settings, etc.)
4. Complete work externally (or skip in test mode)
5. Click **Mark Complete**
6. System saves completion log and runs refresh sequence
7. Return to workspace or Campaign OS — progress updated

## State management

### Workspace store (`data/pharmacy-enhancement-workspace/{slug}.json`)

```json
{
  "version": 1,
  "slug": "pharmaconnect",
  "testMode": true,
  "updatedAt": "...",
  "tasks": [{
    "id": "ws-pharmacy-first-rec-...",
    "recommendationId": "rec-pharmacy-first-he-named-accountability",
    "serviceId": "pharmacy-first",
    "status": "completed",
    "completedAt": "...",
    "completedBy": "pharmacy-owner",
    "linkedModule": "Enhancement Workspace",
    "beforeScore": 91,
    "afterScore": 92,
    "notes": "Test mode completion",
    "testMode": true
  }]
}
```

Task statuses: `ready` · `in_progress` · `completed` · `deferred`

Default status for new recommendations: **ready**

## Refresh sequence

On **Mark Complete**:

1. Save workspace task record
2. `refreshPharmacyAuthorityReadiness(slug)`
3. `refreshPharmacyAuthorityEnhancement(slug)`
4. `refreshPharmacyGrowthActionPlan(slug)`
5. `refreshPharmacyCampaignLaunchQueue(slug)`

Campaign OS reflects updates on next load via `buildPharmacyCampaignControlCentre`.

## Test mode

V1 runs in **test mode only**:

- Mark Complete does **not** modify content, masters, or templates
- Workspace state records completion
- **Projected score** = current authority + sum of completed task gains (capped at potential)
- **Remaining** = recommendations not completed or deferred
- Validates full workflow before wiring real module edits

## Primary action routing

| Enhancement type | Primary action |
|------------------|----------------|
| Reviewer / review dates | Profile Dashboard → Professional Review |
| Canonical / noindex / schema | Publishing Settings (placeholder) |
| Images | Image Library |
| Ecosystem assets | Campaign OS |
| FAQs | FAQ Workspace (placeholder) |
| Default | Recommendation linked module |

## Campaign OS integration

**Enhancement Progress** section shows:

- Current · Projected · Potential scores
- Completed · Remaining
- Easy wins · High impact remaining
- **Continue Improvements** → Enhancement Workspace

Active campaign control panel includes enhancement completed/total and projected score.

## API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/pharmacy-enhancement-workspace?slug=&service=` | Workspace HTML |
| GET | `/api/pharmacy-enhancement-workspace/:slug` | JSON view + store |
| POST | `/api/pharmacy-enhancement-workspace/:slug/tasks/:id/complete` | Mark complete + refresh |
| POST | `/api/pharmacy-enhancement-workspace/:slug/tasks/:id/status` | Update status |

## Validation

```bash
pnpm exec tsx scripts/validate-pharmacy-enhancement-workspace-v1.ts pharmaconnect
```

Report: `data/validation-reports/pharmacy-enhancement-workspace-v1.json`

## Manual test checklist

After deployment:

1. [ ] Open Campaign OS → Authority Enhancement → note recommendation count (~38 for Pharmacy First)
2. [ ] Click **Open Enhancement Workspace**
3. [ ] Open a Reviewer Profile task → **Open Profile Dashboard** → verify `#section-professional-review`
4. [ ] Click **Mark Complete** → confirm toast and task moves to Completed
5. [ ] Open Campaign OS → **Enhancement Progress** → verify Completed +1, Remaining -1, Projected score up
6. [ ] Repeat for: Images, Canonical, Review Date, Noindex tasks
7. [ ] Verify completion log at `data/pharmacy-enhancement-workspace/pharmaconnect.json`
8. [ ] Confirm no content/master/template files changed

## Success criteria

A pharmacy owner can move from *"The platform recommends this improvement"* to *"The improvement has been completed and the platform reflects the change"* — in test mode without modifying published content.

This is the blueprint for all future enhancement modules.

## Next steps

1. Wire real profile field persistence to close reviewer/review-date signals
2. Build Publishing Settings module (canonical, noindex, schema)
3. Build FAQ Workspace module
4. Disable test mode projection when real content changes drive audit refresh
