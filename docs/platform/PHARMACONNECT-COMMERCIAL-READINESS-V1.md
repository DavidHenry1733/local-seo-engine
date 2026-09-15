# PharmaConnect Commercial Readiness Sprint V1

This sprint proves that a **brand-new pharmacy** can be onboarded from zero to an active Growth Programme **without manual developer intervention**.

No new AI engines, SEO features, or pharmacy services were added. The focus is **self-provisioning** and **workflow continuity**.

## Primary principle

Every customer action must work without:

- Manual JSON edits
- Manual file creation
- Manual regeneration
- Manual branding fixes
- Manual campaign creation
- Developer intervention

The platform must **provision itself**.

## Test scenario

**Greenfield Pharmacy** (`greenfield-pharmacy`) — a fresh demo client treated as a real paying customer. Not Brook Pharmacy. Not Pharmaconnect.

## Journey map

```
1  Create New Pharmacy          Master Admin wizard
        ↓
2  Choose Growth Plan            Starter / Professional / Complete
        ↓
3  Website Analysis              Automatic during provisioning
        ↓
4  Brand Import                  Merged into profile + brand-profile.json
        ↓
5  Business Profile              data/pharmacy-profiles/{slug}.json
        ↓
6  Areas                         discoverPharmacyAreas → selectedAreas
        ↓
7  Growth Plan created           Campaign store + placeholder campaign
        ↓
8  First service selected        pharmacy-first (wizard step 4)
        ↓
9  Generate Growth Programme     Growth Programme dashboard renders
        ↓
10 Images                        Image assignments store + upload folder
        ↓
11 Review                        Content Review (authority readiness)
        ↓
12 Ready To Publish              Publishing settings seeded per service
        ↓
13 Submit                        Growth dashboard indexing route (when live)
        ↓
14 Growth Dashboard              Performance + progress tracked
```

## Screens visited (automated validation)

| Screen | Route |
|--------|-------|
| Master Admin — Client Portfolio | `/api/admin/pharmacies` |
| Growth Programme — Welcome | `/api/pharmacy-dashboard?slug=greenfield-pharmacy` |
| Outstanding Tasks | Same dashboard |
| Current Growth Plan | Same dashboard |
| Profile Dashboard | `/api/pharmacy-profile-dashboard?slug=…` |
| Campaign Management | `/api/pharmacy-campaigns?slug=…` |
| Image Library | `/api/pharmacy-image-library?slug=…` |
| Content Review | `/api/pharmacy-authority-readiness?slug=…` |
| Publishing Settings | `/api/pharmacy-publishing-settings?slug=…` |
| Growth Dashboard | `/api/pharmacy-growth-dashboard?slug=…` |

## Self-provisioning

`pharmacyWorkspaceProvisionService.ts` runs automatically at the end of `createPharmacyWorkspace()`:

| Artifact | Location |
|----------|----------|
| Profile | `data/pharmacy-profiles/{slug}.json` |
| Project | `config/projects/{slug}.json` |
| Brand profile | `config/projects/{slug}/brand-profile.json` |
| Campaign store | `data/pharmacy-campaigns/{slug}.json` |
| Launch queue | `data/pharmacy-campaign-launch-queue/{slug}.json` |
| Authority readiness | `data/pharmacy-authority-readiness/{slug}.json` |
| Authority enhancements | `data/pharmacy-authority-enhancements/{slug}.json` |
| Growth actions | `data/pharmacy-growth-actions/{slug}.json` |
| Image store | `data/pharmacy-image-assignments/{slug}.json` |
| Publishing settings | `data/pharmacy-publishing-settings/{slug}.json` |
| Enhancement workspace | `data/pharmacy-enhancement-workspace/{slug}.json` |
| Registry | `data/pharmacy-registry/{slug}.json` |
| Indexing summary | `data/pharmacy-indexing/{slug}.json` |
| Visibility report | `data/pharmacy-visibility/{slug}.json` |
| Growth journey | `data/pharmacy-growth-journey/{slug}.json` |
| Master admin registry | `data/pharmacy-master-admin/registry.json` |

Required folders: `config/projects/{slug}`, `assets/pharmacy-uploads/{slug}`, `output/pharmacy-*` paths.

## Manual interventions required

**None** for provisioning and dashboard rendering. Validation creates Greenfield Pharmacy entirely via `createPharmacyWorkspace()` API — no hand-edited files.

Customer-facing steps after provisioning (uploading photos, completing profile fields, publishing) are **guided Outstanding Tasks** — not developer actions.

## Issues discovered (V1)

| Issue | Resolution |
|-------|------------|
| New tenants missing growth/indexing/visibility stores | `finalizePharmacyWorkspaceProvisioning()` scaffolds all required JSON and folders |
| Orphan registry entries without profiles crashed portfolio | Master admin card builder handles missing profiles gracefully |
| Outstanding Tasks copy was terse | Updated to “complete these in order…” |

## Commercial readiness checklist

| Item | Status |
|------|--------|
| New pharmacy can be created | ✓ Master Admin wizard + API |
| Website analysis succeeds | ✓ When URL provided |
| Brand import succeeds | ✓ Automatic merge |
| Areas generated | ✓ Area discovery on create |
| Growth Plan assigned | ✓ Tier stored in registry |
| Campaign generated | ✓ First service campaign |
| Images assigned | ✓ Store + upload dir (customer uploads via UI) |
| Review completed | ✓ Authority readiness scaffolded |
| Publishing workflow available | ✓ Settings seeded per service |
| Dashboard updates correctly | ✓ Growth Programme renders |
| Progress tracked | ✓ OS completion % |
| Outstanding Tasks populated | ✓ Action cards with Continue |
| Advanced Tools available | ✓ Collapsed section |

## Commercial readiness score

Run validation for the live score:

```bash
pnpm run pharmacy:commercial-readiness:validate
```

Report: `data/validation-reports/pharmacy-commercial-readiness-v1.json`

Target: **100%** (26 checks) before wider rollout.

## Regression

Validation confirms **pharmaconnect** profile hash unchanged and existing Growth Programme still loads after Greenfield provisioning test.

## Recommendations

1. **Proceed to rollout** once validation passes at 100%.
2. Assign staff users to specific pharmacy slugs (future).
3. Trigger visual page build from wizard when first campaign is created (optional — not required for V1 readiness).
4. Keep Greenfield Pharmacy as a permanent demo in staging for sales walkthroughs.

## Validation

```bash
pnpm run pharmacy:commercial-readiness:validate
pnpm run pharmacy:master-admin:validate
pnpm run pharmacy:customer-experience:validate
```

## Success criteria

A completely new pharmacy can be onboarded exactly as a paying customer would experience the platform. No developer intervention is required for provisioning, navigation, or Growth Programme activation.
