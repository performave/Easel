pub mod courses;
pub mod pagination;

use std::sync::Arc;

use percent_encoding::percent_decode_str;
use reqwest::cookie::Jar;
use reqwest::Method;
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
    #[error("invalid method: {0}")]
    InvalidMethod(String),
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

    pub async fn request_json(
        &self,
        session: &Session,
        method: &str,
        path: &str,
        form: Option<&std::collections::HashMap<String, String>>,
        json: Option<&serde_json::Value>,
    ) -> Result<serde_json::Value, ApiError> {
        let url = self.absolute_url(session, path);
        let method = Method::from_bytes(method.as_bytes())
            .map_err(|_| ApiError::InvalidMethod(method.to_string()))?;
        let mut csrf = session.csrf_token.clone();
        let mut resp = self
            .send_request_with_csrf(
                &url,
                method.clone(),
                session,
                csrf.as_deref(),
                form,
                json,
            )
            .await?;

        if Self::is_mutating(method.as_str())
            && (resp.status() == reqwest::StatusCode::FORBIDDEN
                || resp.status() == reqwest::StatusCode::UNAUTHORIZED
                || resp.status() == reqwest::StatusCode::UNPROCESSABLE_ENTITY)
        {
            if let Some(fresh) = self.fetch_csrf_token(session).await? {
                csrf = Some(fresh);
                resp = self
                    .send_request_with_csrf(&url, method, session, csrf.as_deref(), form, json)
                    .await?;
            }
        }

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
        if status == reqwest::StatusCode::NO_CONTENT {
            return Ok(serde_json::json!({}));
        }
        let text = resp.text().await?;
        if text.trim().is_empty() {
            return Ok(serde_json::json!({}));
        }
        match serde_json::from_str::<serde_json::Value>(&text) {
            Ok(v) => Ok(v),
            Err(_) => Ok(serde_json::json!({ "raw": text })),
        }
    }

    async fn send_request_with_csrf(
        &self,
        url: &str,
        method: Method,
        session: &Session,
        csrf_token: Option<&str>,
        form: Option<&std::collections::HashMap<String, String>>,
        json: Option<&serde_json::Value>,
    ) -> Result<reqwest::Response, ApiError> {
        let origin = format!("https://{}", session.domain);
        let referer = format!("{}/", origin);
        let mut req = self
            .client
            .request(method, url)
            .header("Accept", "application/json, text/plain, */*")
            .header("X-Requested-With", "XMLHttpRequest")
            .header("Origin", &origin)
            .header("Referer", &referer);
        if let Some(token) = csrf_token {
            req = req.header("X-CSRF-Token", normalize_csrf_token(token));
        }
        if let Some(form_data) = form {
            req = req.form(form_data);
        }
        if let Some(json_data) = json {
            req = req.json(json_data);
        }
        Ok(req.send().await?)
    }

    async fn fetch_csrf_token(&self, session: &Session) -> Result<Option<String>, ApiError> {
        let url = self.absolute_url(session, "/api/v1/csrf_token");
        let resp = self
            .client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await?;
        let status = resp.status();
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ApiError::SessionExpired);
        }
        if !status.is_success() {
            return Ok(None);
        }
        let body: serde_json::Value = resp.json().await?;
        Ok(body
            .get("csrf_token")
            .and_then(|v| v.as_str())
            .map(normalize_csrf_token))
    }

    fn is_mutating(method: &str) -> bool {
        matches!(method, "POST" | "PUT" | "PATCH" | "DELETE")
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

fn normalize_csrf_token(token: &str) -> String {
    percent_decode_str(token).decode_utf8_lossy().to_string()
}
