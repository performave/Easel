use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::oneshot;

#[cfg(debug_assertions)]
const SESSION_FILE: &str = "session.json";
#[cfg(not(debug_assertions))]
const KEYRING_SERVICE: &str = "com.performave.easel";
#[cfg(not(debug_assertions))]
const KEYRING_USER: &str = "canvas-session";
const LOGIN_WINDOW_LABEL: &str = "canvas-login";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub domain: String,
    pub cookies: Vec<Cookie>,
    pub csrf_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cookie {
    pub name: String,
    pub value: String,
    pub domain: String,
    pub path: String,
}

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("io error: {0}")]
    #[cfg(debug_assertions)]
    Io(#[from] std::io::Error),
    #[error("keyring error: {0}")]
    #[cfg(not(debug_assertions))]
    Keyring(#[from] keyring::Error),
    #[error("serde error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("invalid domain: {0}")]
    InvalidDomain(String),
    #[error("login cancelled")]
    Cancelled,
    #[error("session expired")]
    Expired,
}

#[cfg(debug_assertions)]
fn session_path(app: &AppHandle) -> Result<std::path::PathBuf, AuthError> {
    let mut path = app.path().app_config_dir()?;
    std::fs::create_dir_all(&path)?;
    path.push(SESSION_FILE);
    Ok(path)
}

#[cfg(debug_assertions)]
pub fn save(app: &AppHandle, session: &Session) -> Result<(), AuthError> {
    let path = session_path(app)?;
    let payload = serde_json::to_string(session)?;
    std::fs::write(path, payload)?;
    Ok(())
}

#[cfg(not(debug_assertions))]
pub fn save(_app: &AppHandle, session: &Session) -> Result<(), AuthError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    let payload = serde_json::to_string(session)?;
    entry.set_password(&payload)?;
    Ok(())
}

#[cfg(debug_assertions)]
pub fn load(app: &AppHandle) -> Result<Option<Session>, AuthError> {
    let path = session_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let payload = std::fs::read_to_string(path)?;
    Ok(Some(serde_json::from_str(&payload)?))
}

#[cfg(not(debug_assertions))]
pub fn load(_app: &AppHandle) -> Result<Option<Session>, AuthError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    match entry.get_password() {
        Ok(payload) => Ok(Some(serde_json::from_str(&payload)?)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Clears all webview browsing data (cookies, localStorage, IndexedDB, cache)
/// for every WebviewWindow in the app. On macOS/Windows the WebView data store
/// is shared process-wide, so calling this on any one webview wipes the auth
/// caches for the SSO IdP too (e.g. Duke Shibboleth).
pub fn clear_browsing_data(app: &AppHandle) -> Result<(), AuthError> {
    for (_, window) in app.webview_windows() {
        window.clear_all_browsing_data()?;
        break;
    }
    Ok(())
}

#[cfg(debug_assertions)]
pub fn clear(app: &AppHandle) -> Result<(), AuthError> {
    let path = session_path(app)?;
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}

#[cfg(not(debug_assertions))]
pub fn clear(_app: &AppHandle) -> Result<(), AuthError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.into()),
    }
}

fn normalize_domain(input: &str) -> Result<String, AuthError> {
    let trimmed = input
        .trim()
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_end_matches('/')
        .to_string();
    if trimmed.is_empty() || trimmed.contains('/') || trimmed.contains(' ') {
        return Err(AuthError::InvalidDomain(input.to_string()));
    }
    Ok(trimmed)
}

/// Opens a WebviewWindow at https://{domain}/login, waits for the post-SSO
/// redirect back to the Canvas root, then harvests session cookies (including
/// HttpOnly ones) via the platform cookie store.
pub async fn begin_login(app: &AppHandle, domain: &str) -> Result<Session, AuthError> {
    let domain = normalize_domain(domain)?;
    let login_url = url::Url::parse(&format!("https://{}/login", domain))
        .map_err(|_| AuthError::InvalidDomain(domain.clone()))?;
    let base_url = url::Url::parse(&format!("https://{}/", domain))
        .map_err(|_| AuthError::InvalidDomain(domain.clone()))?;

    if let Some(existing) = app.get_webview_window(LOGIN_WINDOW_LABEL) {
        let _ = existing.close();
    }

    let (tx, rx) = oneshot::channel::<Result<(), AuthError>>();
    let tx = std::sync::Arc::new(Mutex::new(Some(tx)));

    let domain_for_load = domain.clone();
    let tx_for_load = tx.clone();
    let window = WebviewWindowBuilder::new(
        app,
        LOGIN_WINDOW_LABEL,
        WebviewUrl::External(login_url),
    )
    .title(format!("Sign in to {}", domain))
    .inner_size(960.0, 760.0)
    .on_page_load(move |_webview, payload| {
        if !matches!(payload.event(), PageLoadEvent::Finished) {
            return;
        }
        let url = payload.url();
        if url.host_str() != Some(&domain_for_load) {
            return;
        }
        // Canvas drops you at "/" (or "/?login_success=1") after SSO.
        // The /login path is the form we started on, so ignore it.
        let path = url.path();
        if path == "/login" || path.starts_with("/login/") {
            return;
        }
        if let Some(sender) = tx_for_load.lock().unwrap().take() {
            let _ = sender.send(Ok(()));
        }
    })
    .build()?;

    let tx_for_close = tx.clone();
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
            if let Some(sender) = tx_for_close.lock().unwrap().take() {
                let _ = sender.send(Err(AuthError::Cancelled));
            }
        }
    });

    let outcome = rx.await.unwrap_or(Err(AuthError::Cancelled));
    let raw_cookies = window.cookies_for_url(base_url).ok();
    let _ = window.close();
    outcome?;

    let raw_cookies = raw_cookies.ok_or(AuthError::Cancelled)?;
    let mut cookies = Vec::new();
    let mut csrf_token = None;
    for c in raw_cookies {
        let name = c.name().to_string();
        let value = c.value().to_string();
        let cdomain = c
            .domain()
            .map(|s| s.to_string())
            .unwrap_or_else(|| domain.clone());
        let path = c
            .path()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "/".to_string());
        if name == "_csrf_token" {
            csrf_token = Some(value.clone());
        }
        cookies.push(Cookie {
            name,
            value,
            domain: cdomain,
            path,
        });
    }

    let has_session = cookies
        .iter()
        .any(|c| c.name == "_normandy_session" || c.name == "canvas_session");
    if !has_session {
        return Err(AuthError::Cancelled);
    }

    Ok(Session {
        domain,
        cookies,
        csrf_token,
    })
}
