# PharmaConnect Authority Publish Gate V1

Connects the Authority & AI Readiness Engine to the Campaign Launch Queue, Campaign Operating System, publishing workflow, Growth Actions and Profile Dashboard. This turns the authority audit from a read-only report into a **live publish gate** — preview remains available; only live publish and indexing submission are blocked when `publishGate = FAIL`.

## Files modified

| File | Change |
|------|--------|
| `src/pharmacy/pharmacyAuthorityReadinessService.ts` | `AuthorityPublishGateSnapshot`, `getAuthorityPublishGateSnapshot`, `buildAuthorityGrowthActionDrafts` |
| `src/pharmacy/pharmacyCampaignLaunchQueueService.ts` | Authority bridge snapshot, launch task, gate blocking on publish/indexing |
| `src/pharmacy/pharmacyCampaignOperatingSystemService.ts` | Authority panel data, `Not Ready For Live Publish` readiness |
| `src/pharmacy/pharmacyCampaignControlCentreService.ts` | Extended campaign authority fields |
| `src/pharmacy/pharmacyPlatformOperationalWorkflowService.ts` | Publishing workflow live-publish blocked state |
| `src/pharmacy/pharmacyGrowthActionPlanService.ts` | Authority blocker growth actions |
| `artifacts/api-server/src/routes/pharmacyCampaignsPage.ts` | Campaign OS UI, publishing workflow blocker banner |
| `artifacts/api-server/src/routes/pharmacyProfileDashboardPage.ts` | Professional Review / Trust Signals placeholders |
| `scripts/validate-pharmacy-authority-publish-gate-v1.ts` | End-to-end validation |
| `package.json` | `pharmacy:authority:publish-gate:validate` script |

**Not modified:** service masters, clinical copy, visual templates, published content files.

## Gate logic

| `publishGate` | Launch task status | Live publish | Indexing submit |
|---------------|-------------------|--------------|-----------------|
| `PASS` | `complete` | Allowed | Allowed (when sitemap ready) |
| `PASS_WITH_RECOMMENDATIONS` | `in_progress` | Allowed with recommendations | Allowed (when sitemap ready) |
| `FAIL` | `blocked` | Blocked | Blocked |

Blockers include: demo/mock trust profile, `noindex`, missing canonical, missing reviewer/review dates, structured data gaps.

Override flag is **not** implemented in V1 — blocked state is display-only.

## Launch queue integration

Required task: **Authority & AI Readiness approved** (after Confirm ecosystem, before Publish page).

Task evidence includes:

- Authority score
- Publish gate
- Top 3 critical issues
- Top 3 missing signals
- Audit URL

`publish-page` and `submit-indexing` tasks are auto-blocked when `publishGate = FAIL`.

## Campaign OS integration

Each campaign shows:

- Score, label, publish gate
- Launch impact
- Top blockers
- **View Full Authority Audit** link

When `publishGate = FAIL`, readiness label: **Not Ready For Live Publish** (`preview_ready` status when profile/images allow internal preview).

## Publishing workflow behaviour

When `publishGate = FAIL`:

- Primary service block shows **Live publish blocked**
- Reason: *Authority & AI Readiness has unresolved blockers.*
- Next action overridden to resolve authority blockers
- Indexing submission blocked via launch queue (no override)

## Growth Actions generated

From authority audit blockers, e.g.:

- Add named professional reviewer
- Add clinical review date / next review date
- Replace demo trust profile with verified pharmacy details
- Add canonical URL
- Remove noindex before live publish

Actions link to Profile Dashboard (`#section-professional-review`), Authority Audit page, or relevant campaign.

## Profile Dashboard

New section: **Professional Review / Trust Signals** with placeholder fields:

- `reviewerName`, `reviewerRole`, `reviewerQualifications`, `reviewerGphcNumber`, `reviewerExperienceYears`, `reviewerBio`, `clinicalReviewDate`, `nextReviewDate`

Fields are disabled placeholders — not required for storage in V1. Missing signals from the authority audit are listed below the section.

## Validation

```bash
pnpm exec tsx scripts/validate-pharmacy-authority-publish-gate-v1.ts pharmaconnect
```

Report: `data/validation-reports/pharmacy-authority-publish-gate-v1.json`

Checks:

1. Launch queue contains Authority & AI Readiness task
2. Task blocked when `publishGate = FAIL`
3. Campaign OS shows Not Ready For Live Publish
4. Publishing workflow displays authority blocker
5. Growth actions include authority-related actions
6. Audit link works
7. No content/template redesign

## Validation result

Run validation after deploy. With current pharmaconnect demo profile, expect:

- Content scores: Strong / Excellent
- `publishGate`: FAIL (correct — demo trust, noindex, canonical, review dates)
- Launch task: blocked
- Campaign readiness: Not Ready For Live Publish
- Publishing workflow: Live publish blocked

## Next recommended step

1. Complete Profile Dashboard professional review placeholders (persist fields to profile schema).
2. Replace demo trust credentials and remove `noindex` on visual pages before live launch.
3. Add canonical URLs and named reviewer / review dates.
4. Re-run authority refresh — expect `PASS_WITH_RECOMMENDATIONS` then `PASS`.
5. Implement optional override flag for emergency publish (explicit admin only).
