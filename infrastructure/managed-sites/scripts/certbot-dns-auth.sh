#!/usr/bin/env bash
set -euo pipefail
VALUE="$CERTBOT_VALIDATION"
whmapi1 addzonerecord domain=pharmaconnect.uk name="_acme-challenge.sites" type=TXT txtdata="$VALUE" ttl=300 >/dev/null
sleep 30
