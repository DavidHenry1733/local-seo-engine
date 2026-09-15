# Pharmacy Visual Experience V1

**Generated:** 2026-06-23T08:42:21.965Z  
**Slug:** pharmaconnect  
**Output root:** `output/pharmacy-visual-experience/pharmaconnect/`

---

## Summary

| Service | Visual preview | Before (master publish) | Image assets |
|---------|----------------|-------------------------|--------------|
| Pharmacy First | [Visual](/api/pharmacy-visual-experience/pharmacy-first/) | [/before/](/api/pharmacy-visual-experience/pharmacy-first/before/) | 4/4 |
| Blood Pressure Checks | [Visual](/api/pharmacy-visual-experience/blood-pressure-checks/) | [/before/](/api/pharmacy-visual-experience/blood-pressure-checks/before/) | 4/4 |
| Travel Vaccinations | [Visual](/api/pharmacy-visual-experience/travel-vaccinations/) | [/before/](/api/pharmacy-visual-experience/travel-vaccinations/before/) | 4/4 |
| Emergency Contraception | [Visual](/api/pharmacy-visual-experience/emergency-contraception/) | [/before/](/api/pharmacy-visual-experience/emergency-contraception/before/) | 4/4 |

---

## Before / after

| Aspect | Before (master publish) | After (visual experience) |
|--------|-------------------------|---------------------------|
| Global header | Basic site-header + trust bar | Full nav header with FAQs link + Book CTA |
| Global footer | Minimal preview footer | Three-column site footer with badges |
| Hero | Text-only hero band | Hero grid with hero image slot |
| Support imagery | None | Support image band after §3 |
| Trust imagery | Trust layer text only | Trust image band + trust strip |
| Conversion imagery | CTA text only | Conversion image band before CTA |
| FAQ | Accordion (base styles) | Enhanced accordion styling |
| Demo trust banner | Visible yellow banner | Hidden for screenshot readiness |
| Responsive | Partial | Full mobile breakpoints |

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
