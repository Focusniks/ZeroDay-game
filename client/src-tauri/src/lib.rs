mod game_config;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            game_config::get_game_config,
            game_config::get_game_config_path,
            game_config::save_game_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

