# Service Registration Framework

**Status:** ACTIVE  
**Framework ID:** `CPR-SERVICE-REGISTRATION-01`  
**Architecture:** RC1 (see `RC1-PLATFORM-LOCK.md`)  
**Purpose:** One canonical registration path so every future pharmacy service becomes generation-ready without modifying locked platform engines.

---

## 1. Rule

A service is **Ready** only when every required registration is complete.

Incomplete services remain **Setup Required** and must not be selectable in Create Campaign.

No future service may bypass this framework.

---

## 2. Required registrations

| # | Registration | What must exist |
| --- | --- | --- |
| 1 | Commercial registration | Locked commercial catalogue entry (`locked: true`) |
| 2 | Service metadata | Publish meta: `serviceId`, `serviceName`, `urlPath` |
| 3 | Evidence schema | Evidence / publish meta registration for Service Evidence |
| 4 | Master content registration | Master library file present at configured `masterFile` |
| 5 | Visual Experience registration | Visual Experience benchmark + service config registration |
| 6 | Generation registration | Service-page generation configuration (`masterFile`, `urlPath`, `ctaHeading`) |
| 7 | Locality support | Service locality content bank (variant pack) for the service |
| 8 | FAQ bank | Service FAQ content sources in the locality / variant pack |
| 9 | CTA bank | Service CTA (+ intro) content sources in the locality / variant pack |
| 10 | Image compatibility | Image platform service catalogue + shared library fallback compatibility |
| 11 | Readiness validation | Shared registration evaluation reports all prior registrations complete |

---

## 3. Registration order

Onboard services in this order. Later steps assume earlier steps exist.

```
1. Commercial registration
2. Service metadata
3. Evidence schema
4. Master content registration
5. Visual Experience registration
6. Generation registration
7. Locality support
8. FAQ bank
9. CTA bank
10. Image compatibility
11. Readiness validation
```

Do not create Product Owner campaigns for a service until step 11 reports Ready.

---

## 4. Readiness rules

| Status | Meaning | Create Campaign |
| --- | --- | --- |
| Ready | Every required registration is complete | Selectable |
| Setup Required | One or more registrations missing | Not selectable; missing registrations shown |

Responsible implementation:

| Concern | Module | Function |
| --- | --- | --- |
| Registration checklist | `src/pharmacy/masterAdminServiceRegistrationFramework.ts` | `evaluateServiceRegistration` |
| Readiness projection | `src/pharmacy/masterAdminServiceGenerationReadinessService.ts` | `resolveServiceGenerationReadiness` |
| Create Campaign options | `artifacts/api-server/src/routes/masterAdminPlatformPage.ts` | `renderLockedServiceOptions` |
| Create Campaign API gate | `artifacts/api-server/src/routes/api/masterAdminPlatform.ts` | `POST .../campaigns/create` |

---

## 5. Validation rules

1. Evaluate only locked commercial catalogue services.
2. Do not invent silent fallbacks across services.
3. Missing Visual Experience registration is a hard fail (service cannot generate).
4. Missing master content registration is a hard fail.
5. FAQ bank and CTA bank are evaluated separately.
6. Readiness validation is true only when registrations 1–10 are all true.
7. Existing Ready services must remain Ready unless their registered assets are removed.
8. Do not generate pages as part of registration validation.

---

## 6. Generation prerequisites

Before Product Owner generation is allowed for a service:

1. Registration status = **Ready**
2. Campaign created from Create Campaign (ready services only)
3. Evidence Review completed / approved for that campaign
4. Explicit Generate Service Page confirmation invokes the canonical generation endpoint

Registration readiness does **not** replace Evidence Approval. It only proves the shared service package can support generation.

---

## 7. RC1 reference services

The framework must recognise these RC1-accepted services as **Ready**:

| Service | Service ID |
| --- | --- |
| Pharmacy First | `pharmacy-first` |
| Travel Vaccinations | `travel-vaccinations` |
| Blood Pressure Checks | `blood-pressure-checks` |
| Flu Vaccinations | `flu-vaccinations` |

Incomplete locked services must remain **Setup Required** until their missing registrations are supplied through this framework — not by modifying locked engines.

---

## 8. Operating rule

Tomorrow’s onboarding work:

1. Complete the registration checklist for the next service.
2. Confirm `evaluateServiceRegistration` / readiness resolver reports **Ready**.
3. Create Campaign and run the locked RC1 Product Owner workflow.
4. Do not redesign Campaign Manager, Workflow, Content Engine, Locality Engine, Design System, Image Platform, or Publishing to accommodate one service.
