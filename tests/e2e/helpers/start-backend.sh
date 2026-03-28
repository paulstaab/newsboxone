#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
DB_PATH="${DATABASE_PATH:-${ROOT_DIR}/data/headless-rss.sqlite3}"
mkdir -p "$(dirname "${DB_PATH}")"

rm -f "${DB_PATH}" "${DB_PATH}-shm" "${DB_PATH}-wal"

exec cargo run --manifest-path "${ROOT_DIR}/backend/Cargo.toml" -- serve --host 127.0.0.1 --port 8000
