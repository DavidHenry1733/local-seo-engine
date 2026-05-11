# Local SEO Content Generator

This application generates and manages local SEO content, creating localized landing pages from structured data to scale content deployment.

## Run & Operate

- **Run Dev Server**: `pnpm dev`
- **Build**: `pnpm build`
- **Typecheck**: `pnpm typecheck`
- **Codegen**: `pnpm codegen` (for OpenAPI spec)
- **DB Push**: `pnpm db:push` (for Drizzle ORM schema changes)
- **Required ENV Vars**: `DEPLOY_USERNAME`, `DEPLOY_PASSWORD` (for SFTP deployment)

## Stack

- **Framework**: Express 5
- **Runtime**: Node.js 24
- **Language**: TypeScript 5.9
- **ORM**: Drizzle ORM (with PostgreSQL)
- **Validation**: Zod v4, drizzle-zod
- **Build Tool**: esbuild
- **Monorepo Tool**: pnpm workspaces

## Where things live

- **DB Schema**: `schema.ts` (within relevant package, e.g., `artifacts/api-server/src/db/schema.ts`)
- **API Contracts**: Defined by OpenAPI spec, used by Orval for codegen.
- **Main Configuration**: `ProjectConfig` (JSON files per project).
- **Page Slugs**: `src/pageSlug.ts` (enforces `/{service-slug}-{area-slug}/` pattern)
- **Sitemap Builder**: `artifacts/api-server/src/routes/api/searchConsole.ts`
- **Setup Wizard Session Data**: `session.json` (within project output directory)
- **Brand Profiles**: `config/projects/{slug}/brand-profile.json`
- **Customer Provider Profiles**: `config/projects/<clientSlug>/providers/<serviceKey>.json`
- **Industry Profiles**: `config/industryProfiles.json`

## Architecture decisions

- **Config-Driven Generation**: Pages are generated from JSON configurations, allowing flexible and scalable content creation.
- **Dual-Mode Templating**: Templates support both static HTML output and WordPress-specific content for diverse deployment needs.
- **Synchronous Pre-Deployment Checks**: `PostRenderCheck` and `PreflightReport` systems validate content and configurations *before* deployment to ensure quality and prevent errors.
- **AI Readiness Scoring**: A validation layer scores pages on multiple criteria, blocking low-quality pages from deployment and ensuring content excellence.
- **Hybrid Image Library**: Supports diverse image sources (library, AI, upload, hybrid) with a Scene Diversity Engine to ensure varied and relevant visuals.
- **Final Publish Gate**: Consolidates all QA checks into a single severity-based pre-deployment gate, providing clear publish statuses (PASS_READY, REVIEW_REQUIRED, FAIL_BLOCKED).

## Product

- **Config-Driven Local SEO Generation**: Automates creation of SEO-optimized HTML pages by cross-joining services and locations, building comprehensive SEO payloads, and rendering branded content.
- **Setup Wizard API Server**: Provides a guided interface for configuring and managing local SEO campaigns.
- **Sitemap and Indexing Management**: Generates sitemaps, manages `robots.txt`, and monitors Google indexing status.
- **Keyword Tracking**: Monitors Google ranking positions for primary keywords.
- **Brand / Style Importer**: Extracts brand signals from existing websites to apply consistent styling to generated pages.
- **Distribution Content Engine**: Generates social media and video content drafts for human review based on SEO pages.
- **Customer Provider Profile System**: Ensures schema and page identity reference the actual service provider for non-digital campaigns.
- **Industry Profiles**: Provides structured data and context for various industries to guide content generation and buyer-type classification.

## User preferences

I prefer iterative development with clear, concise communication. Please ask before making any major architectural changes or introducing new dependencies. When proposing changes, provide a brief explanation of the "why" behind them. I value clean code and well-structured solutions.

## Gotchas

- `PreflightReport` and `PostRenderCheck` systems run synchronously; failures prevent deployment.
- Pages with `publishBlocked=true` (due to AI readiness score <60) will prevent FTP upload if `project.deploy.enabled`.
- Final Publish Gate will hard block deployment if `FAIL_BLOCKED` status is met.
- For non-digital campaigns, an approved customer provider profile is required for schema generation; otherwise, the publish gate will block deployment.
- `buyerType=household` will flag commercial/digital-agency language in body text as a `REVIEW` issue.
- Non-digital industries will flag digital/web-agency phrases in rendered body text as a `MAJOR` issue, forcing `REVIEW_REQUIRED`.

## Pointers

- **OpenAPI Specification**: _Populate as you build_
- **Google Maps Embed API**: [https://developers.google.com/maps/documentation/embed/overview](https://developers.google.com/maps/documentation/embed/overview)
- **WordPress REST API**: [https://developer.wordpress.org/rest-api/](https://developer.wordpress.org/rest-api/)
- **pnpm workspaces**: [https://pnpm.io/workspaces](https://pnpm.io/workspaces)
- **Zod documentation**: [https://zod.dev/](https://zod.dev/)
- **Drizzle ORM documentation**: [https://orm.drizzle.team/](https://orm.drizzle.team/)
- **basic-ftp documentation**: [https://www.npmjs.com/package/basic-ftp](https://www.npmjs.com/package/basic-ftp)