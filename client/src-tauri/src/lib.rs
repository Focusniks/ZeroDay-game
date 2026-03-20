mod game_config;
mod fs_game;

/// Every command here needs a matching ACL entry:
/// `permissions/game-config.toml` + `capabilities/default.json`.
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            game_config::get_game_config,
            game_config::get_game_config_path,
            game_config::save_game_config,
            fs_game::fs_init,
            fs_game::fs_create_full_structure,
            fs_game::fs_root_path,
            fs_game::fs_disk_usage,
            fs_game::fs_list,
            fs_game::fs_mkdir,
            fs_game::fs_delete,
            fs_game::fs_read_text,
            fs_game::fs_write_text,
            fs_game::fs_read_bytes_base64,
            fs_game::fs_write_bytes_base64,
            fs_game::fs_move,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

