# Business Profile Intelligence V2 — Phase 3A (Long-Form Generator Integration)

**Status:** Long-form supporting content engine only — service pages, cluster pages, and other generators unchanged.

---

## What Phase 3A adds

`ContentGenerationContext` now includes `businessProfileIntelligence`, built once in `buildContentGenerationContext()`. The long-form engine (`pharmacyLongFormContentEngine.ts`) consumes intelligence **profile-first** and falls back to legacy copy when fields are empty.

### New / updated modules

| Path | Role |
|------|------|
| `src/pharmacy/contentEngine/buildContentGenerationContext.ts` | Builds `businessProfileIntelligence` per context |
| `src/pharmacy/contentEngine/contentGenerationContextTypes.ts` | `businessProfileIntelligence` on context type |
| `src/pharmacy/contentEngine/pharmacyLongFormIntelligencePhrases.ts` | Profile-backed phrase helpers (null = use legacy) |
| `src/pharmacy/contentEngine/pharmacyLongFormContentEngine.ts` | Guides, blogs, FAQs wired to intelligence |

### Intelligence sections used in long-form

| Section | Long-form usage |
|---------|-----------------|
| Business Identity | Guide intro (`tagline`, `businessDescription`) |
| Location | Parking, wheelchair access |
| Service Intelligence | Consultation length, walk-in, pricing, equipment, preparation, aftercare, results |
| Team | “Our pharmacist team” phrasing, languages |
| Trust | Consultation room, years serving community |
| Conversion | Booking method, online booking CTA |
| Content | FAQ count preferences |

---

## Guardrails

- Intelligence is the **first source**; legacy strings used only when phrase helpers return `null`.
- **Never invent** parking, pricing, walk-in, consultation length, prescriber, or online booking without profile data.
- Clinical accuracy, reviewer attribution, CTA, internal links, section structure, validation, and approval gate are unchanged.

---

## Validation

```bash
npx tsx scripts/validate-business-profile-intelligence-v2-phase3a-long-form-v1.ts
npx tsx scripts/validate-pharmacy-long-form-supporting-content-quality-v1.ts
npx tsx scripts/validate-business-profile-intelligence-v2-architecture-v1.ts
```

---

## Explicit non-goals (Phase 3A)

- ❌ Service page renderer
- ❌ Local cluster renderer
- ❌ Dashboard / profile schema / save-load
- ❌ Other generators (`pharmacyMasterPublishRenderer`, etc.)

See also: [Phase 1](./BUSINESS-PROFILE-INTELLIGENCE-V2-PHASE-1.md) · [Phase 2](./BUSINESS-PROFILE-INTELLIGENCE-V2-PHASE-2.md)
