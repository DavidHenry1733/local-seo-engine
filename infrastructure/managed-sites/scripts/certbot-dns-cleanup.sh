#!/usr/bin/env bash
set -euo pipefail
LINE=$(whmapi1 dumpzone domain=pharmaconnect.uk 2>/dev/null | python3 - <<'PY'
import json, sys, os
raw = sys.stdin.read()
if not raw.strip():
    sys.exit(0)
payload = json.loads(raw)
target = os.environ.get("CERTBOT_VALIDATION", "")
for record in payload.get("data", {}).get("zone", []):
    if record.get("type") != "TXT":
        continue
    name = record.get("name", "")
    txt = record.get("txtdata") or record.get("char_str_list", [""])[0]
    if "_acme-challenge.sites" in name and txt.strip('"') == target:
        print(record.get("Line"))
        break
PY
)
if [[ -n "${LINE:-}" ]]; then
  whmapi1 removezonerecord domain=pharmaconnect.uk line="$LINE" >/dev/null || true
fi
