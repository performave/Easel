mod api;
mod auth;
mod commands;
mod notifications;

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::RwLock;

pub struct AppState {
    pub session: RwLock<Option<auth::Session>>,
    pub http: Arc<api::HttpClient>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http = Arc::new(api::HttpClient::new());
    let state = AppState {
        session: RwLock::new(None),
        http,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(state)
        .setup(|app| {
            if let Ok(Some(session)) = auth::load(app.handle()) {
                let state = app.state::<AppState>();
                state.http.seed_from(&session);
                *state.session.blocking_write() = Some(session);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap,
            commands::begin_login,
            commands::current_user,
            commands::list_courses,
            commands::canvas_get,
            commands::canvas_get_all,
            commands::logout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
