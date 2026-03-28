use std::net::SocketAddr;
use std::time::Duration;

use anyhow::{Context, Result};
use reqwest::header::{HeaderMap, HeaderValue};

const FEED_CONNECT_TIMEOUT_SECONDS: u64 = 5;
const FEED_READ_TIMEOUT_SECONDS: u64 = 15;
const FEED_REQUEST_TIMEOUT_SECONDS: u64 = 20;
const SHARED_USER_AGENT: &str =
    "Mozilla/5.0 (compatible; headless-rss/1.0; +https://github.com/paulstaab/headless-rss)";

#[derive(Clone, Copy, Debug)]
pub enum HttpClientProfile {
    Article,
    Feed,
}

pub(crate) fn build_http_client(
    profile: HttpClientProfile,
    pinned_resolution: Option<(&str, &[SocketAddr])>,
) -> Result<reqwest::Client> {
    let mut headers = HeaderMap::new();
    match profile {
        HttpClientProfile::Article => {
            headers.insert(
                reqwest::header::ACCEPT,
                HeaderValue::from_static(
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                ),
            );
        }
        HttpClientProfile::Feed => {
            headers.insert(
                reqwest::header::ACCEPT,
                HeaderValue::from_static(
                    "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
                ),
            );
        }
    }
    headers.insert(
        reqwest::header::ACCEPT_LANGUAGE,
        HeaderValue::from_static("en-US,en;q=0.9"),
    );

    let mut builder = reqwest::Client::builder()
        .default_headers(headers)
        .user_agent(SHARED_USER_AGENT)
        .connect_timeout(Duration::from_secs(FEED_CONNECT_TIMEOUT_SECONDS))
        .read_timeout(Duration::from_secs(FEED_READ_TIMEOUT_SECONDS))
        .timeout(Duration::from_secs(FEED_REQUEST_TIMEOUT_SECONDS))
        .redirect(reqwest::redirect::Policy::none());

    if let Some((hostname, addrs)) = pinned_resolution {
        builder = builder.resolve_to_addrs(hostname, addrs);
    }

    builder.build().context("failed to build http client")
}

/// Builds a reqwest client for article fetches with browser-like headers.
pub fn build_article_http_client() -> Result<reqwest::Client> {
    build_http_client(HttpClientProfile::Article, None)
        .context("failed to build article http client")
}

/// Builds a reqwest client for feed fetches with explicit headers and timeouts.
///
/// A shared client is intended to be reused across requests to avoid rebuilding
/// connection pools and to prevent indefinite hangs against slow origins.
pub fn build_feed_http_client() -> Result<reqwest::Client> {
    build_http_client(HttpClientProfile::Feed, None).context("failed to build feed http client")
}

pub fn build_pinned_http_client(
    profile: HttpClientProfile,
    hostname: &str,
    addrs: &[SocketAddr],
) -> Result<reqwest::Client> {
    build_http_client(profile, Some((hostname, addrs)))
        .with_context(|| format!("failed to build pinned http client for hostname `{hostname}`"))
}
