#!/usr/bin/env bash
set -euo pipefail

backend_port="${BACKEND_PORT:-8001}"
preferred_data_dir="${NEWSBOXONE_DATA_DIR:-/app/data}"
fallback_data_dir="${TMPDIR:-/tmp}/newsboxone-data"

resolve_data_dir() {
  local data_dir="$1"

  if mkdir -p "${data_dir}" 2>/dev/null && [[ -w "${data_dir}" ]]; then
    printf '%s\n' "${data_dir}"
    return 0
  fi

  mkdir -p "${fallback_data_dir}"
  printf 'newsboxone: %s is not writable, using %s for runtime data\n' "${data_dir}" "${fallback_data_dir}" >&2
  printf '%s\n' "${fallback_data_dir}"
}

data_dir="$(resolve_data_dir "${preferred_data_dir}")"
export DATABASE_PATH="${DATABASE_PATH:-${data_dir}/headless-rss.sqlite3}"

/usr/local/bin/headless-rss serve --host 127.0.0.1 --port "${backend_port}" &
backend_pid=$!

cleanup() {
  kill "${backend_pid}" 2>/dev/null || true
  wait "${backend_pid}" 2>/dev/null || true
}

trap cleanup INT TERM

nginx -g 'daemon off;' &
nginx_pid=$!

wait -n "${backend_pid}" "${nginx_pid}"
exit_code=$?

kill "${backend_pid}" "${nginx_pid}" 2>/dev/null || true
wait "${backend_pid}" 2>/dev/null || true
wait "${nginx_pid}" 2>/dev/null || true

exit "${exit_code}"
