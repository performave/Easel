use futures_util::StreamExt;
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use url::Url;

use crate::api::courses::Course;
use crate::api::HttpClient;
use crate::auth::{self, Session};
use crate::AppState;

#[derive(Debug, Serialize)]
pub struct CommandError {
    message: String,
}

impl<E: std::fmt::Display> From<E> for CommandError {
    fn from(e: E) -> Self {
        Self {
            message: e.to_string(),
        }
    }
}

/// Read the active session, cloning it out so callers don't have to hold the
/// lock across `await` points. Errors uniformly when unauthenticated.
async fn require_session(state: &State<'_, AppState>) -> Result<Session, CommandError> {
    state
        .session
        .read()
        .await
        .as_ref()
        .cloned()
        .ok_or_else(|| CommandError {
            message: "not authenticated".into(),
        })
}

#[derive(Debug, Serialize)]
pub struct BootstrapInfo {
    pub authenticated: bool,
    pub domain: Option<String>,
}

#[tauri::command]
pub async fn bootstrap(state: State<'_, AppState>) -> Result<BootstrapInfo, CommandError> {
    let guard = state.session.read().await;
    Ok(BootstrapInfo {
        authenticated: guard.is_some(),
        domain: guard.as_ref().map(|s| s.domain.clone()),
    })
}

#[tauri::command]
pub async fn begin_login(
    app: AppHandle,
    state: State<'_, AppState>,
    domain: String,
) -> Result<BootstrapInfo, CommandError> {
    let session = auth::begin_login(&app, &domain).await?;
    state.http.seed_from(&session);
    auth::save(&app, &session)?;
    let info = BootstrapInfo {
        authenticated: true,
        domain: Some(session.domain.clone()),
    };
    *state.session.write().await = Some(session);
    Ok(info)
}

#[tauri::command]
pub async fn current_user(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, CommandError> {
    let session = require_session(&state).await?;
    let user = state
        .http
        .get_json::<serde_json::Value>(&session, "/api/v1/users/self")
        .await?;
    Ok(user)
}

/// Generic Canvas API proxy. The frontend passes a path beginning with `/api/v1/...`
/// and we attach session cookies + return raw JSON. Restricting to absolute
/// same-origin paths means a compromised renderer can't pivot to other hosts.
#[tauri::command]
pub async fn canvas_get(
    state: State<'_, AppState>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    let path = require_safe_path(&path)?;
    let session = require_session(&state).await?;
    Ok(state.http.get_json::<serde_json::Value>(&session, &path).await?)
}

#[tauri::command]
pub async fn canvas_get_all(
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<serde_json::Value>, CommandError> {
    let path = require_safe_path(&path)?;
    let session = require_session(&state).await?;
    Ok(state.http.get_paginated(&session, &path).await?)
}

#[tauri::command]
pub async fn canvas_request(
    state: State<'_, AppState>,
    method: String,
    path: String,
    form: Option<HashMap<String, String>>,
    json: Option<serde_json::Value>,
) -> Result<serde_json::Value, CommandError> {
    let path = require_safe_path(&path)?;
    let session = require_session(&state).await?;
    Ok(state
        .http
        .request_json(&session, &method, &path, form.as_ref(), json.as_ref())
        .await?)
}

#[tauri::command]
pub async fn canvas_asset_data_url(
    state: State<'_, AppState>,
    path_or_url: String,
) -> Result<String, CommandError> {
    let session = require_session(&state).await?;

    let url = resolve_canvas_asset_url(&session, &path_or_url)?;
    let resp = state.http.client.get(&url).send().await?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(CommandError {
            message: format!("canvas error {}: {}", status.as_u16(), body),
        });
    }

    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(';').next().unwrap_or("application/octet-stream"))
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = resp.bytes().await?;
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
    Ok(format!("data:{};base64,{}", content_type, b64))
}

fn require_safe_path(path: &str) -> Result<String, CommandError> {
    if !path.starts_with('/') {
        return Err(CommandError {
            message: "path must start with '/'".into(),
        });
    }
    Ok(path.to_string())
}

fn resolve_canvas_asset_url(session: &Session, path_or_url: &str) -> Result<String, CommandError> {
    if path_or_url.starts_with('/') {
        return Ok(format!("https://{}{}", session.domain, path_or_url));
    }

    let parsed = Url::parse(path_or_url).map_err(|_| CommandError {
        message: "invalid asset URL".into(),
    })?;

    let host = parsed.host_str().ok_or_else(|| CommandError {
        message: "invalid asset URL host".into(),
    })?;
    if !host.eq_ignore_ascii_case(&session.domain) {
        return Err(CommandError {
            message: "asset URL must be on authenticated Canvas domain".into(),
        });
    }

    Ok(parsed.to_string())
}

#[tauri::command]
pub async fn list_courses(state: State<'_, AppState>) -> Result<Vec<Course>, CommandError> {
    let session = require_session(&state).await?;
    let courses = state
        .http
        .get_json::<Vec<Course>>(
            &session,
            "/api/v1/courses?enrollment_state=active&per_page=100",
        )
        .await?;
    Ok(courses)
}

#[derive(Clone, Serialize)]
struct DownloadProgress {
    file_id: u64,
    downloaded: u64,
    total: Option<u64>,
}

/// Fetch a file's download URL and a filesystem-safe filename from its metadata.
async fn fetch_download_meta(
    http: &HttpClient,
    session: &Session,
    file_id: u64,
) -> Result<(String, String), CommandError> {
    let path = format!("/api/v1/files/{}", file_id);
    let file_info = http.get_json::<serde_json::Value>(session, &path).await?;
    let download_url = file_info["url"]
        .as_str()
        .ok_or_else(|| CommandError {
            message: "missing download URL in file metadata".into(),
        })?
        .to_string();
    let filename = file_info["filename"].as_str().unwrap_or("download");
    let safe_name = Path::new(filename)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("download")
        .to_string();
    Ok((download_url, safe_name))
}

/// Stream a download to `dest`, emitting `file-download-progress` events as it goes.
async fn stream_download(
    app: &AppHandle,
    http: &HttpClient,
    file_id: u64,
    download_url: &str,
    dest: &Path,
) -> Result<(), CommandError> {
    let resp = http.client.get(download_url).send().await?;
    let total = resp.content_length();
    let mut stream = resp.bytes_stream();

    let mut file_data: Vec<u8> = Vec::new();
    if let Some(t) = total {
        file_data.reserve(t as usize);
    }
    let mut downloaded = 0u64;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        downloaded += chunk.len() as u64;
        file_data.extend_from_slice(&chunk);
        let _ = app.emit(
            "file-download-progress",
            DownloadProgress {
                file_id,
                downloaded,
                total,
            },
        );
    }

    std::fs::write(dest, &file_data)?;
    Ok(())
}

#[tauri::command]
pub async fn download_and_open_file(
    app: AppHandle,
    state: State<'_, AppState>,
    file_id: u64,
) -> Result<(), CommandError> {
    let session = require_session(&state).await?;
    let (download_url, safe_name) = fetch_download_meta(&state.http, &session, file_id).await?;

    let dest = std::env::temp_dir().join(&safe_name);
    stream_download(&app, &state.http, file_id, &download_url, &dest).await?;

    app.opener()
        .open_path(dest.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| CommandError { message: e.to_string() })?;

    Ok(())
}

#[tauri::command]
pub async fn download_file_to(
    app: AppHandle,
    state: State<'_, AppState>,
    file_id: u64,
) -> Result<(), CommandError> {
    let session = require_session(&state).await?;
    let (download_url, safe_name) = fetch_download_meta(&state.http, &session, file_id).await?;

    let (tx, rx) = tokio::sync::oneshot::channel::<Option<PathBuf>>();
    let tx = std::sync::Mutex::new(Some(tx));
    app.dialog()
        .file()
        .set_file_name(&safe_name)
        .save_file(move |path| {
            if let Some(sender) = tx.lock().unwrap().take() {
                let _ = sender.send(path.map(|p| p.as_path().unwrap().to_path_buf()));
            }
        });

    let dest = rx.await.map_err(|_| CommandError { message: "dialog closed".into() })?;
    let dest = match dest {
        Some(p) => p,
        None => return Ok(()),
    };

    stream_download(&app, &state.http, file_id, &download_url, &dest).await?;
    Ok(())
}

#[tauri::command]
pub async fn logout(app: AppHandle, state: State<'_, AppState>) -> Result<(), CommandError> {
    let prior = state.session.write().await.take();
    if let Some(session) = prior {
        let _ = state.http.post(&session, "/logout").await;
    }
    auth::clear(&app)?;
    auth::clear_browsing_data(&app)?;
    Ok(())
}
