# NewsBoxOne

NewsBoxOne is a self-hosted reading inbox for RSS, Atom, and email newsletters.
It gives you one container, one web app, and one API for following sites and newsletters without depending on a hosted reader.

It is built for homelab deployment: persistent local storage, required login protection for real deployments, optional AI-assisted summaries, and a single image that serves both the frontend and the API.

## Why NewsBoxOne

- Follow RSS and Atom feeds from one timeline.
- Turn mailing-list newsletters into readable feed entries instead of leaving them buried in your inbox.
- Keep everything in one container instead of managing a separate frontend and backend stack.
- Use it locally with no cloud dependency, then optionally add OpenAI-compatible summarization later.
- Let the service refresh feeds automatically on startup and on a schedule.
- Organize sources into folders, keep track of unread and starred items, and read through a unified web UI.

## What It Does

- Unified web app and API:
  the container serves the frontend at `/` and the API at `/api`.
- RSS and Atom ingestion:
  add feeds once and NewsBoxOne keeps them updated automatically.
- Newsletter ingestion over IMAP:
  connect a mailbox and convert mailing-list emails into feed-like entries.
- Optional article enrichment:
  NewsBoxOne can evaluate feed quality, prefer extracted full text when a feed is thin, and generate concise summaries when configured with an OpenAI-compatible API.
- Safe self-hosted defaults:
  data stays in SQLite on your storage, authenticated access is expected, and remote fetches are restricted to reduce SSRF risk.

## Trust And Safety Warning

NewsBoxOne is intended for trusted users and trusted feeds only.

- Do not run it as a public multi-user service.
- Do not give access to untrusted users who could add arbitrary feeds.
- Only subscribe to feeds and newsletters from sources you trust.
- Full-text extraction may trigger HTTP requests to article pages linked from a feed. If a feed points to illegal, abusive, or otherwise unsafe websites, NewsBoxOne may attempt to fetch that content during enrichment.

`USERNAME` and `PASSWORD` are mandatory environment variables for running NewsBoxOne.
Run the container only with both variables set.

## Quick Start

If you want the fastest path in a homelab, run the published container, mount persistent storage for `/app/data`, and set the mandatory `USERNAME` and `PASSWORD` environment variables.

```bash
docker run -d \
  --name newsboxone \
  -p 8000:8000 \
  -v newsboxone-data:/app/data \
  -e USERNAME=admin \
  -e PASSWORD=change-me \
  ghcr.io/paulstaab/newsboxone:latest
```

Open:

- `http://<your-server>:8000/`
- `http://<your-server>:8000/api/status`
- `http://<your-server>:8000/api/version`

What happens next:

- the backend initializes the SQLite database automatically
- feeds are refreshed once on startup
- scheduled refreshes continue in the background every 15 minutes by default

## Docker Compose Example

This is a good starting point for a small homelab server or NAS.

```yaml
services:
  newsboxone:
    image: ghcr.io/paulstaab/newsboxone:latest
    container_name: newsboxone
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      - ./newsboxone-data:/app/data
    environment:
      USERNAME: admin
      PASSWORD: change-me
      FEED_UPDATE_FREQUENCY_MIN: "15"
```

If you prefer to build locally instead of pulling from GHCR:

```bash
docker build -t newsboxone:local .
docker run -d \
  --name newsboxone \
  -p 8000:8000 \
  -v "$PWD/newsboxone-data:/app/data" \
  -e USERNAME=admin \
  -e PASSWORD=change-me \
  newsboxone:local
```

## Environment Configuration

All runtime configuration is done with environment variables.

Setting `USERNAME` and `PASSWORD` is mandatory, all other environment variables are optional.

### Core Settings

| Variable | Default | What it controls |
| --- | --- | --- |
| `USERNAME` | unset | Name of the instance user  |
| `PASSWORD` | unset | Password of the instance user  |
| `DATABASE_PATH` | `data/headless-rss.sqlite3` | SQLite database file path. In the container, the default lives under `/app/data`. |
| `FEED_UPDATE_FREQUENCY_MIN` | `15` | How often regular feeds are refreshed after startup. |
| `VERSION` | `dev` | Version string returned by the API. |

### AI / OpenAI-Compatible Settings

These are optional. If you do not set an API key, NewsBoxOne still works normally without AI features.

| Variable | Default | What it controls |
| --- | --- | --- |
| `OPENAI_API_KEY` | unset | Enables AI-assisted summary and newsletter parsing features. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Base URL for OpenAI-compatible APIs. |
| `OPENAI_MODEL` | `gpt-5-nano` | Model used for summary and content-quality decisions. |
| `OPENAI_TIMEOUT_SECONDS` | `30` | Timeout for outbound AI requests. |

### Advanced / Operational Settings

| Variable | Default | What it controls |
| --- | --- | --- |
| `BACKEND_PORT` | `8001` | Internal backend port used behind nginx inside the container. Most users do not need to change this. |
| `TESTING_MODE` | unset | Test-only behavior. Do not enable this in normal deployments. |

## Recommended Homelab Setup

- Put NewsBoxOne behind your normal reverse proxy if you already use one, but exposing port `8000` directly on a trusted LAN is enough for a simple setup.
- Always mount `/app/data` to persistent storage so your database survives container recreation.
- Start without AI features first. Add `OPENAI_API_KEY` later if you want generated summaries or smarter newsletter parsing.
- Only allow trusted people to manage the instance, because adding a feed can eventually cause NewsBoxOne to fetch linked article pages for full-text extraction.

## Build From Source

If you want to build the container yourself:

```bash
docker build -t newsboxone:local .
```

## Project Layout

Most users can ignore the repository structure, but for contributors:

- `backend/`: Rust API, feed updater, newsletter ingestion, CLI, and persistence
- `frontend/`: Next.js frontend exported as static assets
- `docker/`: nginx and container startup scripts
- `docs/`: requirements, API contract, and test catalogs

## License

MIT. See `LICENSE`.
