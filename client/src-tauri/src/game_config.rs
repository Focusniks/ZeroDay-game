use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const CONFIG_FILENAME: &str = "zeroday_game.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GameConfig {
    pub version: u32,
    #[serde(default)]
    pub setup_complete: bool,
    pub ws_url: Option<String>,
    pub last_login_email_hint: Option<String>,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self {
            version: 1,
            setup_complete: false,
            ws_url: None,
            last_login_email_hint: None,
        }
    }
}

fn config_path() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe
        .parent()
        .ok_or_else(|| "executable has no parent directory".to_string())?;
    Ok(dir.join(CONFIG_FILENAME))
}

#[tauri::command]
pub fn get_game_config() -> Result<GameConfig, String> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(GameConfig::default());
    }
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_game_config_path() -> Result<String, String> {
    config_path().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn save_game_config(config: GameConfig) -> Result<(), String> {
    let path = config_path()?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}
