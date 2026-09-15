# PharmaConnect Multi-Campaign Validation V1

**Pharmacy:** Brook Pharmacy · **Slug:** `pharmaconnect`  
**Validated:** 2026-06-26  
**Mode:** Validation only — no new services, engines, dashboards, or template redesigns  

**Machine-readable report:** `data/platform-validation/multi-campaign-validation-v1.json`  
**Re-run:** `pnpm pharmacy:platform:multi-campaign:validate`

---

## Executive summary

| Metric | Result |
|--------|--------|
| **Platform overall status** | **PASS** |
| Campaigns PASS | **4 / 4** |
| Campaigns WARNING | 0 |
| Campaigns FAIL | 0 |
| **PASS %** (all checks) | **100%** (232 / 232) |
| **Platform architecture proven** | **Yes** |

All four benchmark reference campaigns complete the full operational workflow from Business Profile through Campaign Operating System. Development may proceed to adding remaining pharmacy services using this validated workflow.

---

## Reference campaigns

| Service | Campaign | Campaign ID | Overall status | PASS % | Stages PASS |
|---------|----------|-------------|----------------|--------|-------------|
| Pharmacy First | Pharmacy First — Increase Visibility | `debea4b8-72a8-4511-9fb3-e3ab5dc16ba1` | **PASS** | 100% | 10 / 10 |
| Blood Pressure Checks | Blood Pressure Checks — Increase Visibility | `2e5cf653-7df3-4918-96f8-c99d687b764b` | **PASS** | 100% | 10 / 10 |
| Travel Vaccinations | Travel Vaccinations — Increase Visibility | `86c92269-9c0e-4347-9aed-6561f1ab617b` | **PASS** | 100% | 10 / 10 |
| Emergency Contraception | Emergency Contraception — Increase Visibility | `61d6088c-9ea1-48d9-9ad8-79ecc059f63c` | **PASS** | 100% | 10 / 10 |

---

## Workflow validated (all four campaigns)

```
Profile → Campaign → Images → Visual Preview → QA → Authority → Enhancement
    → Publish → Index → Visibility → Growth Monitoring → Campaign OS
```

| Stage | Name | All campaigns |
|-------|------|---------------|
| 1 | Business Profile | PASS |
| 2 | Campaign Creation | PASS |
| 3 | Image Workflow | PASS |
| 4 | Visual Experience | PASS |
| 5 | Quality Assurance | PASS |
| 6 | Real Enhancement Actions | PASS |
| 7 | Publish Workflow | PASS |
| 8 | Indexing Workflow | PASS |
| 9 | Visibility Workflow | PASS |
| 10 | Campaign Operating System | PASS |

---

## Per-campaign highlights

### Pharmacy First

- Authority score **97**, publish gate **PASS**
- 4/4 image slots assigned; visual page at `output/pharmacy-visual-experience/pharmaconnect/pharmacy-first/index.html`
- Publishing registry: indexed · visibility: visible
- Canonical: `https://www.brookpharmacy.co.uk/services/pharmacy-first`

### Blood Pressure Checks

- Authority score **95**, publish gate **PASS**
- 4/4 image slots assigned; visual page at `output/pharmacy-visual-experience/pharmaconnect/blood-pressure-checks/index.html`
- Publishing registry: indexed · visibility: visible
- Canonical: `https://www.brookpharmacy.co.uk/services/blood-pressure-checks`

### Travel Vaccinations

- Authority score **92**, publish gate **PASS**
- 4/4 image slots assigned; visual page at `output/pharmacy-visual-experience/pharmaconnect/travel-vaccinations/index.html`
- Publishing registry: indexed · visibility: visible
- Canonical: `https://www.brookpharmacy.co.uk/services/travel-vaccinations`

### Emergency Contraception

- Authority score **92**, publish gate **PASS**
- 4/4 image slots assigned; visual page at `output/pharmacy-visual-experience/pharmaconnect/emergency-contraception/index.html`
- Publishing registry: indexed · visibility: visible
- Canonical: `https://www.brookpharmacy.co.uk/services/emergency-contraception`

---

## Stage 10 — Dashboard integration verified

For each campaign, the following dashboards resolve live bridge data correctly:

| Dashboard | Verified |
|-----------|----------|
| Campaign OS | Health score, timeline, readiness |
| Image Centre | Slot completion per service |
| Authority Audit | Score + publish gate |
| Enhancement Workspace | Real-action progress |
| Launch Queue | Task list per service |
| Publishing | Registry + publish index |
| Indexing | Registry status + summary |
| Visibility | Keyword tracking + status |
| Growth Actions | Action plan loaded |

---

## Repairs applied during validation

These repairs were required to achieve PASS across all four campaigns. No new services, engines, or dashboards were created.

1. **Publishing settings extended** — Added canonical URLs and `noindex: false` for `travel-vaccinations` and `emergency-contraception`; corrected `pharmacy-first` canonical from placeholder domain to Brook Pharmacy URL (`data/pharmacy-publishing-settings/pharmaconnect.json`).

2. **Visual pages rebuilt** — Re-ran `pnpm pharmacy:visual:build` so robots meta and schema reflect live publishing settings for all four benchmark services.

3. **Emergency contraception campaign sync** — Updated stale `indexingStatus` / `visibilityStatus` on campaign record to match registry and visibility bridge data.

4. **Multi-campaign validation script** — Added `scripts/validate-multi-campaign-v1.ts` and npm script `pharmacy:platform:multi-campaign:validate` to automate 10-stage validation across all benchmark services.

Prior stabilisation sprint repairs (verified still holding):

- Brook Pharmacy live trust profile (no demo mode)
- Logo uploaded and visible on visual pages
- Image alt text fallbacks (no `undefined`)
- Single support image per visual page
- One active campaign per benchmark service

---

## Remaining blockers

**None.** All four reference campaigns PASS all 10 workflow stages.

---

## Warnings

**None** at campaign level. Platform-level opportunity engine continues to surface growth recommendations (review volume, competitor gaps) — these are operational insights, not workflow blockers.

---

## Screenshots / visual artifacts

Visual page HTML outputs (used as validation artifacts):

| Service | Path |
|---------|------|
| Pharmacy First | `output/pharmacy-visual-experience/pharmaconnect/pharmacy-first/index.html` |
| Blood Pressure Checks | `output/pharmacy-visual-experience/pharmaconnect/blood-pressure-checks/index.html` |
| Travel Vaccinations | `output/pharmacy-visual-experience/pharmaconnect/travel-vaccinations/index.html` |
| Emergency Contraception | `output/pharmacy-visual-experience/pharmaconnect/emergency-contraception/index.html` |

---

## Recommended next steps

1. **Freeze benchmark workflow** — Use these four campaigns as the reference pattern when onboarding additional pharmacy services.

2. **Operator access** — See `docs/platform/DEMO-LOGIN.md` for login URL and demo workflow order.

3. **Single-campaign deep validation** — Re-run `pnpm pharmacy:platform:workflow:validate` for detailed 8-stage Blood Pressure audit with UX notes.

4. **Service expansion** — Platform architecture is proven; proceed to add remaining pharmacy services using the validated workflow only after stakeholder sign-off on this report.

---

## Validation command

```bash
pnpm pharmacy:platform:multi-campaign:validate
```

Exit code `0` = platform PASS. Exit code `1` = one or more campaigns FAIL.
