// Polls /api/v1/users/self/activity_stream and /upcoming_events on an interval,
// diffs against last-seen IDs, fires OS notifications via tauri-plugin-notification.
// TODO: wire up the actual loop once auth is in place.

pub const FOREGROUND_INTERVAL_SECS: u64 = 5 * 60;
pub const BACKGROUND_INTERVAL_SECS: u64 = 15 * 60;
