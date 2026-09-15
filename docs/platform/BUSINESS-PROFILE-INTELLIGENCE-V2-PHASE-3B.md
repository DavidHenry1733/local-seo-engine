# Business Profile Intelligence V2 — Phase 3B (Service Page Integration)

**Status:** Visual service page generator only — long-form, cluster pages, and dashboard unchanged.

---

## What Phase 3B adds

The visual service page pipeline (`pharmacyVisualExperience.ts` → `buildPharmacyServicePageMainHtml`) builds `ContentGenerationContext` once per page and passes `businessProfileIntelligence` into profile-driven sections.

### New / updated modules

| Path | Role |
|------|------|
| `src/pharmacy/pharmacyServicePageIntelligence.ts` | Service page phrase/section helpers (reuses long-form phrase module) |
| `src/pharmacy/pharmacyServicePageTrustInjection.ts` | Hero, trust cards, local, CTA — optional `contentContext` |
| `src/pharmacy/pharmacyVisualExperienceLayoutV3.ts` | Section slots consume intelligence |
| `src/pharmacy/pharmacyVisualExperience.ts` | Builds context and passes to renderer |

### Sections enriched

| Template slot | Intelligence used |
|---------------|-------------------|
| Hero | Tagline, business description, team phrasing, preferred CTA |
| Trust cards | Awards, accreditations, review highlights, years serving, prescriber |
| Service definition | Pricing, results process |
| Process grid | Consultation room, length, walk-in, preparation, equipment |
| Support band | Preparation, equipment, consultation room |
| Trust split | Years serving, testimonials, prescriber |
| FAQs | Profile-backed booking, parking, walk-in, languages, pricing, etc. |
| Local access | Parking, wheelchair access, languages |
| Final CTA | Booking method, walk-in, online booking |

---

## Guardrails

- Profile-first: phrase helpers return nothing when data is absent → legacy copy preserved.
- Layout, styling, schema, internal links, CTA placement, and approval gates unchanged.
- Long-form engine not modified.

---

## Validation

```bash
npx tsx scripts/validate-business-profile-intelligence-v2-phase3b-service-page-v1.ts
npx tsx scripts/validate-pharmacy-visual-template-regression-v2.ts dhmdigital
npx tsx scripts/validate-pharmacy-long-form-supporting-content-quality-v1.ts
npx tsx scripts/validate-business-profile-intelligence-v2-phase3a-long-form-v1.ts
```

---

## Explicit non-goals (Phase 3B)

- ❌ Local cluster pages
- ❌ Long-form supporting content engine
- ❌ Dashboard / profile schema

See also: [Phase 3A](./BUSINESS-PROFILE-INTELLIGENCE-V2-PHASE-3A.md)
