# Business Profile Intelligence V2 — Phase 1 (Architecture)

**Status:** Architecture only — no generator, API, dashboard, or rendering changes.

**Version:** `2.0.0-phase1`

---

## Purpose

The Business Profile must become the **single source of truth** for every generated asset in the PharmaConnect Growth Engine.

Phase 1 defines the data model, defaults, and migration path from existing `PharmacyProfileData` (Profile Schema V4). Nothing is wired into page generation yet.

### Target pipeline

```
PharmacyProfileData (stored JSON)
        ↓
buildBusinessProfileIntelligenceFromProfile()
        ↓
BusinessProfileIntelligence (normalized intelligence object)
        ↓
toContentIntelligenceContext()  [Phase 2]
        ↓
Generators (service pages, long-form, local clusters, etc.)
```

Generators in Phase 2+ should consume `BusinessProfileIntelligence` (or `ContentIntelligenceContext`) — **not** raw profile field names.

---

## Module location

| Path | Role |
|------|------|
| `src/pharmacy/businessProfileIntelligence/businessProfileIntelligenceTypes.ts` | Strong TypeScript types — all 10 sections |
| `src/pharmacy/businessProfileIntelligence/businessProfileIntelligenceDefaults.ts` | Default values per section |
| `src/pharmacy/businessProfileIntelligence/buildBusinessProfileIntelligence.ts` | Migration builder from legacy profile |
| `src/pharmacy/businessProfileIntelligence/index.ts` | Public exports |

### Architecture validation

```bash
npx tsx scripts/validate-business-profile-intelligence-v2-architecture-v1.ts
```

---

## Section reference

### Section 1 — Business Identity

| Field | Legacy profile source | Notes |
|-------|----------------------|-------|
| Business Name | `pharmacyName` | Required for live profiles |
| Trading Name | `tradingName` | Falls back to business name |
| Tagline | `footerText` (partial) | Dedicated `tagline` field planned Phase 2 |
| Business Description | `uniqueSellingPoints[0]` | Full description field planned Phase 2 |
| Year Established | inferred from `yearsServingCommunity` | |
| GPhC Registration | `gphcNumber`, `gphcPremisesUrl` | |
| Superintendent Pharmacist | `superintendentPharmacistName` | |
| Pharmacist Team | `reviewer*` fields today | Full team array planned Phase 2 |
| Independent Prescriber | default `false` | Profile field planned Phase 2 |
| Contact Details | `phone`, `businessEmail`, `nhsEmail`, etc. | |
| Opening Hours | `openingHours` + day fields | |
| Emergency Contact | `emergencyContact` | |
| Website | `website` | |
| Social Media | `socialFacebook`, `socialInstagram`, etc. | |

### Section 2 — Brand Identity

| Field | Legacy source |
|-------|---------------|
| Primary / Secondary / Accent colours | `brandPrimaryColor`, `brandSecondaryColor`, `brandAccentColor` |
| Logo | `logoUrl`, `headerLogoUrl`, `footerLogoUrl`, `faviconUrl` |
| Fonts | `fontHeading`, `fontBody`, weights |
| Hero / Photography / Icon / CTA style | `pageStyle`, `imageStyle`, `buttonStyle` |

Uses `DEFAULT_BRANDING` from dashboard config when profile fields are empty.

### Section 3 — Location Intelligence

| Field | Legacy source |
|-------|---------------|
| Primary Town | `primaryTown`, `townCity` |
| Counties Covered | `county` |
| Service Radius | `coverageRadius` |
| Nearby GP Practices | `localGpSurgeries`, `gpSurgeries[]` |
| Nearby Hospitals | `nearbyHospitals`, `hospitals[]` |
| Parking | inferred from `facilities[]` |
| Public Transport | `localTransportLinks`, `transportLinks[]` |
| Wheelchair Access | inferred from `facilities[]` |
| Areas Served | `selectedAreas[]`, `coverageAreas[]` |

### Section 4 — Service Intelligence

Per-service record (`ServiceDeliveryIntelligence`) keyed by `serviceId`:

| Field | Phase 1 source | Phase 2 profile fields |
|-------|----------------|------------------------|
| NHS / Private / Mixed | inferred from `nhsServicesAvailable`, `privateServicesAvailable` | per-service override |
| Appointment Required | inferred from `bookingMethod` | explicit per service |
| Walk-in | inferred from `bookingMethod` | explicit per service |
| Consultation Length | default empty | new profile field |
| Equipment Used | default empty | new profile field |
| Preparation / Aftercare | default empty | new profile field |
| Results / Referral Process | default empty | new profile field |
| Pricing | default empty | new profile field |
| Age Restrictions | default empty | new profile field |

Service IDs populated from `selectedServices`, `priorityServices`, and `detectedWebsiteServices`.

### Section 5 — Team Intelligence

| Field | Legacy source |
|-------|---------------|
| Meet the Team intro | `reviewerBio` |
| Team members | superintendent + reviewer fields |
| Qualifications / Languages / Experience | `reviewerQualifications`, `languagesSpoken`, `reviewerExperienceYears` |
| Special / Clinical interests | `reviewerSpecialInterests`, `reviewerClinicalInterests` |
| Team Photos | `reviewerPhoto` |

### Section 6 — Patient Intelligence

| Field | Legacy source |
|-------|---------------|
| Target patient groups | `targetPatientGroups[]` |
| Unique selling points | `uniqueSellingPoints[]` |
| Patient questions | `patientQuestions[]` |

### Section 7 — Trust Intelligence

| Field | Legacy source |
|-------|---------------|
| Awards | default empty — Phase 2 field |
| Accreditations | `accreditations[]` |
| Review highlights | default empty — Phase 2 field |
| Testimonials | default empty — Phase 2 field |
| Years serving community | `yearsServingCommunity` |
| Number of patients | default empty — Phase 2 field |
| NHS / GPhC / GBP URLs | profile trust URLs |

### Section 8 — Conversion Intelligence

| Field | Legacy source |
|-------|---------------|
| Primary / Secondary CTA | `headerCtaText`, `preferredCta`, `bookingUrl` |
| Booking URL | `bookingUrl` |
| Telephone / Email | `phone`, `businessEmail` |
| Online booking | derived from `bookingUrl` |
| Preferred CTA wording | `preferredCta` |

### Section 9 — Content Intelligence

| Field | Legacy source / default |
|-------|------------------------|
| Tone of Voice | `tone` or `"professional"` |
| Reading Level | default `"plain-english"` |
| Preferred Length | default `"standard"` |
| Mention Pharmacists | default `true` |
| Mention Reviews | true if GBP URL present |
| Local References | default `true` |
| FAQ Preferences | sensible defaults for long-form |
| Internal Link Behaviour | default `"balanced"` |

### Section 10 — AI Intelligence + aggregate object

`AiIntelligence` holds generator guardrails (not connected in Phase 1):

- `requireReviewerAttribution`
- `preferLocalContext`
- `doNotInventWithoutProfile[]` — fields generators must not fabricate
- `profileFirstFields[]` — intelligence paths generators should prefer over hard-coded defaults

`BusinessProfileIntelligence` is the **single aggregate** combining sections 1–10.

---

## Migration strategy

### Existing pharmacies (Profile Schema V4)

1. Load profile via existing `normalizeProfileDoc()` — **unchanged**.
2. Call `buildBusinessProfileIntelligenceFromProfile(slug, data, updatedAt, version)`.
3. Review `provenance.migrationNotes` for gaps (missing service delivery detail, tagline, etc.).
4. No write-back to profile JSON in Phase 1.

### Future profiles

- New dashboard fields should map into `BusinessProfileIntelligence` sections via the builder.
- Unknown fields receive section defaults from `businessProfileIntelligenceDefaults.ts`.
- Profile Schema V5 (future) may embed `intelligence` block directly; builder remains the normalizer.

### Backwards compatibility

- **No changes** to `PharmacyProfileData`, `normalizeProfileData`, or stored JSON.
- Intelligence is derived at read/build time only.
- Existing generators continue using `ContentGenerationContext` until Phase 2.

---

## Extension points for future generators

### 1. Primary entry

```typescript
import { buildBusinessProfileIntelligenceFromProfile } from "./businessProfileIntelligence/index.ts";

const intelligence = buildBusinessProfileIntelligenceFromProfile(slug, profileData);
```

### 2. Content intelligence context (Phase 2)

```typescript
import { toContentIntelligenceContext } from "./businessProfileIntelligence/index.ts";

const ctx = toContentIntelligenceContext(intelligence, {
  serviceId: "blood-pressure-checks",
  localArea: "Sheffield",
});
```

### 3. Service-scoped reads

```typescript
const svc = intelligence.services.byServiceId["blood-pressure-checks"];
const phone = intelligence.conversion.telephone;
const town = intelligence.location.primaryTown;
```

### 4. AI guardrails

```typescript
for (const field of intelligence.ai.doNotInventWithoutProfile) {
  // validation layer — reject generated copy that invents missing profile data
}
```

---

## Explicit non-goals (Phase 1)

- ❌ Modify long-form content engine
- ❌ Modify supporting content renderer
- ❌ Modify existing validation scripts or approval gates
- ❌ Modify APIs, deployment, registry, lifecycle, health audit, dashboard
- ❌ Connect intelligence into `buildContentGenerationContext`
- ❌ Change generated page output

---

## Phase 2 preview (not in scope)

1. Add profile dashboard fields for service delivery detail, tagline, testimonials.
2. Wire `buildBusinessProfileIntelligence` into `ContentGenerationContext` builder.
3. Replace hard-coded assumptions in generators with intelligence reads.
4. Add intelligence completeness audit separate from profile audit.

---

## Related locked components

Long-Form Supporting Content Quality V1 remains locked. This architecture sits **alongside** the content engine and does not alter it until explicitly wired in Phase 2.
