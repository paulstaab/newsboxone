# syntax=docker/dockerfile:1.7

FROM node:24-bookworm AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY frontend/ ./
RUN npm run build

FROM rust:1.88-bookworm AS backend-builder
WORKDIR /app/backend

COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src
COPY backend/migrations ./migrations
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,target=/usr/local/cargo/git,sharing=locked \
    cargo build --release

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends bash ca-certificates dumb-init libsqlite3-0 libssl3 nginx \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

COPY --from=backend-builder /app/backend/target/release/headless-rss /usr/local/bin/headless-rss
COPY --from=frontend-builder /app/frontend/out /usr/share/newsboxone/frontend
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /app/docker/entrypoint.sh

RUN mkdir -p /app/data \
    && chmod +x /app/docker/entrypoint.sh

WORKDIR /app
EXPOSE 8000

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker/entrypoint.sh"]
