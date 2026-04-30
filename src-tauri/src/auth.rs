use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "com.performave.slayte";
const KEYRING_USER: &str = "canvas-session";

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
    #[error("keyring error: {0}")]
    Keyring(#[from] keyring::Error),
    #[error("serde error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("login cancelled")]
    Cancelled,
    #[error("session expired")]
    Expired,
}

pub fn save(session: &Session) -> Result<(), AuthError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    let payload = serde_json::to_string(session)?;
    entry.set_password(&payload)?;
    Ok(())
}

pub fn load() -> Result<Option<Session>, AuthError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    match entry.get_password() {
        Ok(payload) => Ok(Some(serde_json::from_str(&payload)?)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn clear() -> Result<(), AuthError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.into()),
    }
}

// TODO: open a Tauri WebviewWindow at https://{domain}/login,
// listen for navigation to the post-SSO dashboard, then read the platform
// cookie store (WKHTTPCookieStore on macOS, ICoreWebView2CookieManager on
// Windows, webkit2gtk on Linux) to extract _normandy_session + _csrf_token.
pub async fn begin_login(_app: &tauri::AppHandle, _domain: &str) -> Result<Session, AuthError> {
    Err(AuthError::Cancelled)
}
