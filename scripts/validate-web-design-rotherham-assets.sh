#!/usr/bin/env bash
set -euo pipefail

check_asset () {
  local name="$1"
  local local_path="$2"
  local live_url="$3"
  local tmp="/tmp/live-$name"

  if [ ! -f "$local_path" ]; then
    echo "FAIL: local file missing: $local_path"
    exit 1
  fi

  curl -fsSL "$live_url?x=$(date +%s)" -o "$tmp"

  local local_md5
  local live_md5

  local_md5="$(md5sum "$local_path" | awk '{print $1}')"
  live_md5="$(md5sum "$tmp" | awk '{print $1}')"

  if [ "$local_md5" != "$live_md5" ]; then
    echo "FAIL: $name mismatch"
    echo "local: $local_md5"
    echo "live:  $live_md5"
    exit 1
  fi

  echo "PASS: $name"
}

check_asset "hero.webp" \
"/home/inboxingproweb/local-seo-engine/output/inboxingproweb/assets/inboxingproweb/web-design/hero.webp" \
"https://local.inboxingproweb.com/assets/inboxingproweb/web-design/hero.webp"

check_asset "support.jpg" \
"/home/inboxingproweb/local-seo-engine/output/inboxingproweb/assets/inboxingproweb/web-design/support.jpg" \
"https://local.inboxingproweb.com/assets/inboxingproweb/web-design/support.jpg"

check_asset "trust.jpg" \
"/home/inboxingproweb/local-seo-engine/output/inboxingproweb/assets/inboxingproweb/web-design/trust.jpg" \
"https://local.inboxingproweb.com/assets/inboxingproweb/web-design/trust.jpg"

check_asset "conversion-v1.png" \
"/home/inboxingproweb/local-seo-engine/output/rotherham-web_design-539720/assets/web-design/conversion.webp" \
"https://local.inboxingproweb.com/assets/web-design/conversion-v1.png"

echo "DEPLOY VALIDATION PASSED"
