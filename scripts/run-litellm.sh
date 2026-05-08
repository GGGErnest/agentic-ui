#!/usr/bin/env bash
set -euo pipefail

# Resolve repo root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Run LiteLLM via docker-compose
docker compose -f "$ROOT/docker-compose.litellm.yml" up
