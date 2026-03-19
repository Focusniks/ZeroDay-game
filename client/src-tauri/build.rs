fn main() {
    ensure_windows_icon();
    tauri_build::build()
}

fn ensure_windows_icon() {
    use base64::Engine;

    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
    if manifest_dir.is_empty() {
        return;
    }

    let icons_dir = std::path::Path::new(&manifest_dir).join("icons");
    let icon_path = icons_dir.join("icon.ico");

    if icon_path.exists() {
        return;
    }

    let _ = std::fs::create_dir_all(&icons_dir);

    // Minimal 1x1px ICO (BGRA), base64-encoded.
    let b64 = "AAABAAEAAQEAAAEAIAAwAAAAFgAAACgAAAABAAAAAgAAAAEAIAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAD/////AAAAAA==";
    if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64) {
        let _ = std::fs::write(&icon_path, bytes);
    }
}

