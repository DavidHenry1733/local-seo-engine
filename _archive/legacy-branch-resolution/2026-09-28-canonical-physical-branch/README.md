# Archived branch-resolution snapshots — 2026-09-28

These files are superseded copies of the production branch-selection service, the branch workflow/batch state, and the branch-selection admin page. They were kept beside the live source as `.before-*` snapshots. Nothing imported them.

The live authority is:

- `src/pharmacy/masterAdminWebsiteBranchDetectionService.ts` — extraction and physical branch identity
- `src/pharmacy/masterAdminWebsiteBranchSelectionService.ts` — selection, confirmation, and read-only projection
- `src/pharmacy/masterAdminImportTenantIsolationService.ts` — cross-tenant checks only

Do not import this directory from the application, register it as a route, or build it into the production bundle.
