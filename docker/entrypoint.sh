#!/usr/bin/env bash
set -euo pipefail

backend_port="${BACKEND_PORT:-8001}"
preferred_data_dir="${NEWSBOXONE_DATA_DIR:-/app/data}"
fallback_data_dir="${TMPDIR:-/tmp}/newsboxone-data"
nginx_config_template="/etc/nginx/nginx.conf"
nginx_config_runtime="${TMPDIR:-/tmp}/newsboxone-nginx.conf"
frontend_config_runtime="${TMPDIR:-/tmp}/newsboxone-runtime-config.js"

resolve_data_dir() {
  local data_dir="$1"

  if mkdir -p "${data_dir}" 2>/dev/null && [[ -w "${data_dir}" && -x "${data_dir}" ]]; then
    printf '%s\n' "${data_dir}"
    return 0
  fi

  mkdir -p "${fallback_data_dir}"
  printf 'newsboxone: %s is not writable, using %s for runtime data\n' "${data_dir}" "${fallback_data_dir}" >&2
  printf '%s\n' "${fallback_data_dir}"
}

render_nginx_config() {
  local karakeep_origin="${KARAKEEP_URL:-}"
  local connect_src="'self'"

  if [[ -n "${karakeep_origin}" ]]; then
    while [[ "${karakeep_origin}" == */ ]]; do
      karakeep_origin="${karakeep_origin%/}"
    done

    if [[ ! "${karakeep_origin}" =~ ^https?://[A-Za-z0-9._~-]+(:[0-9]+)?$ ]]; then
      printf 'newsboxone: KARAKEEP_URL must be an http(s) origin without a path: %s\n' "${karakeep_origin}" >&2
      return 1
    fi

    connect_src="${connect_src} ${karakeep_origin}"
  fi

  printf 'window.__NEWSBOXONE_CONFIG__ = { karakeepUrl: "%s" };\n' "${karakeep_origin}" >"${frontend_config_runtime}"
  sed \
    -e "s|__NEWSBOXONE_CSP_CONNECT_SRC__|${connect_src}|g" \
    -e "s|__NEWSBOXONE_RUNTIME_CONFIG__|${frontend_config_runtime}|g" \
    "${nginx_config_template}" >"${nginx_config_runtime}"
}

data_dir="$(resolve_data_dir "${preferred_data_dir}")"
export DATABASE_PATH="${DATABASE_PATH:-${data_dir}/headless-rss.sqlite3}"

render_nginx_config

/usr/local/bin/headless-rss serve --host 127.0.0.1 --port "${backend_port}" &
backend_pid=$!

cleanup() {
  kill "${backend_pid}" 2>/dev/null || true
  wait "${backend_pid}" 2>/dev/null || true
}

trap cleanup INT TERM

nginx -c "${nginx_config_runtime}" -g 'daemon off;' &
nginx_pid=$!

wait -n "${backend_pid}" "${nginx_pid}"
exit_code=$?

kill "${backend_pid}" "${nginx_pid}" 2>/dev/null || true
wait "${backend_pid}" 2>/dev/null || true
wait "${nginx_pid}" 2>/dev/null || true

exit "${exit_code}"
