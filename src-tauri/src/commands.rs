use serde::Serialize;
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

#[tauri::command]
pub async fn begin_login(
    app: AppHandle,
    state: State<'_, AppState>,
    domain: String,
) -> Result<(), CommandError> {
    let session = auth::begin_login(&app, &domain).await?;
    state.http.seed_from(&session);
    auth::save(&session)?;
    *state.session.write().await = Some(session);
    Ok(())
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
pub async fn logout(state: State<'_, AppState>) -> Result<(), CommandError> {
    auth::clear()?;
    *state.session.write().await = None;
    Ok(())
}
