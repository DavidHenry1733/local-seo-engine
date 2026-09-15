#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/inboxingproweb/pharmaconnect-growth-engine/infrastructure/managed-sites"
NGINX_CONF="/etc/nginx/nginx.conf"
NGINX_SITE="/etc/nginx/conf.d/pharmaconnect-managed-sites.conf"
APACHE_SITE="/etc/apache2/conf.d/pharmaconnect-managed-sites.conf"
SSL_DIR="/etc/pharmaconnect-managed-sites/ssl"
ZONE="/var/named/pharmaconnect.uk.db"
PUBLISH_IP="51.161.86.187"

install -d -m 755 /etc/pharmaconnect-managed-sites/ssl
cp "$ROOT/nginx/nginx.conf" "$NGINX_CONF"
cp "$ROOT/nginx/pharmaconnect-managed-sites.conf" "$NGINX_SITE"
cp "$ROOT/apache/pharmaconnect-managed-sites.conf" "$APACHE_SITE"

if ! grep -q '^sites[[:space:]]' "$ZONE"; then
  sed -i 's/2026070101 ;Serial Number/2026072001 ;Serial Number/' "$ZONE"
  printf 'sites\t300\tIN\tA\t%s\n*.sites\t300\tIN\tA\t%s\n' "$PUBLISH_IP" "$PUBLISH_IP" >> "$ZONE"
  rndc reload pharmaconnect.uk 2>/dev/null || systemctl reload named 2>/dev/null || true
fi

nginx -t
systemctl enable nginx
systemctl restart nginx

if [[ ! -f "$SSL_DIR/fullchain.pem" ]]; then
  certbot certonly --non-interactive --agree-tos --register-unsafely-without-email \
    --manual --preferred-challenges dns \
    -d "sites.pharmaconnect.uk" -d "*.sites.pharmaconnect.uk" \
    --manual-auth-hook "$ROOT/scripts/certbot-dns-auth.sh" \
    --manual-cleanup-hook "$ROOT/scripts/certbot-dns-cleanup.sh" \
    --cert-name pharmaconnect-managed-sites || true
  if [[ -f "/etc/letsencrypt/live/pharmaconnect-managed-sites/fullchain.pem" ]]; then
    cp "/etc/letsencrypt/live/pharmaconnect-managed-sites/fullchain.pem" "$SSL_DIR/fullchain.pem"
    cp "/etc/letsencrypt/live/pharmaconnect-managed-sites/privkey.pem" "$SSL_DIR/privkey.pem"
    chmod 600 "$SSL_DIR/privkey.pem"
  fi
fi

apachectl configtest
/scripts/restartsrv_httpd --graceful 2>/dev/null || systemctl reload httpd 2>/dev/null || /usr/local/lsws/bin/lswsctrl restart

echo "Managed sites infrastructure deployed."
