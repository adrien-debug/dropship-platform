#!/bin/bash
set -euo pipefail

# Deploy a new storefront instance on GPU2
# Usage: ./scripts/deploy-storefront.sh <site-slug> <port> [medusa-sales-channel-id]
#
# Example:
#   ./scripts/deploy-storefront.sh anime-shop 3101
#   ./scripts/deploy-storefront.sh figurines-store 3102 sc_xxx

SITE_SLUG="${1:?Usage: deploy-storefront.sh <site-slug> <port> [sales-channel-id]}"
PORT="${2:?Usage: deploy-storefront.sh <site-slug> <port> [sales-channel-id]}"
SC_ID="${3:-sc_01KNCS6CB9S8VXD9DZTVW5FN51}"

GPU2_HOST="${GPU2_HOST:-${GPU2_HOST_DEFAULT:-100.110.74.114}}"
GPU2_USER="${GPU2_SSH_USER:-comput3}"
MEDUSA_URL="${MEDUSA_URL:-http://${GPU2_HOST}:9000}"
MEDUSA_PUB_KEY="${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:?NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is required}"
MEDUSA_REGION="${NEXT_PUBLIC_MEDUSA_REGION_ID:?NEXT_PUBLIC_MEDUSA_REGION_ID is required}"
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required}"
SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY is required}"

CONTAINER_NAME="storefront-${SITE_SLUG}"
IMAGE_TAG="onepeace-storefront:v5"

echo "=== Deploying storefront: ${SITE_SLUG} on port ${PORT} ==="

# Check if port is already in use
if ssh ${GPU2_USER}@${GPU2_HOST} "docker ps --format '{{.Names}}\t{{.Ports}}' | grep -q ':${PORT}'" 2>/dev/null; then
  echo "ERROR: Port ${PORT} already in use"
  exit 1
fi

# Stop existing container with same name
ssh ${GPU2_USER}@${GPU2_HOST} "docker rm -f ${CONTAINER_NAME} 2>/dev/null || true"

# Start new container
ssh ${GPU2_USER}@${GPU2_HOST} "docker run -d \
  --name ${CONTAINER_NAME} \
  --network host \
  --restart unless-stopped \
  -e PORT=${PORT} \
  -e SITE_ID=${SITE_SLUG} \
  -e SITE_SLUG=${SITE_SLUG} \
  -e NEXT_PUBLIC_MEDUSA_URL=${MEDUSA_URL} \
  -e NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${MEDUSA_PUB_KEY} \
  -e NEXT_PUBLIC_MEDUSA_REGION_ID=${MEDUSA_REGION} \
  -e NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL} \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY} \
  -e NODE_ENV=production \
  ${IMAGE_TAG} npx next start -p ${PORT}"

sleep 3

# Verify
STATUS=$(ssh ${GPU2_USER}@${GPU2_HOST} "curl -s -o /dev/null -w '%{http_code}' http://localhost:${PORT}" 2>&1)

if [ "$STATUS" = "200" ]; then
  echo "=== SUCCESS ==="
  echo "Storefront: http://${GPU2_HOST}:${PORT}"
  echo "Container:  ${CONTAINER_NAME}"
  echo "Image:      ${IMAGE_TAG}"
else
  echo "=== WARNING: Got HTTP ${STATUS} (might need a few more seconds) ==="
  echo "Check: ssh ${GPU2_USER}@${GPU2_HOST} docker logs ${CONTAINER_NAME}"
fi
