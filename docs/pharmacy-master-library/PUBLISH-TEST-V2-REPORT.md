# Master → Publish Test V2 Report

**Pharmacy:** Brook Pharmacy (`pharmaconnect`)  
**Local target:** Rotherham  
**Generated:** 2026-06-22T15:36:10.762Z  
**Renderer:** `pharmacyMasterPublishRenderer.ts` (master-library only — no `pharmacyServicePageGenerator`)

---

## Summary

| Service | Source master | Words before | Words after | Duplication | Verdict |
|---------|---------------|--------------|-------------|-------------|---------|
| Repeat Prescriptions | `repeat-prescriptions-master-v2.md` | 2709 | 3112 | NO | PASS |
| Travel Vaccinations | `travel-vaccinations-master-v1.md` | 2867 | 3032 | NO | PASS |
| Emergency Contraception | `emergency-contraception-master-v1.md` | 2636 | 2957 | NO | PASS |

**Overall:** **PASS** — all three pages ready for owner review

---

## Per-page validation

### Repeat Prescriptions

**URL:** `/repeat-prescriptions/`  
**Output:** `output/pharmacy-publish/pharmaconnect/repeat-prescriptions/index.html`

| Metric | Value |
|--------|-------|
| Source master | `repeat-prescriptions-master-v2.md` |
| Word count before publish | 2,709 |
| Word count after publish | 3,112 |
| Duplication introduced | **NO** |

#### Trust elements injected

- Pharmacy name: Brook Pharmacy
- GPhC premises: 9012345
- Superintendent: Demo Superintendent Pharmacist
- Contact: 01709 210731
- Private consultation room
- Local coverage: Bradgate, Brightside, Brinsworth, Clifton
- Company: Brook Pharmacy Ltd

#### Local elements injected

- Town anchor: Rotherham
- Access-only copy — address, phone booking, coverage areas
- No service definition repeated from master §1

#### Quality assessment

PASS — Master clinical prose preserved with profile injection only. Trust and local layers add accountability and access context without duplicating master content.

#### Quality degradation

- None

#### Duplication notes

- None

### Travel Vaccinations

**URL:** `/travel-vaccinations/`  
**Output:** `output/pharmacy-publish/pharmaconnect/travel-vaccinations/index.html`

| Metric | Value |
|--------|-------|
| Source master | `travel-vaccinations-master-v1.md` |
| Word count before publish | 2,867 |
| Word count after publish | 3,032 |
| Duplication introduced | **NO** |

#### Trust elements injected

- Pharmacy name: Brook Pharmacy
- GPhC premises: 9012345
- Superintendent: Demo Superintendent Pharmacist
- Contact: 01709 210731
- Private consultation room
- Local coverage: Bradgate, Brightside, Brinsworth, Clifton
- Company: Brook Pharmacy Ltd

#### Local elements injected

- Town anchor: Rotherham
- Access-only copy — address, phone booking, coverage areas
- No service definition repeated from master §1

#### Quality assessment

PASS — Master clinical prose preserved with profile injection only. Trust and local layers add accountability and access context without duplicating master content.

#### Quality degradation

- None

#### Duplication notes

- None

### Emergency Contraception

**URL:** `/emergency-contraception/`  
**Output:** `output/pharmacy-publish/pharmaconnect/emergency-contraception/index.html`

| Metric | Value |
|--------|-------|
| Source master | `emergency-contraception-master-v1.md` |
| Word count before publish | 2,636 |
| Word count after publish | 2,957 |
| Duplication introduced | **NO** |

#### Trust elements injected

- Pharmacy name: Brook Pharmacy
- GPhC premises: 9012345
- Superintendent: Demo Superintendent Pharmacist
- Contact: 01709 210731
- Private consultation room
- Local coverage: Bradgate, Brightside, Brinsworth, Clifton
- Company: Brook Pharmacy Ltd

#### Local elements injected

- Town anchor: Rotherham
- Access-only copy — address, phone booking, coverage areas
- No service definition repeated from master §1

#### Quality assessment

PASS — Master clinical prose preserved with profile injection only. Trust and local layers add accountability and access context without duplicating master content.

#### Quality degradation

- None

#### Duplication notes

- None


---

## Build constraints verified

| Constraint | Status |
|------------|--------|
| Master content only (no blueprint expansion) | Yes |
| Trust layer from profile | Yes |
| Local relevance layer (access only) | Yes |
| CTA layer from master §13 + owner variables | Yes |
| No area pages / hubs / clusters / variants | Yes — 3 root pages only |
| §8 Common Misconceptions excluded | Yes |
| §12 GPhC deduped when trust layer present | Yes |
| Legacy `pharmacyServicePageGenerator` not used | Yes |

---

## Published outputs

- [`/repeat-prescriptions/`](../../output/pharmacy-publish/pharmaconnect/repeat-prescriptions/index.html) ← `/home/inboxingproweb/pharmaconnect-growth-engine/output/pharmacy-master-publish/pharmaconnect/repeat-prescriptions/index.html`
- [`/travel-vaccinations/`](../../output/pharmacy-publish/pharmaconnect/travel-vaccinations/index.html) ← `/home/inboxingproweb/pharmaconnect-growth-engine/output/pharmacy-master-publish/pharmaconnect/travel-vaccinations/index.html`
- [`/emergency-contraception/`](../../output/pharmacy-publish/pharmaconnect/emergency-contraception/index.html) ← `/home/inboxingproweb/pharmaconnect-growth-engine/output/pharmacy-master-publish/pharmaconnect/emergency-contraception/index.html`
