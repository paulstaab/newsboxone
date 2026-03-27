#!/usr/bin/env bash
set -euo pipefail

backend_port="${BACKEND_PORT:-8001}"

mkdir -p /app/data

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
