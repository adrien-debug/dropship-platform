#!/bin/bash
set -euo pipefail

echo "=== Deploying One Piece Storefront to GPU2:3100 ==="

GPU2_HOST="100.110.74.114"
GPU2_USER="comput3"
PORT=3100
CONTAINER_NAME="storefront-onepiece"

# Build image on GPU2
echo "Building Docker image..."
ssh ${GPU2_USER}@${GPU2_HOST} "cd ~/dropship-platform && docker build -t onepeace-storefront:latest -f apps/storefront/Dockerfile ."

# Stop existing container
echo "Stopping existing container..."
ssh ${GPU2_USER}@${GPU2_HOST} "docker rm -f ${CONTAINER_NAME} 2>/dev/null || true"

# Start new container
echo "Starting container on port ${PORT}..."
ssh ${GPU2_USER}@${GPU2_HOST} "docker run -d \
  --name ${CONTAINER_NAME} \
  --network host \
  --restart unless-stopped \
  -e PORT=${PORT} \
  -e NEXT_PUBLIC_MEDUSA_URL=http://100.110.74.114:9000 \
  -e NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=REDACTED_MEDUSA_PK \
  -e NEXT_PUBLIC_SUPABASE_URL=https://tbachsziohjydqisbfio.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=REDACTED_SUPABASE_ANON_KEY \
  -e CJ_DROPSHIPPING_API_KEY=REDACTED_CJ_KEY \
  -e NODE_ENV=production \
  onepeace-storefront:latest"

sleep 5

# Verify
echo "Verifying deployment..."
STATUS=$(ssh ${GPU2_USER}@${GPU2_HOST} "curl -s -o /dev/null -w '%{http_code}' http://localhost:${PORT}" 2>&1)

if [ "$STATUS" = "200" ]; then
  echo "=== SUCCESS ==="
  echo "One Piece Store: http://${GPU2_HOST}:${PORT}"
  echo "Container: ${CONTAINER_NAME}"
else
  echo "=== WARNING: Got HTTP ${STATUS} ==="
  echo "Check logs: ssh ${GPU2_USER}@${GPU2_HOST} docker logs ${CONTAINER_NAME}"
fi
