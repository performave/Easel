pub mod courses;
pub mod pagination;

use std::sync::Arc;

use reqwest::cookie::Jar;
use serde::de::DeserializeOwned;

use crate::auth::Session;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("http: {0}")]
    Http(#[from] reqwest::Error),
    #[error("not authenticated")]
    Unauthenticated,
    #[error("session expired")]
    SessionExpired,
    #[error("canvas error {status}: {body}")]
    Canvas { status: u16, body: String },
}

pub struct HttpClient {
    pub client: reqwest::Client,
    pub jar: Arc<Jar>,
}

impl HttpClient {
    pub fn new() -> Self {
        let jar = Arc::new(Jar::default());
        let client = reqwest::Client::builder()
            .cookie_provider(jar.clone())
            .user_agent("Easel/0.1 (+https://github.com/EricWang/easel)")
            .build()
            .expect("failed to build reqwest client");
        Self { client, jar }
    }

    pub fn seed_from(&self, session: &Session) {
        let base = match url::Url::parse(&format!("https://{}", session.domain)) {
            Ok(u) => u,
            Err(_) => return,
        };
        for c in &session.cookies {
            let cookie_str = format!(
                "{}={}; Domain={}; Path={}",
                c.name, c.value, c.domain, c.path
            );
            self.jar.add_cookie_str(&cookie_str, &base);
        }
    }

    pub async fn post(&self, session: &Session, path: &str) -> Result<(), ApiError> {
        let url = format!("https://{}{}", session.domain, path);
        let mut req = self.client.post(&url);
        if let Some(token) = &session.csrf_token {
            req = req.header("X-CSRF-Token", token);
        }
        let _ = req.send().await?;
        Ok(())
    }

    pub async fn get_json<T: DeserializeOwned>(
        &self,
        session: &Session,
        path: &str,
    ) -> Result<T, ApiError> {
        let url = self.absolute_url(session, path);
        let resp = self.client.get(&url).send().await?;
        let status = resp.status();
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ApiError::SessionExpired);
        }
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(ApiError::Canvas {
                status: status.as_u16(),
                body,
            });
        }
        Ok(resp.json::<T>().await?)
    }

    /// Auto-paginates a Canvas list endpoint by following `Link: rel="next"`.
    /// Returns the concatenated array of items across pages. Caps at 50 pages
    /// to avoid runaway loops on misconfigured endpoints.
    pub async fn get_paginated(
        &self,
        session: &Session,
        path: &str,
    ) -> Result<Vec<serde_json::Value>, ApiError> {
        let mut url = self.absolute_url(session, path);
        let mut out = Vec::new();
        for _ in 0..50 {
            let resp = self.client.get(&url).send().await?;
            let status = resp.status();
            if status == reqwest::StatusCode::UNAUTHORIZED {
                return Err(ApiError::SessionExpired);
            }
            if !status.is_success() {
                let body = resp.text().await.unwrap_or_default();
                return Err(ApiError::Canvas {
                    status: status.as_u16(),
                    body,
                });
            }
            let next = pagination::next_link(resp.headers());
            let body: serde_json::Value = resp.json().await?;
            match body {
                serde_json::Value::Array(items) => out.extend(items),
                other => out.push(other),
            }
            match next {
                Some(n) => url = n,
                None => break,
            }
        }
        Ok(out)
    }

    fn absolute_url(&self, session: &Session, path: &str) -> String {
        if path.starts_with("http://") || path.starts_with("https://") {
            path.to_string()
        } else {
            format!("https://{}{}", session.domain, path)
        }
    }
}
