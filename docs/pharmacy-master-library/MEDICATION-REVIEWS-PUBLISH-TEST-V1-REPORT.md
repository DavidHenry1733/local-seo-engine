# Medication Reviews — Master → Publish Test V1

**Pharmacy:** Brook Pharmacy (`pharmaconnect`)  
**Local target:** Rotherham  
**URL:** `/medication-reviews/`  
**Source master:** `medication-reviews-master-v2.md`  
**Generated:** 2026-06-22T15:37:04.907Z

---

## 1. Final rendered section list

| # | Section | Source |
|---|---------|--------|
| 1 | Hero | Publish chrome — intro derived from master §1 opening paragraph |
| 2 | What Medication Reviews Are | Master §1 — medication-reviews-master-v2.md |
| 3 | Who Should Consider A Medication Review | Master §2 — medication-reviews-master-v2.md |
| 4 | NHS Pathways And Private Reviews | Master §3 — medication-reviews-master-v2.md |
| 5 | What Happens During The Review | Master §4 — medication-reviews-master-v2.md |
| 6 | What Your Review May Lead To | Master §5 — medication-reviews-master-v2.md |
| 7 | When A Medication Review Is Not Appropriate | Master §6 — medication-reviews-master-v2.md |
| 8 | Common Questions (FAQs) | Master §7 — medication-reviews-master-v2.md (accordion) |
| 9 | Patient Concerns | Master §9 — medication-reviews-master-v2.md |
| 10 | Why Patients Choose Medication Reviews | Master §10 — medication-reviews-master-v2.md |
| 11 | Why Patients Choose A Community Pharmacy | Master §11 — medication-reviews-master-v2.md |
| 12 | Trust And Safety | Master §12 — medication-reviews-master-v2.md |
| 13 | Booking And Next Steps | Master §13 — medication-reviews-master-v2.md |
| 14 | Trust Layer | pharmacyTrustLayer.ts — Brook Pharmacy profile (pharmaconnect.json) |
| 15 | Local Relevance — Rotherham | Publish local layer — profile address, coverage areas, access copy only |
| 16 | Booking CTA | Master §13 + owner variables — medication-reviews-master-v2.md |

**Excluded by design:** Master §8 Common Misconceptions (`publishDefault: false`)

---

## 2. Source of each section

See table above. Master sections 1–6 and 9–13 are copied from the V2 master with owner-variable injection only. No blueprint expansion, deep dives, authority insights, patient objections, conversion reassurance, or generic cards were used.

---

## 3. Added trust elements

- Pharmacy name: Brook Pharmacy
- GPhC premises: 9012345
- Superintendent: Demo Superintendent Pharmacist
- Contact: 01709 210731
- Private consultation room
- Local coverage: Bradgate, Brightside, Brinsworth, Clifton
- Company: Brook Pharmacy Ltd

Rendered via `renderPharmacyTrustLayerForSlug("pharmaconnect")` — GPhC panel, credential cards, superintendent and company accountability.

---

## 4. Added local elements

- Town anchor: Rotherham
- Access-only copy — address, phone booking, coverage areas
- No service definition repeated from master §1

---

## 5. Word count before publish

**2,413 words** — master publish sections (§1–7, §9–13) before owner-variable substitution.

---

## 6. Word count after publish

**2,749 words** — full rendered HTML patient-facing text including hero, trust layer, local layer, and CTA chrome.

---

## 7. Quality assessment

PASS — Master clinical prose preserved with profile injection only. Trust and local layers add accountability and access context without duplicating master content.

---

## 8. Quality degradation detected

- None detected

---

## Success criteria check

| Criterion | Result |
|-----------|--------|
| Single page only | Yes — `medication-reviews/index.html` |
| Master content preserved | Yes — §1–7, §9–13 from V2 master |
| Trust layer present | Yes — profile-driven |
| Local Rotherham relevance | Yes — access layer only |
| No forbidden generators | Yes — no blueprint / deep dive / authority / objections |
| Owner-publishable tone | Yes — pending owner variable confirmation |
