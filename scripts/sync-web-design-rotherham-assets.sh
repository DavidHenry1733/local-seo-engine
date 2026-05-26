#!/usr/bin/env bash
set -euo pipefail

CAMPAIGN_DIR="/home/inboxingproweb/local-seo-engine/output/rotherham-web_design-539720/assets/web-design"
SHARED_DIR="/home/inboxingproweb/local-seo-engine/output/inboxingproweb/assets/inboxingproweb/web-design"
LIVE_SHARED_DIR="/home/inboxingproweb/public_html/local.inboxingproweb.com/assets/inboxingproweb/web-design"
LIVE_CONVERSION_DIR="/home/inboxingproweb/public_html/local.inboxingproweb.com/assets/web-design"

mkdir -p "$SHARED_DIR" "$LIVE_SHARED_DIR" "$LIVE_CONVERSION_DIR"

echo "Syncing campaign images into shared assets..."

\cp -f "$CAMPAIGN_DIR/hero.webp" "$SHARED_DIR/hero.webp"
\cp -f "$CAMPAIGN_DIR/support.jpg" "$SHARED_DIR/support.jpg"
\cp -f "$CAMPAIGN_DIR/trust.webp" "$SHARED_DIR/trust.jpg"

echo "Deploying shared assets to live..."

\cp -f "$SHARED_DIR/hero.webp" "$LIVE_SHARED_DIR/hero.webp"
\cp -f "$SHARED_DIR/support.jpg" "$LIVE_SHARED_DIR/support.jpg"
\cp -f "$SHARED_DIR/trust.jpg" "$LIVE_SHARED_DIR/trust.jpg"
\cp -f "$CAMPAIGN_DIR/conversion.webp" "$LIVE_CONVERSION_DIR/conversion-v1.png"

echo "Running deploy validation..."

/home/inboxingproweb/local-seo-engine/scripts/validate-web-design-rotherham-assets.sh

echo "SYNC + DEPLOY VALIDATION COMPLETE"
