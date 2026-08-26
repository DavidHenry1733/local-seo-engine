# RC1 Platform Lock

**Status:** LOCKED  
**Architecture version:** RC1  
**Locked date:** 2026-08-06  
**Purpose:** Freeze the shared PharmaConnect Growth Engine architecture so subsequent work is pure service onboarding — not platform redesign.

---

## 1. Lock declaration

From this document forward:

- The shared campaign, evidence, generation, and presentation architecture is **LOCKED**.
- New commercial services must onboard through the **canonical onboarding checklist** only.
- No future service may bypass readiness validation or invent a parallel workflow.
- Polish items listed in this document are **backlog only** — they must not reopen locked architecture.

Do not modify locked components during service onboarding unless a separate unlock ticket explicitly authorises it.

---

## 2. Architecture version

| Field | Value |
| --- | --- |
| Platform lock ID | `CPR-RC1-PLATFORM-LOCK-01` |
| Architecture version | `RC1` |
| Product surface | Master Admin Product Owner workflow |
| Validation tenant | Leeds Pharmacy (`leeds-pharmacy`) |
| Campaign OS | Service Campaign Manager (per-service campaigns) |
| Workflow state machine | Campaign-state → Product Owner workflow resolver → displayed actions |
| Generation control | Explicit Product Owner confirm → canonical job queue |
| Readiness gate | Shared service generation-readiness resolver |

---

## 3. Locked components

### 3.1 Campaign platform — LOCKED

| Component | Lock |
| --- | --- |
| Campaign Manager | LOCKED |
| Product Owner Workflow | LOCKED |
| Campaign State Resolver | LOCKED |
| Generation Handoff | LOCKED |
| Regeneration | LOCKED |
| Campaign Readiness Resolver | LOCKED |
| Business Profile inheritance | LOCKED |

### 3.2 Evidence — LOCKED

| Component | Lock |
| --- | --- |
| Evidence Review | LOCKED |
| Evidence Approval | LOCKED |
| Evidence Persistence | LOCKED |
| Generation prerequisites | LOCKED |

### 3.3 Generation — LOCKED

| Component | Lock |
| --- | --- |
| Service generation | LOCKED |
| Locality generation | LOCKED |
| Shared content routing | LOCKED |
| Shared locality routing | LOCKED |
| Service content banks | LOCKED |
| Locality evidence allocator | LOCKED |
| FAQ routing | LOCKED |
| CTA routing | LOCKED |

### 3.4 Presentation — LOCKED

| Component | Lock |
| --- | --- |
| Layout V3 | LOCKED |
| Typography contract | LOCKED |
| Spacing contract | LOCKED |
| Reading-width contract | LOCKED |
| Alignment contract | LOCKED |
| Shared image platform | LOCKED |
| Shared fallback resolver | LOCKED |

---

## 4. Locked Product Owner workflow

The following sequence is the **canonical RC1 Product Owner workflow**. It must not be altered during service onboarding.

```
Create Campaign
↓
Evidence Review
↓
Approve Evidence
↓
Generate Service Page
↓
Review Service Page
↓
Generate Locality Pages
↓
Review Locality Pages
↓
Approve
↓
Publish
```

### Workflow rules (locked)

1. Campaign creation selects only **generation-ready** locked commercial services.
2. Generation runs only after explicit Product Owner confirmation.
3. Displayed actions are driven by **campaign state** via the campaign state resolver — not legacy publish/preview/generation flags.
4. Regeneration preserves prior revision safety behaviour already shipped in RC1.
5. Publish remains a later gated stage; onboarding must not invent a shortcut around review.

---

## 5. Canonical service onboarding checklist

Every future service must provide **all** of the following before it may be created as a Product Owner campaign:

| # | Requirement | Meaning |
| --- | --- | ---: |
| 1 | Commercial registration | Locked commercial catalogue entry |
| 2 | Master content | Master library package present for the service |
| 3 | Evidence definition | Service evidence / publish meta registration |
| 4 | Visual Experience registration | Visual Experience benchmark / service config registration |
| 5 | Generation registration | Service-page generation configuration complete |
| 6 | Locality support | Locality content bank or explicit locality support status |
| 7 | FAQ bank | Service FAQ content sources present |
| 8 | CTA bank | Service CTA content sources present |
| 9 | Image compatibility | Image platform catalogue + fallback compatibility |
| 10 | Readiness validation | Shared readiness resolver reports **Ready** |

**Hard rule:** No future service may bypass this checklist. Incomplete services must appear as **Setup Required** and remain non-selectable in Create Campaign.

Responsible resolver: `resolveServiceGenerationReadiness`  
Responsible module: `src/pharmacy/masterAdminServiceGenerationReadinessService.ts`

---

## 6. Accepted RC1 services

Validated end-to-end on Leeds Pharmacy. These services are **RC1 accepted**.

| Service | Service ID | RC1 status |
| --- | --- | --- |
| Pharmacy First | `pharmacy-first` | ACCEPTED |
| Travel Vaccinations | `travel-vaccinations` | ACCEPTED |
| Blood Pressure Checks | `blood-pressure-checks` | ACCEPTED |
| Flu Vaccinations | `flu-vaccinations` | ACCEPTED |

Acceptance meaning for RC1:

- Generation-ready in the shared readiness resolver
- Service campaign operable under the locked Product Owner workflow
- Service page generation and locality generation path proven on the validation tenant
- Shared architecture used without service-specific platform forks

### Not yet accepted (example incomplete registrations)

These remain outside RC1 acceptance until the onboarding checklist is fully satisfied:

| Service | Service ID | Notes |
| --- | --- | --- |
| Prescription Dispensing | `prescription-dispensing` | Setup Required — missing visual-experience registration |
| Emergency Contraception | `emergency-contraception` | Setup Required — incomplete checklist assets |
| Repeat Prescriptions | `repeat-prescriptions` | Setup Required — incomplete checklist assets |

---

## 7. Known polish backlog

**Do not repair as part of this lock.** Record only:

| Backlog item | Category |
| --- | --- |
| Nearby areas beside maps | Presentation polish |
| Minor alignment polish | Presentation polish |
| Minor spacing polish | Presentation polish |
| Image library expansion | Image platform content |
| Mobile polish | Presentation polish |
| CTA refinement | Content / presentation polish |

Polish work must not reopen locked campaign, evidence, generation, or Layout V3 architecture.

---

## 8. RC1 acceptance criteria

RC1 platform lock is accepted when all of the following are true:

1. **Campaign platform operational** — Create Campaign, campaign selection, and Business Profile inheritance work for ready services.
2. **Readiness gate operational** — Incomplete services are disabled with missing components visible; ready services are selectable.
3. **Workflow operational** — Canonical Product Owner sequence above is the only supported RC1 path.
4. **Generation handoff operational** — Generate Service Page invokes the canonical confirm endpoint and queues exactly one job.
5. **State resolver operational** — Post-generation actions follow campaign state (`SERVICE_NOT_GENERATED` → `SERVICE_GENERATED` → `LOCALITIES_GENERATED`).
6. **Four services accepted** — Pharmacy First, Travel Vaccinations, Blood Pressure Checks, Flu Vaccinations.
7. **Shared architecture frozen** — Content Engine, Locality Engine, Design System, Image Platform, Layout V3, Typography, Campaign workflow, Generation workflow, Publishing, and Search Console are not reopened for onboarding.
8. **Onboarding path clear** — Future services enter only through the canonical checklist and readiness validation.

---

## 9. Operating rule for tomorrow

Tomorrow’s work is **pure service onboarding**:

1. Satisfy the onboarding checklist for the next service.
2. Confirm readiness resolver reports **Ready**.
3. Create Campaign and execute the locked Product Owner workflow.
4. Do not redesign shared architecture to accommodate a single service.

---

## 10. Unlock policy

Any change to a locked component requires:

1. An explicit unlock ticket naming the component
2. Product Owner approval that the change is platform-level, not onboarding convenience
3. An update to this lock document with architecture version increment

Until then: **RC1 PLATFORM LOCKED**.
