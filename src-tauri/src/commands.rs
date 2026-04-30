use serde::Serialize;
use std::collections::HashMap;
use tauri::{AppHandle, State};

use crate::api::courses::Course;
use crate::auth;
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
    let guard = state.session.read().await;
    let session = guard.as_ref().ok_or_else(|| CommandError {
        message: "not authenticated".into(),
    })?;
    let user = state
        .http
        .get_json::<serde_json::Value>(session, "/api/v1/users/self")
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
    let guard = state.session.read().await;
    let session = guard.as_ref().ok_or_else(|| CommandError {
        message: "not authenticated".into(),
    })?;
    Ok(state.http.get_json::<serde_json::Value>(session, &path).await?)
}

#[tauri::command]
pub async fn canvas_get_all(
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<serde_json::Value>, CommandError> {
    let path = require_safe_path(&path)?;
    let guard = state.session.read().await;
    let session = guard.as_ref().ok_or_else(|| CommandError {
        message: "not authenticated".into(),
    })?;
    Ok(state.http.get_paginated(session, &path).await?)
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
    let guard = state.session.read().await;
    let session = guard.as_ref().ok_or_else(|| CommandError {
        message: "not authenticated".into(),
    })?;
    Ok(state
        .http
        .request_json(session, &method, &path, form.as_ref(), json.as_ref())
        .await?)
}

fn require_safe_path(path: &str) -> Result<String, CommandError> {
    if !path.starts_with('/') {
        return Err(CommandError {
            message: "path must start with '/'".into(),
        });
    }
    Ok(path.to_string())
}

#[tauri::command]
pub async fn list_courses(state: State<'_, AppState>) -> Result<Vec<Course>, CommandError> {
    let guard = state.session.read().await;
    let session = guard.as_ref().ok_or_else(|| CommandError {
        message: "not authenticated".into(),
    })?;
    let courses = state
        .http
        .get_json::<Vec<Course>>(
            session,
            "/api/v1/courses?enrollment_state=active&per_page=100",
        )
        .await?;
    Ok(courses)
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
