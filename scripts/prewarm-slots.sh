#!/usr/bin/env bash
# Pre-warm N deployment slots on GPU2 by pre-copying the golden template.
# Each slot = a pre-allocated directory with node_modules already installed.
# Usage: bash scripts/prewarm-slots.sh [count]

set -euo pipefail

COUNT="${1:-5}"
GPU2_HOST="${GPU2_HOST:-100.110.74.114}"
GPU2_USER="${GPU2_USER:-comput3}"
GOLDEN_DIR="/home/${GPU2_USER}/golden-template"
SLOTS_DIR="/home/${GPU2_USER}/slots"
BASE_PORT=3200

echo "[prewarm] Creating ${COUNT} pre-warmed slots on ${GPU2_USER}@${GPU2_HOST}"

ssh "${GPU2_USER}@${GPU2_HOST}" bash -s "$COUNT" "$GOLDEN_DIR" "$SLOTS_DIR" "$BASE_PORT" <<'REMOTE'
set -euo pipefail
COUNT="$1"
GOLDEN_DIR="$2"
SLOTS_DIR="$3"
BASE_PORT="$4"

if [ ! -d "${GOLDEN_DIR}/node_modules" ]; then
  echo "[prewarm] ERROR: Golden template not found at ${GOLDEN_DIR}. Run setup-golden-template.sh first."
  exit 1
fi

mkdir -p "$SLOTS_DIR"

for i in $(seq 1 "$COUNT"); do
  PORT=$((BASE_PORT + i))
  SLOT_DIR="${SLOTS_DIR}/slot-${PORT}"

  if [ -d "${SLOT_DIR}/node_modules" ]; then
    echo "[prewarm] Slot ${PORT} already exists, skipping"
    continue
  fi

  echo "[prewarm] Creating slot ${PORT}..."
  cp -rT "$GOLDEN_DIR" "$SLOT_DIR"
  echo "${PORT}" > "${SLOT_DIR}/.port"
  echo "available" > "${SLOT_DIR}/.status"
  echo "[prewarm] Slot ${PORT} ready ($(du -sh ${SLOT_DIR}/node_modules | cut -f1))"
done

echo "[prewarm] Slot summary:"
ls -d ${SLOTS_DIR}/slot-* 2>/dev/null | while read d; do
  PORT=$(cat "$d/.port" 2>/dev/null || echo "???")
  STATUS=$(cat "$d/.status" 2>/dev/null || echo "unknown")
  echo "  - Port ${PORT}: ${STATUS}"
done

echo "[prewarm] Done. ${COUNT} slots ready."
REMOTE

echo "[prewarm] Complete."
