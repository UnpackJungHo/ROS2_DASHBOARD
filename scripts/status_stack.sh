#!/usr/bin/env bash
set -euo pipefail

echo '[stack] 8080 config'
curl -sS http://127.0.0.1:8080/config || true
printf '\n\n[stack] 4000 health\n'
curl -sS http://127.0.0.1:4000/health || true
printf '\n'
