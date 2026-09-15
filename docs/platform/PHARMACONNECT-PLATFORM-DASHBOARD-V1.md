# PharmaConnect Platform Dashboard V1

**Purpose:** Single user-facing dashboard that orchestrates existing PharmaConnect modules into one clear workflow. After login, a pharmacy owner opens one screen, sees where they are, which campaign is active, the next action, launch blockers, and results tracking — without needing to know internal module names.

**Route:** `/api/pharmacy-dashboard?slug={slug}`

**Default after login:** `/api/pharmacy-dashboard?slug=pharmaconnect`

**Re-run validation:** `pnpm pharmacy:platform:dashboard:validate`

---

## Dashboard sections

| # | Section | What it shows |
|---|---------|---------------|
| 1 | Header / Pharmacy Identity | Logo, name, town, phone, profile completeness, trust status, launch readiness |
| 2 | Current Campaign Panel | Blood Pressure Checks reference campaign — status, areas, completion %, publish gate, authority, indexing, visibility |
| 3 | Next Best Action | One primary CTA linking directly to the correct screen |
| 4 | Guided Workflow Timeline | Profile → Campaign → Areas → Images → Content → QA → Authority → Enhancements → Publish → Index → Visibility → Growth |
| 5 | Launch Blockers | Aggregated from Authority, Launch Queue, Enhancement Workspace, Publishing Settings, Profile, Images |
| 6 | Quick Access Cards | Links to all major platform modules |
| 7 | Campaign Assets Summary | Service page, local page, guide, FAQ, blogs, social, GBP, emails, video script |
| 8 | Results Tracking Summary | Indexed status, visibility score, keywords, growth actions, last refresh |
| 9 | Demo / Operator Notes | Collapsed admin section — login note, preview URLs, test campaign, warnings |

---

## Next best action logic

Priority order (first match wins):

1. Profile incomplete
2. Trust profile incomplete
3. No campaign
4. Areas missing
5. Images missing
6. Content ecosystem missing
7. Authority publish gate FAIL
8. Real enhancement actions pending
9. Canonical missing
10. Noindex enabled
11. Launch blockers (authority critical issues)
12. Publish pending
13. Indexing not submitted
14. Indexing pending refresh
15. Visibility not refreshed
16. Growth actions pending
17. Default: Review Growth Monitoring

Implementation: `src/pharmacy/pharmacyPlatformDashboardService.ts` → `resolveNextBestAction()`

---

## Data sources

All read-only — no new engines, no content generation:

| Source | Used for |
|--------|----------|
| `pharmacyProfileSchema` + `pharmacyProfileCompleteness` | Identity, trust, profile step |
| `pharmacyCampaignControlCentreService` | Current campaign, completion, authority |
| `pharmacyImageOperatingSystem` / campaign image summary | Image readiness |
| Content ecosystem index files | Content review step |
| `pharmacyAuthorityReadinessService` | Publish gate, blockers, authority step |
| `pharmacyEnhancementWorkspaceService` | Real enhancement actions |
| `pharmacyPublishingSettingsService` | Canonical, noindex |
| `pharmacyCampaignLaunchQueueService` | Launch blockers |
| `pharmacyIndexingBridgeService` | Indexing workflow + results |
| `pharmacyVisibilityBridgeService` | Visibility workflow + results |
| `pharmacyGrowthActionPlanService` | Growth actions + monitoring |
| `pharmacyCampaignService.buildOutputs` | Asset summary |

---

## Validation result

Command:

```bash
pnpm pharmacy:platform:dashboard:validate
```

Checks:

- Dashboard builds from existing data
- Pharmacy identity renders
- Current campaign (Blood Pressure Checks) renders
- Next best action renders with valid URL
- Workflow timeline (10+ steps)
- Launch blockers section
- Quick access links (10+ modules)
- Campaign assets summary
- Results tracking summary
- Links use valid `/api/` routes
- No master library files modified
- No visual template modifications
- Route file registered

HTTP route check runs when API server is available on port 3001.

---

## Manual testing instructions

1. **Sign in** at `/api/login` (username: `admin` — see `docs/platform/DEMO-LOGIN.md`).

2. **Confirm redirect** to `/api/pharmacy-dashboard?slug=pharmaconnect`.

3. **Verify five questions:**
   - Setup headline answers "where am I?"
   - Current campaign panel shows Blood Pressure Checks
   - Next best action shows one button with a working link
   - Launch blockers list is populated or shows "clear to proceed"
   - Results tracking shows indexing/visibility/growth data

4. **Click Next best action** — should land on the correct module (Profile, Image Library, Publishing Settings, etc.).

5. **Walk workflow timeline** — each step's "Open →" link should resolve (auth required).

6. **Use for Blood Pressure campaign test** — this dashboard is the starting screen for the full real-time campaign validation workflow.

---

## Files

| File | Role |
|------|------|
| `src/pharmacy/pharmacyPlatformDashboardService.ts` | Data aggregation + next action logic |
| `artifacts/api-server/src/routes/pharmacyPlatformDashboardPage.ts` | HTML route |
| `artifacts/api-server/src/routes/auth.ts` | Login redirect to platform dashboard |
| `scripts/validate-pharmacy-platform-dashboard-v1.ts` | Validation script |

---

## Reference campaign

Primary test campaign for dashboard V1:

- **Service:** `blood-pressure-checks`
- **Campaign ID:** `2e5cf653-7df3-4918-96f8-c99d687b764b`
- **Name:** Blood Pressure Checks — Increase Visibility

This matches the multi-campaign validation reference set documented in `docs/platform/PHARMACONNECT-MULTI-CAMPAIGN-VALIDATION-V1.md`.
