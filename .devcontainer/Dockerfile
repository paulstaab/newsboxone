FROM ghcr.io/jdx/mise:2026.11.10 AS mise
FROM mcr.microsoft.com/devcontainers/base:trixie

COPY --from=mise /usr/local/bin/mise /usr/local/bin/mise
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libssl-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*
