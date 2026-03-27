#!/usr/bin/env bash
set -euo pipefail

APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:3000}"

hostport="${APP_BASE_URL#*//}"
hostport="${hostport%%/*}"
host="${hostport%%:*}"
port="${hostport##*:}"

if [[ -z "${host}" || "${host}" == "${hostport}" ]]; then
  host="127.0.0.1"
fi

if [[ "${port}" == "${host}" ]]; then
  port="3000"
fi

is_local_host=false
if [[ "${host}" == "127.0.0.1" || "${host}" == "localhost" ]]; then
  is_local_host=true
fi

server_running=false
if curl -sf "${APP_BASE_URL}" >/dev/null; then
  server_running=true
fi

started_server=false
dev_pid=""

if [[ "${server_running}" == "false" ]]; then
  if [[ "${is_local_host}" == "true" ]]; then
    npm run dev -- --hostname "${host}" --port "${port}" > /tmp/newsboxone-dev.log 2>&1 &
    dev_pid=$!
    started_server=true
    for _ in {1..60}; do
      if curl -sf "${APP_BASE_URL}" >/dev/null; then
        break
      fi
      sleep 1
    done
  else
    echo "Server not reachable at ${APP_BASE_URL} and host is not local." >&2
    exit 1
  fi
fi

APP_BASE_URL="${APP_BASE_URL}" node scripts/capture-feeds.mjs
status=$?

if [[ "${started_server}" == "true" ]]; then
  kill "${dev_pid}" >/dev/null 2>&1 || true
fi

exit "${status}"
