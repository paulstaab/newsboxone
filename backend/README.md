# headless-rss

`headless-rss` is a self-hosted RSS and newsletter aggregator written in Rust. In NewsBoxOne it powers the NewsBoxOne API and is intended for single-user, homelab-style deployments.

If you need a larger multi-user system or broader protocol/database support, look at [Arsse](https://code.mensbeam.com/MensBeam/Arsse) or [Nextcloud News](https://apps.nextcloud.com/apps/news).

## Features

- RSS and Atom feed aggregation
- NewsBoxOne API implementation for feeds, folders, items, and article content
- Automatic feed refresh scheduling based on publishing cadence
- Optional full-text extraction for truncated feeds
- Optional OpenAI-backed article summaries
- IMAP newsletter ingestion with optional AI-assisted splitting
- Single-container deployment with SQLite storage

## Run With Docker

```bash
docker run -d --rm --user 9999 --init \
  --name headless_rss \
  --volume headless-rss-data:/app/data \
  --publish 8000:8000 \
  --env USERNAME=myuser \
  --env PASSWORD=mypassword \
  ghcr.io/paulstaab/headless-rss:latest
```

`USERNAME` and `PASSWORD` are optional and enable HTTP Basic auth only when both are set.

`FEED_UPDATE_FREQUENCY_MIN` controls the periodic update loop and defaults to `15`.

Set `OPENAI_API_KEY` to enable AI summaries and newsletter parsing. `OPENAI_MODEL` defaults to `gpt-5-nano`, `OPENAI_BASE_URL` can target an OpenAI-compatible endpoint, and `OPENAI_TIMEOUT_SECONDS` defaults to `30`.

## Local Development

```bash
cargo run -- serve --host 0.0.0.0 --port 8000
```

The server listens on `http://localhost:8000` and applies SQLx migrations automatically on startup.

Useful commands:

```bash
cargo test --all-targets --all-features
cargo fmt --all
cargo clippy --all-targets --all-features -- -D warnings
cargo run -- update
cargo run -- set-feed-quality --feed-id 42 --use-extracted-fulltext true
cargo run -- reevaluate-feed-quality --feed-id 42
cargo run -- add-email-credentials --server imap.example.com --port 993 --username user@example.com --password yourpassword
```

## Documentation

- Combined requirements: `../docs/requirements.md`
- Backend requirements: `../docs/backend-requirements.md`
- Shared API contract: `../docs/api-contract.yaml`
- Test catalog: `../docs/backend-test-cases.md`

## Contributing

- Bug fixes are welcome.
- Please open an issue before implementing new features.
- Keep the project small, stable, and easy to evolve.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
