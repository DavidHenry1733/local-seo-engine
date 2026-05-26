#!/usr/bin/env bash
set -euo pipefail

CAMPAIGN_ID="${1:?Usage: sync-campaign-assets.sh CAMPAIGN_ID SERVICE_KEY}"
SERVICE_KEY="${2:?Usage: sync-campaign-assets.sh CAMPAIGN_ID SERVICE_KEY}"

ROOT="/home/inboxingproweb/local-seo-engine"
CAMPAIGN_DIR="$ROOT/output/$CAMPAIGN_ID/assets/$SERVICE_KEY"
SHARED_DIR="$ROOT/output/inboxingproweb/assets/inboxingproweb/$SERVICE_KEY"
LIVE_SHARED_DIR="/home/inboxingproweb/public_html/local.inboxingproweb.com/assets/inboxingproweb/$SERVICE_KEY"

mkdir -p "$SHARED_DIR" "$LIVE_SHARED_DIR"

pick_file () {
  local slot="$1"
  find "$CAMPAIGN_DIR" -maxdepth 1 -type f \( -name "$slot.webp" -o -name "$slot.jpg" -o -name "$slot.png" \) | head -1
}

copy_slot () {
  local slot="$1"
  local target_name="$2"
  local src
  src="$(pick_file "$slot")"

  if [ -z "$src" ]; then
    echo "FAIL: missing campaign asset for $slot in $CAMPAIGN_DIR"
    exit 1
  fi

  echo "Sync $slot: $src -> $SHARED_DIR/$target_name"
  \cp -f "$src" "$SHARED_DIR/$target_name"
  \cp -f "$SHARED_DIR/$target_name" "$LIVE_SHARED_DIR/$target_name"
}

copy_slot "hero" "hero.webp"
copy_slot "support" "support.webp"
copy_slot "trust" "trust.webp"
copy_slot "conversion" "conversion.webp"

echo "SYNC COMPLETE: $CAMPAIGN_ID / $SERVICE_KEY"
