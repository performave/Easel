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
    let http = Arc::new(api::HttpClient::new());
    let restored = auth::load().ok().flatten();
    if let Some(ref session) = restored {
        http.seed_from(session);
    }
    let state = AppState {
        session: RwLock::new(restored),
        http,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(state)
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
