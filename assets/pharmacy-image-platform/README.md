# PharmaConnect Image Platform V1

Production image library infrastructure (parallel to legacy `assets/pharmacy-image-library` demo assets).

- Structured by **service** → **role** → approval buckets
- Metadata sidecars (`{assetId}.meta.json`) per asset
- Deterministic assignment contract in `src/pharmacy/imagePlatform/`
- Does **not** modify page rendering until a future integration sprint

Initialize: `pnpm run pharmacy:image-platform:init`  
Validate: `pnpm run pharmacy:image-platform:validate`
