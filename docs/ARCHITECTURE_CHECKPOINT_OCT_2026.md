Date: October 6, 2026

 

Status: Multi-Tenant Decoupled, Universal Multi-Service Pipeline Operational, Production Gate Passed

 

Repository State: Port 3001 operational, Apache vhost restored, Master Admin latency <200ms

1. Executive Summary & Big-Picture Strategy

 

The platform originated as an automated local SEO and commercial content engine for pharmacies (PharmaConnect). By engineering the system to satisfy strict NHS/private medical compliance (YMYL, zero-hallucination tolerances, granular [Schema.org](http://Schema.org) specifications), the underlying core now serves as an industry-agnostic Local Growth Engine.

 

The system dynamically deploys hyper-local, multi-page organic landing hubs across micro-catchments (0.2–1.2 miles) for any local commercial vertical (pharmacies, aesthetics, roofers, builders, salons, private clinics) without modifying application code. All operations are driven by a centralized service schema and tenant profiles.

2. Critical Infrastructure Fixes & Stability History

A. Resolution of the 30-Second Dashboard Lock (CPR01)

 

    Symptom: Master Admin dashboard hung for 30s before failing with Customer list could not be loaded: Request timed out after 30000ms. Dashboards displayed empty counters (—).

 

    Root Cause: GET /api/master-admin-platform/dashboard and /customers were running synchronous, nested filesystem scans (isPharmacyWorkspaceReady()), Search Console API queries, and readServicePageGenerationRecord(..., "pharmacy-first") for all 43 registered tenants on initial load, taking ~37 seconds to resolve. It also scanned broken snapshot directories (brook-pharmacy.before-cpr-recovery-02).

 

    Resolution: Decoupled customer listing from deep-crawl hydration. The API now returns registry clients immediately with per-tenant try/catch isolation, reducing dashboard load times from 37,000ms down to ~195ms.

 

B. Apache Vhost Routing Fix ([sites.pharmaconnect.uk](http://sites.pharmaconnect.uk))

 

    Symptom: Subdomain failed to resolve the appropriate customer bundle.

 

    Root Cause: IP-address hardcoding inside the virtual host configurations conflicted with Apache name-based routing.

 

    Resolution: Virtual host declarations converted to standard hostname-based directives (*:80 / *:443), restoring clean proxying.

 

3. The Unified ServiceDefinition Contract

 

The platform eliminated all hardcoded if (serviceId === 'weight-loss') and if (serviceId === 'pharmacy-first') conditionals. All renderers, SEO meta-builders, alt-text processors, validation gates, and revenue calculators now resolve dynamically against src/pharmacy/pharmacyServiceRegistry.ts.

Canonical Interface

TypeScript

 

export interface ServiceDefinition {

  id: string;                                // e.g. "pharmacy-first", "weight-loss", "ear-wax-removal", "roof-repair"

  name: string;                              // Human-readable title

  funding: 'nhs' | 'private' | 'commercial';

  medicalSpecialty?: string;                 // JSON-LD schema (e.g. "Endocrinology and Metabolic Weight Management")

  schemaTypes?: string[];                    // ["Pharmacy", "MedicalBusiness"] or ["RoofingContractor"]

  altDescriptor: string;                     // e.g. "Private prescribing pharmacist conducting weight management consultation"

  heroNarrativeTemplate?: string;            // Reusable overview string with {tenantName}, {town}, {serviceName}

  pillars: Array<{

    title: string;

    description: string;

    icon?: string;

  }>;

  validationRules: {

    combinedWordMin: number;                 // Standard: 450 words

    clinicalWordMin: number;                 // Standard: 180 words

    requiredPillarsOrConditions?: string[];  // e.g., 7 NHS conditions or custom pillars

  };

  commercialModel: {

    type: 'nhs_banding' | 'private_recurring' | 'private_one_off' | 'lead_conversion';

    unitPrice: number;                       // e.g. £15 (NHS), £195 (Weight Loss), £45 (Ear Wax), £4,500 (Roof)

    bandingBonus?: number;                   // e.g. £1,000 for NHS Pharmacy First

    defaultMonthlyUnits: [number, number];   // Min/Max range for projection calculations

  };

}

 

Pre-Configured Service Profiles

Service ID        Funding             Model Type      Unit Price         Quality Gate   Primary Schema / Specialty

pharmacy-first             NHS     nhs_banding  £15 (+£1k band)           7 PF Conditions, ≥450w General Practice / Primary Care

weight-loss     Private private_recurring         £195/month   5 Pillars, ≥450w, ≥180w clinical               Endocrinology & Metabolic Weight Management

ear-wax-removal         Private private_one_off            £45/appointment        3 Pillars, ≥450w, ≥180w clinical             Otolaryngology / Audiology

roof-repair (Future)     Commercial   lead_conversion          £4,500/job      4 Pillars, ≥450w ["RoofingContractor", "HomeAndConstructionBusiness"]

4. Universal Fallback & Routing Architecture

 

To prevent legacy fallbacks from resetting routes to pharmacy-first, all routers (dashboardRouter.ts, dashboardCatchmentPreviewService.ts, growthEngineCampaignBuilderService.ts) follow an explicit fallback resolution order:

TypeScript

 

const activeService = serviceId || tenant.primaryServiceId || (tenant.enabledServices && tenant.enabledServices[0]) || 'pharmacy-first';

 

Catchment review modals and public previews read from:

 

    data/pharmacy-ai-local-copy-pilots/${tenantSlug}/${serviceSlug}/v15/${catchmentSlug}.json

 

    Canonical URL: /services/${serviceSlug}?slug=${tenantSlug}&catchment=${catchmentSlug}

 

5. Verified Active Deployments

Pilot Cluster 1: Yorkshire Pharmacy (Barnsley)

 

    Tenant Slug: yorkshire-pharmacy-and-health-clinic

 

    Service: NHS Pharmacy First (pharmacy-first)

 

    Catchments (10): Darfield, Wombwell, Brampton, West Melton, Hoyland, Stairfoot, Ardsley, Thurnscoe, Goldthorpe, Bolton upon Dearne.

 

    Status: 11-page verified v15 ecosystem, compiled production XML sitemap, live commercial model.

 

Pilot Cluster 2: Reliable Direct Pharmacy (Sheffield)

 

    Tenant Slug: reliable-pharmacy-sheffield (aliased with reliable-direct-pharmacy)

 

    Address: 251 Broomhall Street, Broomhall, Sheffield, S3 7SP | ODS: FFA85 | Phone: 0114 276 0150

 

    Service: Private Medically Supervised Weight Loss Clinic (weight-loss)

 

    Catchment Order (0.2–1.2 miles): Devonshire Quarter → Sharrow → Moorfoot → Highfield → Broomhall → Netherthorpe → Broomhill → Nether Edge → Kelham Island → Sharrow Vale.

 

    Commercial Projection: Inner Sheffield (~45,000 population). 15–30 recurring monthly patients @ £195/mo = £2,925–£5,850/month (£35,100–£70,200/year).

 

    Quality Audit:

 

        Devonshire Quarter: 464 combined words, ≥180 clinical words, Devonshire Green Medical Centre anchor, Hanover Way / Supertram transit, zero tourist trivia.

 

        Sharrow: 455 combined words, ≥180 clinical words, Porter Brook Medical Centre anchor, Cemetery Road corridor transit, zero tourist trivia.

 

        JSON-LD: medicalSpecialty: "Endocrinology and Metabolic Weight Management".

 

        Consultation Alt & og:image:alt: "Private prescribing pharmacist conducting weight management consultation at Reliable Direct Pharmacy Sheffield".

 

Verification Dry-Run: 3rd Service Test (Ear Wax Removal)

 

    Passed complete generation parameterization dry run without calling Gemini API:

 

        Tenant: Reliable Direct Pharmacy, 251 Broomhall Street, 0114 276 0150.

 

        Service: Ear Wax Removal (Private one-off · £45 per appointment).

 

        Pillars: Otoscopy & Ear Canal Assessment, Microsuction Ear Wax Removal, Aftercare & Referrals.

 

        Local Anchors: Devonshire Green Medical Centre, West Street Supertram, Hanover Way ring road, Broomhall Street parking.

 

        Quality Gates: Combined ≥450 words, Clinical ≥180 words, zero tourist filler.

 

6. Next Implementation Steps (Immediate Action Items)

 

    Sheffield Final Compilation: Run generateApprovedEcosystem({ tenantSlug: 'reliable-pharmacy-sheffield', serviceSlug: 'weight-loss' }) to build the 11-page HTML static files and production XML sitemap.

 

    Commercial Intelligence Audit: Verify that the Sheffield dashboard visualizes the £35.1k–£70.2k/year ARR private curve alongside competitor GBP category gaps.

 

    Multi-Vertical Expansion: Whenever expanding beyond healthcare, create a new vertical profile schema (tradesConfig.ts or salonConfig.ts) targeting the same contentGeneratorEngine.ts and reviewPreviewApi.ts pipelines.