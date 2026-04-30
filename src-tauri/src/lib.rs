mod api;
mod auth;
mod commands;
mod notifications;

use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub session: RwLock<Option<auth::Session>>,
    pub http: Arc<api::HttpClient>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState {
        session: RwLock::new(None),
        http: Arc::new(api::HttpClient::new()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::begin_login,
            commands::current_user,
            commands::list_courses,
            commands::logout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
