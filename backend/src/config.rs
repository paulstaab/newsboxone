use std::env;
use std::path::Path;

#[derive(Clone, Debug)]
pub struct Config {
    pub username: Option<String>,
    pub password: Option<String>,
    pub version: String,
    pub db_path: String,
    pub feed_update_frequency_min: i64,
    pub article_retention: ArticleRetention,
    pub openai_api_key: Option<String>,
    pub openai_base_url: String,
    pub openai_model: String,
    pub openai_timeout_seconds: u64,
    pub testing_mode: bool,
    pub cors_allowed_origins: Vec<String>,
}

impl Config {
    /// Loads runtime settings with safe defaults for read and optional unread retention.
    pub fn from_env() -> Self {
        let db_path = env::var("DATABASE_PATH").unwrap_or_else(|_| default_db_path());

        Self {
            username: get_env_str("USERNAME"),
            password: get_env_str("PASSWORD"),
            version: env::var("VERSION").unwrap_or_else(|_| "dev".to_string()),
            db_path,
            feed_update_frequency_min: get_env_int("FEED_UPDATE_FREQUENCY_MIN", 15),
            article_retention: ArticleRetention::from_values(
                env::var("ARTICLE_READ_RETENTION_DAYS").ok().as_deref(),
                env::var("ARTICLE_UNREAD_RETENTION_DAYS").ok().as_deref(),
            ),
            openai_api_key: get_env_str("OPENAI_API_KEY"),
            openai_base_url: env::var("OPENAI_BASE_URL")
                .unwrap_or_else(|_| "https://api.openai.com/v1".to_string()),
            openai_model: env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-5.6-luna".to_string()),
            openai_timeout_seconds: get_env_u64("OPENAI_TIMEOUT_SECONDS", 60),
            testing_mode: env::var("TESTING_MODE")
                .ok()
                .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
                .unwrap_or(cfg!(test)),
            cors_allowed_origins: get_env_list("CORS_ALLOWED_ORIGINS"),
        }
    }

    pub fn auth_enabled(&self) -> bool {
        self.username.is_some() && self.password.is_some()
    }

    pub fn llm_enabled(&self) -> bool {
        self.openai_api_key.is_some()
    }
}

fn get_env_int(name: &str, default: i64) -> i64 {
    env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<i64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default)
}

fn get_env_u64(name: &str, default: u64) -> u64 {
    env::var(name)
        .ok()
        .as_deref()
        .and_then(parse_positive_u64)
        .unwrap_or(default)
}

fn parse_positive_u64(value: &str) -> Option<u64> {
    value.trim().parse::<u64>().ok().filter(|value| *value > 0)
}

fn get_env_str(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn get_env_list(name: &str) -> Vec<String> {
    env::var(name)
        .ok()
        .map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn default_db_path() -> String {
    if Path::new("data/headless-rss.sqlite3").exists() {
        return "data/headless-rss.sqlite3".to_string();
    }

    if Path::new("../data/headless-rss.sqlite3").exists() {
        return "../data/headless-rss.sqlite3".to_string();
    }

    "data/headless-rss.sqlite3".to_string()
}

#[cfg(test)]
mod tests {
    use super::parse_positive_u64;

    #[test]
    fn retention_settings_have_safe_defaults_and_explicit_unread_opt_in() {
        use super::ArticleRetention;
        let defaults = ArticleRetention::from_values(None, None);
        assert_eq!(defaults.read_days, 30);
        assert_eq!(defaults.unread_days, None);
        let custom = ArticleRetention::from_values(Some("7"), Some("60"));
        assert_eq!(custom.read_days, 7);
        assert_eq!(custom.unread_days, Some(60));
        for invalid in ["", "0", "-1", "invalid", "18446744073709551615"] {
            let policy = ArticleRetention::from_values(Some(invalid), Some(invalid));
            assert_eq!(policy.read_days, 30);
            assert_eq!(policy.unread_days, None);
        }
    }

    #[test]
    fn parse_positive_u64_accepts_positive_integer() {
        assert_eq!(parse_positive_u64("30"), Some(30));
    }

    #[test]
    fn parse_positive_u64_rejects_zero_and_invalid_values() {
        assert_eq!(parse_positive_u64("0"), None);
        assert_eq!(parse_positive_u64("-5"), None);
        assert_eq!(parse_positive_u64("abc"), None);
    }
}

/// Payload retention measured from the last actual article change; stars never expire.
#[derive(Clone, Debug)]
pub struct ArticleRetention {
    pub read_days: u64,
    pub unread_days: Option<u64>,
}

impl Default for ArticleRetention {
    fn default() -> Self {
        Self {
            read_days: 30,
            unread_days: None,
        }
    }
}

impl ArticleRetention {
    /// Parses positive, overflow-safe day counts; absent/zero unread retention disables expiry.
    fn from_values(read: Option<&str>, unread: Option<&str>) -> Self {
        Self {
            read_days: read.and_then(parse_retention_days).unwrap_or(30),
            unread_days: unread.and_then(parse_retention_days),
        }
    }
}

/// Rejects day counts that cannot be represented as a signed number of seconds.
fn parse_retention_days(value: &str) -> Option<u64> {
    parse_positive_u64(value).filter(|days| *days <= (i64::MAX / 86_400) as u64)
}
