# Approved Pharmacy Template Restore V1

**Date:** 2026-06-25  
**Template ID:** `lockdown-v1`  
**Pipeline:** `consolidated-v1`  
**Slug:** pharmaconnect

---

## 1. Approved template source found

The approved fixed layout was recovered from:

| Source | Role |
|--------|------|
| `src/pharmacy/pharmacyFirstPageSections.ts` | **Primary** — locked slot renderers (hero, 50/50 definition split, conditions grid, 4-step process, safety 2-col, FAQ, local, CTA) |
| `docs/platform/PHARMACONNECT-DESIGN-LOCKDOWN-V1.md` | Design lockdown specification |
| `docs/platform/PHARMACY-VISUAL-EXPERIENCE-V3.md` | Visual experience V3 architecture reference |
| `src/pharmacy/pharmacyVisualExperienceLayoutV2.ts` | Master section parser (`parseMasterSections`) |

The dynamic card-per-paragraph renderer in `pharmacyVisualExperienceLayoutV3.ts` (compare layout, benefits dump, proof band) was **replaced** with the approved fixed-slot template.

---

## 2. Files restored / modified

| File | Change |
|------|--------|
| `src/pharmacy/pharmacyVisualExperienceLayoutV3.ts` | Rewritten — fixed 11-slot approved template for all services |
| `src/pharmacy/pharmacyServicePageDesignSystem.ts` | Premium landing CSS (support band, conditions/process grids, trust prose, hide dashboard dumps) |
| `scripts/validate-approved-pharmacy-template-restore-v1.ts` | **New** validation script |
| `package.json` | Pipeline uses restore validator |

**Preserved unchanged:**

- `pharmacyThemeEngine.ts` — Brook green profile theme
- `pharmacyServicePageTrustInjection.ts` — hero, trust cards, local, final CTA
- `pharmacyServicePageBodyLocalisation.ts` — Brook Pharmacy wording
- `pharmacyImageAssignmentResolver.ts` — image slots
- `pharmacyServicePageBalance.ts` — card sentence balancing
- `pharmacyVisualServicePageRenderer.ts` — unified pipeline entry

---

## 3. Layout restored (fixed slots)

| # | Block | Master source | Layout |
|---|-------|---------------|--------|
| 1 | Header | Profile | Sticky nav + CTA |
| 2 | Hero 50/50 | Profile + hero image | `hero-grid` |
| 3 | Trust cards | Profile | 4-card grid |
| 4 | What the service is | Section 1 | 50/50 definition split + support image |
| 5 | Conditions / key points | Section 2 | 3-col titled cards only (max 9) |
| 6 | Appointment process | Section 4 | 4-step process grid |
| 7 | Support image band | Section 5 | Full-width image + intro |
| 8 | Safety panel | Section 6 | Prose left + safety cards right |
| 9 | Trust section | Section 12 | Prose left + trust image right |
| 10 | FAQ | Master FAQ accordion | Styled FAQ cards |
| 11 | Local access | Profile + section 13 | 2-col + Google Map |
| 12 | Final CTA | Profile | Conversion image + CTA band |
| 13 | Footer | Profile | Profile-driven footer |

**Removed:** compare quick-answer dump, benefits timeline, proof band, card-per-paragraph rendering.

---

## 4. Recent fixes preserved

- Brook Pharmacy body localisation
- Profile brand colours (`--brand-primary/secondary/cta`)
- Green Brook theme (NHS blue badges only)
- Image assignment resolver (hero/support/trust/conversion)
- Google Map iframe in local access
- Profile-driven final CTA wording
- Card sentence completeness balancing
- No duplicate sections
- No generic access phrases

---

## 5. Validation result

```bash
pnpm run pharmacy:visual:pipeline
```

**PASS** — all four benchmark pages:

- pharmacy-first
- blood-pressure-checks
- travel-vaccinations
- emergency-contraception

Report: `data/validation-reports/approved-pharmacy-template-restore-v1-pharmaconnect.json`

---

## 6. Preview URLs

| Service | URL |
|---------|-----|
| Pharmacy First | `/api/pharmacy-visual-experience/pharmacy-first/?slug=pharmaconnect&rebuild=1` |
| Blood Pressure Checks | `/api/pharmacy-visual-experience/blood-pressure-checks/?slug=pharmaconnect&rebuild=1` |
| Travel Vaccinations | `/api/pharmacy-visual-experience/travel-vaccinations/?slug=pharmaconnect&rebuild=1` |
| Emergency Contraception | `/api/pharmacy-visual-experience/emergency-contraception/?slug=pharmaconnect&rebuild=1` |

---

## 7. Confirmation — no master files changed

**Confirmed.** No changes to:

- `output/pharmacy-master-publish/**`
- Clinical copy, research files, or service masters
- New dashboards, engines, or content assets

Only the visual rendering pipeline and validation were modified.
