# Growth Engine — Product Reset Sprint V1

**Sprint:** Product Reset Sprint V1  
**Feature freeze:** Active — customer experience only, no new engines  
**Date:** July 2026

---

## Objective

Redesign the customer experience around **four commercial reports** so a pharmacy owner understands the platform in under five minutes:

1. **Your Pharmacy** — where they stand (import-first)
2. **Your Local Market** — how they compare
3. **Your Website Report** — what is missing
4. **Your Growth Plan** — what to do next (one campaign)

---

## What changed (presentation only)

| Area | Before | After |
|------|--------|-------|
| Step 1 | Business Intelligence | **Your Pharmacy** |
| Step 2 | Local Healthcare Intelligence | **Your Local Market** |
| Step 3 | Website Intelligence | **Your Website Report** |
| Step 4 | Growth Intelligence (customer step) | **Hidden from stepper** — evidence feeds Growth Plan |
| Step 5 | Growth Plan | **Your Growth Plan** |
| Website nav | → Growth Intelligence | → **Your Growth Plan** |
| Technical overview | Schema, Canonical, Meta… | **Plain English** (“What this means for your pharmacy”) |
| Local market | Ecosystem-first | **Comparison report** + recommendations |
| Pharmacy profile | Imported / Confirmed | + **Needs Review** badge |

---

## What did NOT change

- Business Profile Intelligence (wizard, scoring, import logic)
- Content generators
- Approval engine
- Publishing engine, FTP, deployment
- Registry, lifecycle, health audit
- Dashboard analytics (Founder Partner workflow)
- API routes and step IDs (internal URLs unchanged)
- Generation workflow (`/api/pharmacy-content-package`)

---

## Customer journey (under 5 minutes)

```
Your Pharmacy → Your Local Market → Your Website Report → Your Growth Plan → Create Content
```

Each report answers one question:

| Report | Question |
|--------|----------|
| Your Pharmacy | Is my business profile correct? |
| Your Local Market | How do I compare locally? |
| Your Website Report | What content do I have / miss? |
| Your Growth Plan | What campaign should I run next? |

---

## Validation

```bash
npx tsx scripts/validate-growth-engine-product-reset-v1.ts
```

Regression:

```bash
npx tsx scripts/validate-growth-engine-framework-v1.ts
npx tsx scripts/validate-growth-engine-founder-partner-dashboard-v1.ts
npx tsx scripts/validate-growth-engine-operational-completion-v1.ts
```

Checks confirm:

- No technical SEO terminology in customer HTML (schema, canonical, meta, breadcrumb, entity)
- Four commercial reports titled and navigable
- Growth Intelligence hidden from customer stepper
- Wizard, publishing API, and generation workflow unchanged
