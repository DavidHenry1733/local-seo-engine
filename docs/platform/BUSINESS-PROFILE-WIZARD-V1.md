# Business Profile Wizard V1

Guided onboarding experience for the pharmacy Business Profile. This is a **UX-only** layer — it does not change generators, Business Profile Intelligence, or content output logic.

## Route

- **Wizard (default):** `/api/pharmacy-profile-wizard?slug={tenant}`
- **Legacy full form:** `/api/pharmacy-profile-dashboard?slug={tenant}&legacy=1`

The profile dashboard redirects to the wizard unless `legacy=1` is set.

## Wizard steps

| Step | Title | Purpose |
|------|--------|---------|
| 1 | Welcome | Explains how profile data drives generated content; shows estimated time |
| 2 | Business Information | Name, contact, address, hours, social |
| 3 | Brand Identity | Logo, colours, website import, header/footer colours |
| 4 | Locations | Primary town, target areas, parking, local context |
| 5 | Services | Enable services; one service delivery card at a time |
| 6 | Your Team | Reviewer, superintendent, team intro |
| 7 | Patients | Target groups, USPs, patient questions |
| 8 | Trust | Accreditations, awards, years serving community |
| 9 | Marketing Preferences | CTAs, tone, FAQ/content preferences |
| 10 | Profile Review | Quality score, ready-to-generate, missing items |

## Profile Quality Score

Weighted display score (not used in generation):

- Business Information (15%)
- Brand (15%)
- Services (20%)
- Team (15%)
- Trust (15%)
- Patients (10%)
- Marketing (10%)

Bands: **Poor** (<50), **Good** (50–79), **Excellent** (≥80).

## Ready To Generate

Uses existing required-field gate (`isRequiredProfileComplete`) — same rules as the Growth Programme profile step. Optional fields never block wizard navigation.

## Save and resume

- **Auto-save** on field change (debounced) via `POST /api/pharmacy/profile/:slug`
- **Resume step** stored in profile as `profileWizardStep` and `profileWizardUpdatedAt` (optional fields; backwards compatible)
- **Step validation** via `POST /api/pharmacy/profile/:slug/wizard-validate`

## Validation

```bash
npx tsx scripts/validate-pharmacy-profile-wizard-v1.ts
```

## Source files

- `src/pharmacy/pharmacyProfileWizardScoring.ts` — quality score
- `src/pharmacy/pharmacyProfileWizardSteps.ts` — step metadata and validation
- `src/pharmacy/pharmacyProfileWizardSections.ts` — step HTML
- `src/pharmacy/pharmacyProfileWizardPage.ts` — page render + client script
- `artifacts/api-server/src/routes/pharmacyProfileWizardPage.ts` — Express route

## Locked systems (unchanged)

- Business Profile Intelligence builders and generator wiring
- Approval gates, registry, lifecycle, health audit
- Dashboard analytics modules
