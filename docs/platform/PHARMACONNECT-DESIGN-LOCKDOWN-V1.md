# PharmaConnect Design Lockdown V1 — Service Page Template

**Generated:** 2026-06-23T11:00:33.670Z  
**Template ID:** `lockdown-v1`  
**Slug:** pharmaconnect  
**Output root:** `output/pharmacy-visual-experience/pharmaconnect/`  
**Architecture:** LSE cluster template (web-design-rotherham)

---

## Summary

| Service | Visual preview | Before (master publish) | Image assets | Layout validation |
|---------|----------------|-------------------------|--------------|-------------------|
| Pharmacy First | [Visual](/api/pharmacy-visual-experience/pharmacy-first/) | [/before/](/api/pharmacy-visual-experience/pharmacy-first/before/) | 4/4 | PASS |
| Blood Pressure Checks | [Visual](/api/pharmacy-visual-experience/blood-pressure-checks/) | [/before/](/api/pharmacy-visual-experience/blood-pressure-checks/before/) | 4/4 | PASS |
| Travel Vaccinations | [Visual](/api/pharmacy-visual-experience/travel-vaccinations/) | [/before/](/api/pharmacy-visual-experience/travel-vaccinations/before/) | 4/4 | PASS |
| Emergency Contraception | [Visual](/api/pharmacy-visual-experience/emergency-contraception/) | [/before/](/api/pharmacy-visual-experience/emergency-contraception/before/) | 4/4 | PASS |

---

## Before / after

| Aspect | Before (master publish) | After (visual experience V3) |
|--------|-------------------------|------------------------------|
| Layout engine | Linear master sections | LSE cluster page architecture |
| Hero | Text-only band | 50/50 hero-grid with hero image |
| Feature cards | None | 4-card grid below hero |
| Quick answer | Full §1 prose block | Compare layout, max 3 paragraphs |
| Service breakdown | Paragraph list | grid-3 card layout |
| Support imagery | None | Full-width support-block-media band |
| Process | Prose section | grid-4 step timeline |
| Benefits | Multiple prose sections | timeline card grid |
| Safety | Standard section | impact dark panel |
| Trust | Text blocks | about-card split + trust-block-media |
| FAQ | details/summary | cluster-faq-item cards |
| Local | Text only | Local grid + map placeholder |
| Final CTA | Text block | conversion image + cta-band |

**Content:** Unchanged — all master prose, FAQs, trust copy, and CTAs preserved from `output/pharmacy-master-publish/`.

---

## Image slot mapping

### Pharmacy First (`pharmacy-first`)

| Slot | Library ref | Asset path | On disk | Alt text |
|------|-------------|------------|---------|----------|
| hero | `clinical-nhs-services/pharmacy-first` | `assets/pharmacy-image-library/clinical-nhs-services/pharmacy-first.svg` | Yes | Pharmacy First consultation at Brook Pharmacy in Rotherham |
| support | `clinical-nhs-services/blood-pressure-check` | `assets/pharmacy-image-library/clinical-nhs-services/blood-pressure-check.svg` | Yes | NHS blood pressure check at Brook Pharmacy in Rotherham |
| trust | `core-pharmacy/community-pharmacy` | `assets/pharmacy-image-library/core-pharmacy/community-pharmacy.svg` | Yes | Brook Pharmacy community pharmacy in Rotherham |
| conversion | `core-pharmacy/prescription-collection` | `assets/pharmacy-image-library/core-pharmacy/prescription-collection.svg` | Yes | Prescription collection at Brook Pharmacy in Rotherham |

**Preview:** `/api/pharmacy-visual-experience/pharmacy-first/`  
**Before:** `/api/pharmacy-visual-experience/pharmacy-first/before/`  
**Output:** `/home/inboxingproweb/pharmaconnect-growth-engine/output/pharmacy-visual-experience/pharmaconnect/pharmacy-first/index.html`

### Blood Pressure Checks (`blood-pressure-checks`)

| Slot | Library ref | Asset path | On disk | Alt text |
|------|-------------|------------|---------|----------|
| hero | `clinical-nhs-services/blood-pressure-check` | `assets/pharmacy-image-library/clinical-nhs-services/blood-pressure-check.svg` | Yes | NHS blood pressure check at Brook Pharmacy in Rotherham |
| support | `core-pharmacy/pharmacist-consultation` | `assets/pharmacy-image-library/core-pharmacy/pharmacist-consultation.svg` | Yes | Pharmacist consultation for Blood Pressure Checks at Brook Pharmacy in Rotherham |
| trust | `core-pharmacy/community-pharmacy` | `assets/pharmacy-image-library/core-pharmacy/community-pharmacy.svg` | Yes | Brook Pharmacy community pharmacy in Rotherham |
| conversion | `core-pharmacy/prescription-collection` | `assets/pharmacy-image-library/core-pharmacy/prescription-collection.svg` | Yes | Prescription collection at Brook Pharmacy in Rotherham |

**Preview:** `/api/pharmacy-visual-experience/blood-pressure-checks/`  
**Before:** `/api/pharmacy-visual-experience/blood-pressure-checks/before/`  
**Output:** `/home/inboxingproweb/pharmaconnect-growth-engine/output/pharmacy-visual-experience/pharmaconnect/blood-pressure-checks/index.html`

### Travel Vaccinations (`travel-vaccinations`)

| Slot | Library ref | Asset path | On disk | Alt text |
|------|-------------|------------|---------|----------|
| hero | `travel-health-services/travel-vaccination` | `assets/pharmacy-image-library/travel-health-services/travel-vaccination.svg` | Yes | Travel vaccinations at Brook Pharmacy in Rotherham |
| support | `travel-health-services/travel-consultation` | `assets/pharmacy-image-library/travel-health-services/travel-consultation.svg` | Yes | Travel health consultation at Brook Pharmacy in Rotherham |
| trust | `travel-health-services/destination-advice` | `assets/pharmacy-image-library/travel-health-services/destination-advice.svg` | Yes | Destination travel advice at Brook Pharmacy in Rotherham |
| conversion | `travel-health-services/malaria-advice` | `assets/pharmacy-image-library/travel-health-services/malaria-advice.svg` | Yes | Malaria advice at Brook Pharmacy in Rotherham |

**Preview:** `/api/pharmacy-visual-experience/travel-vaccinations/`  
**Before:** `/api/pharmacy-visual-experience/travel-vaccinations/before/`  
**Output:** `/home/inboxingproweb/pharmaconnect-growth-engine/output/pharmacy-visual-experience/pharmaconnect/travel-vaccinations/index.html`

### Emergency Contraception (`emergency-contraception`)

| Slot | Library ref | Asset path | On disk | Alt text |
|------|-------------|------------|---------|----------|
| hero | `clinical-nhs-services/contraception-service` | `assets/pharmacy-image-library/clinical-nhs-services/contraception-service.svg` | Yes | Pharmacy contraception service at Brook Pharmacy in Rotherham |
| support | `core-pharmacy/pharmacist-consultation` | `assets/pharmacy-image-library/core-pharmacy/pharmacist-consultation.svg` | Yes | Pharmacist consultation for Emergency Contraception at Brook Pharmacy in Rotherham |
| trust | `core-pharmacy/community-pharmacy` | `assets/pharmacy-image-library/core-pharmacy/community-pharmacy.svg` | Yes | Brook Pharmacy community pharmacy in Rotherham |
| conversion | `core-pharmacy/prescription-collection` | `assets/pharmacy-image-library/core-pharmacy/prescription-collection.svg` | Yes | Prescription collection at Brook Pharmacy in Rotherham |

**Preview:** `/api/pharmacy-visual-experience/emergency-contraception/`  
**Before:** `/api/pharmacy-visual-experience/emergency-contraception/before/`  
**Output:** `/home/inboxingproweb/pharmaconnect-growth-engine/output/pharmacy-visual-experience/pharmaconnect/emergency-contraception/index.html`


---

## Preview URLs

| Page | URL |
|------|-----|
| Index | `/api/pharmacy-visual-experience` |
| Pharmacy First | `/api/pharmacy-visual-experience/pharmacy-first/` |
| Blood Pressure Checks | `/api/pharmacy-visual-experience/blood-pressure-checks/` |
| Travel Vaccinations | `/api/pharmacy-visual-experience/travel-vaccinations/` |
| Emergency Contraception | `/api/pharmacy-visual-experience/emergency-contraception/` |

---

## Build command

```bash
npx tsx scripts/build-pharmacy-visual-experience-v1.ts
```
