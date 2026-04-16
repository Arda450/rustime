// holt den aktiven fenstertitel aus der windows api
// erzeugt zeitstempel

use crate::TrackingError;
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};

// Gibt aktuelle Unix-Zeit in Sekunden zurück
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
        let hwnd = GetForegroundWindow(); // hwnd ist ein handle to the active window, it is a pointer to the window handle
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
