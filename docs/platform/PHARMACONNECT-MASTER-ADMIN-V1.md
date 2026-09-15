# PharmaConnect Master Admin Platform V1

The **Master Admin Platform** is the internal agency/operator portal used to manage all pharmacy clients enrolled in PharmaConnect. It is not the pharmacy-facing Growth Programme dashboard.

## Purpose

This is the foundation of the commercial platform:

- Manage unlimited pharmacy workspaces
- Provision new clients through a guided wizard
- Monitor portfolio health at a glance
- Open any client directly into their Growth Programme
- Archive or delete demo pharmacies
- Maintain complete tenant isolation

## Access

| Route | Audience |
|-------|----------|
| `/api/admin/pharmacies` | Admin users only |
| `/api/master-admin/*` | Admin JSON API |

Requires `admin` role (same auth as Team Members at `/api/admin/users`).

## Architecture

```
Master Admin UI (pharmacyMasterAdminPage.ts)
        │
        ├── pharmacyMasterAdminService.ts   ← portfolio, provisioning, archive
        │
        └── Existing slug-scoped modules
                ├── pharmacyProfiles (data/pharmacy-profiles/{slug}.json)
                ├── pharmacyCampaigns (data/pharmacy-campaigns/{slug}.json)
                ├── config/projects/{slug}.json
                └── Growth Programme dashboard (/api/pharmacy-dashboard?slug=)
```

Tenant isolation is **filesystem-scoped by slug**. Each pharmacy has its own profile, campaign store, project config, and output directories. No shared database rows.

Registry: `data/pharmacy-master-admin/registry.json`

## Master Admin Dashboard

The Client Portfolio page shows:

1. Summary cards — total clients and counts by stage
2. Search and stage filters
3. **+ Add New Pharmacy** wizard
4. Client cards with Open Pharmacy action

## Client Portfolio card

Each card displays:

| Field | Source |
|-------|--------|
| Pharmacy name | Profile |
| Logo | Profile `logoUrl` |
| Growth Plan | Registry tier (Starter / Professional / Complete) |
| Current Stage | Derived from platform OS state |
| Overall Progress | OS completion % |
| Outstanding Tasks | Customer experience view |
| Last Activity | Profile `updatedAt` |
| Open Pharmacy | Link to Growth Programme |

## Client stages

| Stage | Typical meaning |
|-------|-----------------|
| **Onboarding** | Early profile setup, no campaigns yet |
| **Building** | Campaigns in progress, pages being prepared |
| **Growing** | Published, building local presence |
| **Published** | Growth mode — monitoring and optimisation |
| **Needs Attention** | Stale campaigns or launch blockers |

## Add New Pharmacy wizard

| Step | Fields |
|------|--------|
| 1 — Business Information | Pharmacy name, website, contact email, telephone |
| 2 — Growth Plan | Starter / Professional / Complete |
| 3 — Location | Primary town, radius, suggested areas |
| 4 — Services | Enabled services from benchmark catalog |
| 5 — Review | Summary before creation |
| 6 — Create Pharmacy | Provisions workspace |

### Automatic provisioning

On create, the platform:

1. Resolves a unique slug from the pharmacy name
2. Creates `data/pharmacy-profiles/{slug}.json`
3. Creates `config/projects/{slug}.json`
4. Analyses website and imports branding (when URL provided)
5. Discovers suggested local areas
6. Creates campaign store with first Growth Plan placeholder
7. Registers client in master admin registry
8. Returns operator to Client Portfolio

No content generation engines are modified. Visual/ecosystem builds remain separate operator actions per slug.

## Demo pharmacies

Demo clients can be flagged during wizard step 1. Demo pharmacies may be **permanently deleted** (not just archived). Production clients are **archived** only — data files remain on disk but the client is hidden from the portfolio.

## API reference

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/master-admin/portfolio` | List clients with summary |
| GET | `/api/master-admin/pharmacies/:slug` | Single client card |
| POST | `/api/master-admin/pharmacies/preview-slug` | Preview slug from name |
| POST | `/api/master-admin/pharmacies/discover-areas` | Area suggestions for wizard |
| POST | `/api/master-admin/pharmacies/preview` | Review step summary |
| POST | `/api/master-admin/pharmacies` | Create pharmacy workspace |
| POST | `/api/master-admin/pharmacies/:slug/archive` | Archive client |
| DELETE | `/api/master-admin/pharmacies/:slug` | Delete demo client |

## Validation

```bash
pnpm run pharmacy:master-admin:validate
```

Checks: pharmacy creation, tenant isolation, portfolio updates, open pharmacy dashboard, archive demo, existing pharmacies unchanged, no engine modifications.

Report: `data/validation-reports/pharmacy-master-admin-v1.json`

## Future commercial platform

This V1 prepares:

- Unlimited client workspaces for agency operations
- Growth Plan tier assignment at onboarding (Starter / Professional / Complete)
- Portfolio-level visibility for account managers
- Per-client deep link into the Growth Programme customer experience

Future work: user→slug assignment for staff, billing integration, automated content pipeline triggers from the wizard, and client-facing login scoped to assigned pharmacy.
