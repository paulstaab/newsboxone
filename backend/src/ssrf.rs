use std::net::{IpAddr, SocketAddr};
use std::str::FromStr;

use anyhow::{Context, Result};
use reqwest::header::LOCATION;
use tokio::net::lookup_host;

use crate::http_client::{self, HttpClientProfile};

const MAX_REDIRECTS: usize = 3;

#[derive(Debug)]
pub enum SafeGetError {
    Validation(anyhow::Error),
    Request(anyhow::Error),
}

impl SafeGetError {
    /// Converts the wrapped error into an anyhow error for callers that do not
    /// need to distinguish validation failures from transport failures.
    pub fn into_anyhow(self) -> anyhow::Error {
        match self {
            Self::Validation(error) | Self::Request(error) => error,
        }
    }
}

#[derive(Clone, Debug)]
struct ValidatedUrl {
    url: reqwest::Url,
    hostname: Option<String>,
    resolved_addrs: Vec<SocketAddr>,
}

/// Validates a remote URL against SSRF constraints used by feed operations.
///
/// Rules:
/// - Only `http` and `https` schemes are allowed.
/// - Loopback/private/link-local/unspecified/multicast/metadata targets are blocked.
/// - `localhost` is only allowed in testing mode.
async fn validate_remote_url(url: &str, allow_localhost: bool) -> Result<ValidatedUrl> {
    let parsed =
        reqwest::Url::parse(url).with_context(|| format!("failed to parse remote URL `{url}`"))?;

    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        anyhow::bail!(
            "URL scheme '{}' is not allowed. Only http and https are permitted.",
            parsed.scheme()
        );
    }

    let Some(hostname) = parsed.host_str().map(str::to_owned) else {
        anyhow::bail!("URL must have a valid hostname.");
    };

    if !allow_localhost && matches!(hostname.as_str(), "localhost" | "127.0.0.1" | "::1") {
        anyhow::bail!("Access to localhost is not allowed.");
    }

    let lookup_port = parsed.port_or_known_default().unwrap_or(80);
    if let Ok(ip) = IpAddr::from_str(&hostname) {
        validate_ip_address(ip, allow_localhost)?;
        return Ok(ValidatedUrl {
            url: parsed,
            hostname: None,
            resolved_addrs: vec![SocketAddr::new(ip, lookup_port)],
        });
    }

    let addrs = lookup_host((hostname.as_str(), lookup_port))
        .await
        .with_context(|| {
            format!("failed to resolve hostname `{hostname}` during SSRF validation")
        })?;

    let mut resolved_addrs = Vec::new();
    for addr in addrs {
        validate_ip_address(addr.ip(), allow_localhost)?;
        resolved_addrs.push(addr);
    }

    if resolved_addrs.is_empty() {
        anyhow::bail!("hostname `{hostname}` resolved to no addresses during SSRF validation");
    }

    Ok(ValidatedUrl {
        url: parsed,
        hostname: Some(hostname),
        resolved_addrs,
    })
}

/// Sends a GET request while validating each redirect hop against the SSRF
/// policy before the client follows it.
pub async fn get_with_safe_redirects(
    client_profile: HttpClientProfile,
    url: &str,
    allow_localhost: bool,
) -> std::result::Result<reqwest::Response, SafeGetError> {
    let mut current_url = validate_remote_url(url, allow_localhost)
        .await
        .map_err(SafeGetError::Validation)?;

    for redirect_count in 0..=MAX_REDIRECTS {
        let client =
            build_pinned_client(client_profile, &current_url).map_err(SafeGetError::Request)?;
        let response = client
            .get(current_url.url.clone())
            .send()
            .await
            .map_err(|err| SafeGetError::Request(err.into()))?;

        let status = response.status();
        let is_follow_redirect = matches!(
            status,
            reqwest::StatusCode::MOVED_PERMANENTLY
                | reqwest::StatusCode::FOUND
                | reqwest::StatusCode::SEE_OTHER
                | reqwest::StatusCode::TEMPORARY_REDIRECT
                | reqwest::StatusCode::PERMANENT_REDIRECT
        );

        if !is_follow_redirect {
            return Ok(response);
        }

        if redirect_count == MAX_REDIRECTS {
            return Err(SafeGetError::Request(anyhow::anyhow!(
                "stopped after {MAX_REDIRECTS} redirects"
            )));
        }

        let location = response
            .headers()
            .get(LOCATION)
            .ok_or_else(|| {
                SafeGetError::Request(anyhow::anyhow!("redirect response missing Location header"))
            })?
            .to_str()
            .map_err(|error| {
                SafeGetError::Request(
                    anyhow::Error::new(error)
                        .context("redirect Location header is not valid UTF-8"),
                )
            })?;

        current_url = validate_redirect_target_validated(response.url(), location, allow_localhost)
            .await
            .map_err(SafeGetError::Validation)?;
    }

    Err(SafeGetError::Request(anyhow::anyhow!(
        "redirect handling terminated unexpectedly"
    )))
}

/// Resolves a redirect target relative to the current URL and validates the
/// resulting target before it is fetched.
#[cfg(test)]
#[allow(dead_code)]
pub async fn validate_redirect_target(
    current_url: &reqwest::Url,
    location: &str,
    allow_localhost: bool,
) -> Result<reqwest::Url> {
    Ok(
        validate_redirect_target_validated(current_url, location, allow_localhost)
            .await?
            .url,
    )
}

async fn validate_redirect_target_validated(
    current_url: &reqwest::Url,
    location: &str,
    allow_localhost: bool,
) -> Result<ValidatedUrl> {
    let redirect_url = current_url
        .join(location)
        .with_context(|| format!("invalid redirect target `{location}`"))?;
    validate_remote_url(redirect_url.as_str(), allow_localhost).await
}

fn build_pinned_client(
    client_profile: HttpClientProfile,
    validated_url: &ValidatedUrl,
) -> Result<reqwest::Client> {
    match &validated_url.hostname {
        Some(hostname) => http_client::build_pinned_http_client(
            client_profile,
            hostname,
            &validated_url.resolved_addrs,
        ),
        None => http_client::build_http_client(client_profile, None),
    }
}

fn validate_ip_address(ip: IpAddr, allow_localhost: bool) -> Result<()> {
    let is_private = match ip {
        IpAddr::V4(v4) => v4.is_private(),
        IpAddr::V6(v6) => v6.is_unique_local(),
    };
    let is_link_local = match ip {
        IpAddr::V4(v4) => v4.is_link_local(),
        IpAddr::V6(v6) => v6.is_unicast_link_local(),
    };

    if !allow_localhost && ip.is_loopback() {
        anyhow::bail!("Access to loopback address {ip} is not allowed.");
    }
    if is_private && !ip.is_loopback() {
        anyhow::bail!("Access to private address {ip} is not allowed.");
    }
    if is_link_local {
        anyhow::bail!("Access to link-local address {ip} is not allowed.");
    }
    if ip.is_unspecified() {
        anyhow::bail!("Access to unspecified address {ip} is not allowed.");
    }
    if ip.is_multicast() {
        anyhow::bail!("Access to multicast address {ip} is not allowed.");
    }
    if ip == IpAddr::from([169, 254, 169, 254]) {
        anyhow::bail!("Access to cloud metadata service is not allowed.");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{validate_ip_address, validate_redirect_target, validate_remote_url};
    use std::net::{IpAddr, Ipv4Addr, SocketAddr};

    #[tokio::test]
    async fn validate_remote_url_rejects_hostname_when_dns_lookup_fails() {
        let error = validate_remote_url("https://nonexistent.invalid/feed.xml", false)
            .await
            .unwrap_err();

        assert!(
            error.to_string().contains(
                "failed to resolve hostname `nonexistent.invalid` during SSRF validation"
            )
        );
    }

    #[tokio::test]
    async fn validate_redirect_target_blocks_localhost_hop() {
        let current_url = reqwest::Url::parse("https://example.com/feed.xml").unwrap();

        let error = validate_redirect_target(&current_url, "http://127.0.0.1/admin", false)
            .await
            .unwrap_err();

        assert_eq!(error.to_string(), "Access to localhost is not allowed.");
    }

    #[tokio::test]
    async fn validate_redirect_target_accepts_relative_public_hop() {
        let current_url = reqwest::Url::parse("https://example.com/feed.xml").unwrap();

        let redirect_url = validate_redirect_target(&current_url, "/next.xml", false)
            .await
            .unwrap();

        assert_eq!(redirect_url.as_str(), "https://example.com/next.xml");
    }

    #[tokio::test]
    async fn validate_remote_url_preserves_ip_literal_as_pinned_address() {
        let validated = validate_remote_url("https://93.184.216.34/feed.xml", false)
            .await
            .unwrap();

        assert!(validated.hostname.is_none());
        assert_eq!(
            validated.resolved_addrs,
            vec![SocketAddr::new(
                IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34)),
                443
            )]
        );
    }

    #[test]
    fn validate_ip_address_blocks_metadata_service() {
        let error =
            validate_ip_address(IpAddr::V4(Ipv4Addr::new(169, 254, 169, 254)), false).unwrap_err();

        assert_eq!(
            error.to_string(),
            "Access to link-local address 169.254.169.254 is not allowed."
        );
    }
}
