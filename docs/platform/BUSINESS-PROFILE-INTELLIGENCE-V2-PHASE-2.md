# Business Profile Intelligence V2 — Phase 2 (Enhanced Profile Fields)

**Status:** Profile data + dashboard UI — generators unchanged.

**Schema version:** `5` (`PROFILE_SCHEMA_VERSION`)

---

## What Phase 2 adds

Phase 2 extends stored pharmacy profiles with fields that map directly into `BusinessProfileIntelligence` (Phase 1 architecture). The dashboard can now capture rich pharmacy-specific data. **Generated pages are unchanged** until Phase 3 wiring.

### New module

| Path | Role |
|------|------|
| `src/pharmacy/pharmacyProfileV2Fields.ts` | V2 storage types, defaults, normalization |
| `src/pharmacy/pharmacyProfileDashboardV2Sections.ts` | Dashboard UI for all 9 intelligence sections |
| `src/pharmacy/businessProfileIntelligence/mapProfileV2ToIntelligence.ts` | Profile → intelligence field resolution |

### Validation

```bash
npx tsx scripts/validate-business-profile-intelligence-v2-phase2-profile-fields-v1.ts
npx tsx scripts/validate-business-profile-intelligence-v2-architecture-v1.ts
```

---

## Dashboard sections (Intelligence V2)

Access via **Pharmacy Profile Dashboard** — jump links at top of V2 block:

| Section | Profile fields |
|---------|----------------|
| Business Identity | `tagline`, `businessDescription`, `yearEstablished`, `independentPrescriberAvailable`, `pharmacistTeamMembers` |
| Brand Identity | `heroStyle`, `photographyStyle`, `iconStyle`, `ctaStyleBrand` |
| Location Intelligence | `countiesCovered`, `parkingInfo`, `wheelchairAccess` |
| Service Intelligence | `serviceDeliveryProfiles` (per serviceId) |
| Team Intelligence | `meetTheTeamIntro`, `teamMembers` |
| Patient Intelligence | `targetPatientGroups`, `uniqueSellingPoints`, `patientQuestions` |
| Trust Intelligence | `awards`, `reviewHighlights`, `testimonials`, `numberOfPatients` |
| Conversion Intelligence | `preferredCtaWording`, `secondaryCta`, `contactFormUrl`, `onlineBookingAvailable` |
| Content Intelligence | `contentIntelligence` object |

Legacy sections (Business Information, Professional Review, etc.) remain unchanged.

---

## Per-service delivery profile

Stored at `serviceDeliveryProfiles[serviceId]`:

| Field | Type |
|-------|------|
| `fundingModel` | `nhs` \| `private` \| `mixed` \| `unknown` |
| `appointmentRequired` | boolean \| null |
| `walkInAvailable` | boolean \| null |
| `consultationLengthMinutes` | number \| null |
| `consultationLengthLabel` | string |
| `equipmentUsed` | string[] |
| `preparationRequired` | string[] |
| `aftercare` | string[] |
| `resultsProcess` | string |
| `referralProcess` | string |
| `pricing` | string |
| `ageRestrictions` | string |

Service IDs are unioned from `selectedServices`, `priorityServices`, `detectedWebsiteServices`, and existing `serviceDeliveryProfiles` keys.

---

## Field mapping → BusinessProfileIntelligence

| Intelligence section | Phase 2 profile source |
|---------------------|------------------------|
| `identity.tagline` | `tagline` → fallback `footerText` |
| `identity.businessDescription` | `businessDescription` → fallback USP |
| `identity.pharmacistTeam` | `pharmacistTeamMembers[]` |
| `brand.heroStyle` | `heroStyle` → fallback `pageStyle` |
| `location.countiesCovered` | `countiesCovered[]` |
| `location.parking` | `parkingInfo` |
| `services.byServiceId.*` | `serviceDeliveryProfiles[serviceId]` |
| `team.meetTheTeamIntro` | `meetTheTeamIntro` → fallback `reviewerBio` |
| `team.members` | `teamMembers[]` → fallback reviewer fields |
| `trust.awards` | `awards[]` |
| `trust.testimonials` | `testimonials[]` |
| `conversion.secondaryCta` | `secondaryCta` |
| `content.*` | `contentIntelligence` object |

When V2 fields are empty, `buildBusinessProfileIntelligenceFromProfile()` continues Phase 1 legacy inference.

---

## Backwards compatibility

- Existing `dhmdigital.json` / `pharmaconnect.json` load without migration scripts.
- Missing V2 fields receive defaults from `defaultPharmacyProfileV2Extension()`.
- Flat legacy fields (`preferredCta`, `tone`, `accreditations`, etc.) remain authoritative and sync with V2 where duplicated.
- Profile save API unchanged — `normalizeProfileData()` merges V2 on every read/write.

---

## Explicit non-goals (Phase 2)

- ❌ Wire intelligence into `buildContentGenerationContext`
- ❌ Change service pages, long-form, or local cluster output
- ❌ Modify approval gates, deployment, registry, health audit
- ❌ Change dashboard analytics / completeness scoring

---

## Phase 3 preview

1. Build `BusinessProfileIntelligence` once per package generation.
2. Pass intelligence into content engine instead of ad-hoc profile reads.
3. Replace hard-coded assumptions with `intelligence.ai.profileFirstFields` guardrails.

See also: [BUSINESS-PROFILE-INTELLIGENCE-V2-PHASE-1.md](./BUSINESS-PROFILE-INTELLIGENCE-V2-PHASE-1.md)
