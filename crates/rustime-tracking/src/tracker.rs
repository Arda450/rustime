use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};
use crate::TrackingError;

pub fn current_timestamp() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

// get the title of the active window
pub fn try_get_active_window_title() -> Result<String, TrackingError> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return Err(TrackingError::WindowNotFound);
        }

        let mut title: [u16; 512] = [0; 512];
        let len = GetWindowTextW(hwnd, &mut title);
        if len <= 0 {
            return Err(TrackingError::EmptyTitle);
        }

        Ok(String::from_utf16_lossy(&title[..len as usize]))
    }
}

pub fn get_active_window_title() -> String {
    try_get_active_window_title().unwrap_or_default()
}
