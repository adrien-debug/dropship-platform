#!/bin/bash
# Setup Cloudflare Named Tunnels on GPU2
#
# Prerequisites:
#   1. Run `cloudflared login` on GPU2 once (opens browser)
#   2. Set CLOUDFLARE_ZONE_ID and domain in your .env.local
#   3. DNS records created automatically by cloudflared
#
# Usage (from local machine):
#   ./scripts/setup-cloudflare-tunnels.sh
#
# Or directly on GPU2:
#   bash setup-cloudflare-tunnels.sh

set -euo pipefail

GPU2_HOST="${GPU2_HOST:-100.110.74.114}"
GPU2_USER="${GPU2_SSH_USER:-comput3}"
TUNNEL_NAME="${CLOUDFLARE_TUNNEL_NAME:-dropship-gpu2}"
DOMAIN="${CLOUDFLARE_DOMAIN:?CLOUDFLARE_DOMAIN is required (ex: yourdomain.com)}"

echo "=== Cloudflare Named Tunnel Setup ==="
echo "GPU2:    ${GPU2_USER}@${GPU2_HOST}"
echo "Tunnel:  ${TUNNEL_NAME}"
echo "Domain:  ${DOMAIN}"
echo ""

# Subdomains → local ports
declare -A ROUTES=(
  ["api.${DOMAIN}"]="localhost:3849"
  ["admin.${DOMAIN}"]="localhost:3200"
  ["medusa.${DOMAIN}"]="localhost:9000"
  ["shop.${DOMAIN}"]="localhost:3100"
)

echo "Routes:"
for host in "${!ROUTES[@]}"; do
  echo "  https://${host} → ${ROUTES[$host]}"
done
echo ""

ssh "${GPU2_USER}@${GPU2_HOST}" bash << REMOTE
set -euo pipefail

# 1. Create tunnel (idempotent)
if cloudflared tunnel list | grep -q "${TUNNEL_NAME}"; then
  echo "Tunnel '${TUNNEL_NAME}' already exists — reusing"
  TUNNEL_ID=\$(cloudflared tunnel list | grep "${TUNNEL_NAME}" | awk '{print \$1}')
else
  echo "Creating tunnel '${TUNNEL_NAME}'..."
  cloudflared tunnel create ${TUNNEL_NAME}
  TUNNEL_ID=\$(cloudflared tunnel list | grep "${TUNNEL_NAME}" | awk '{print \$1}')
fi

echo "Tunnel ID: \${TUNNEL_ID}"

# 2. Write config
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << CFG
tunnel: \${TUNNEL_ID}
credentials-file: /home/${GPU2_USER}/.cloudflared/\${TUNNEL_ID}.json

ingress:
  - hostname: api.${DOMAIN}
    service: http://localhost:3849
  - hostname: admin.${DOMAIN}
    service: http://localhost:3200
  - hostname: medusa.${DOMAIN}
    service: http://localhost:9000
  - hostname: shop.${DOMAIN}
    service: http://localhost:3100
  - service: http_status:404
CFG

echo "Config written to ~/.cloudflared/config.yml"

# 3. Create DNS CNAME records
for subdomain in api admin medusa shop; do
  echo "Creating DNS: \${subdomain}.${DOMAIN} → \${TUNNEL_ID}.cfargotunnel.com"
  cloudflared tunnel route dns ${TUNNEL_NAME} \${subdomain}.${DOMAIN} || echo "  (already exists or skipped)"
done

# 4. Install systemd service
sudo cloudflared service install || echo "Service already installed"

# 5. Enable + start
sudo systemctl enable cloudflared
sudo systemctl restart cloudflared
sleep 2
sudo systemctl status cloudflared --no-pager | head -20

echo ""
echo "=== Tunnel active ==="
cloudflared tunnel info ${TUNNEL_NAME}

REMOTE

echo ""
echo "=== Done ==="
echo "Your services are now available at:"
echo "  API:    https://api.${DOMAIN}"
echo "  Admin:  https://admin.${DOMAIN}"
echo "  Medusa: https://medusa.${DOMAIN}"
echo "  Shop:   https://shop.${DOMAIN}"
