//! Управление сайтами браузера ZeroDay
//! Сайты хранятся в папке sites/ с возможностью добавления файлов

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Модель сайта
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Site {
    pub id: String,
    pub name: String,
    pub url: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub category: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Список всех доступных сайтов
pub fn get_all_sites() -> Vec<Site> {
    let sites_dir = get_sites_root();
    let mut sites = Vec::new();
    
    if !sites_dir.exists() {
        return sites;
    }
    
    if let Ok(entries) = fs::read_dir(&sites_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let site_name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                
                let site = Site {
                    id: Uuid::new_v4().to_string(),
                    name: site_name.clone(),
                    url: format!("zeroday://{}", site_name),
                    description: Some(format!("{} site", site_name)),
                    icon_url: Some(format!("/sites/{}/icon.svg", site_name)),
                    category: get_site_category(&site_name),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                };
                sites.push(site);
            }
        }
    }
    
    sites.sort_by(|a, b| a.name.cmp(&b.name));
    sites
}

fn get_site_category(name: &str) -> String {
    match name {
        "home" | "search" | "bookmarks" | "settings" => "system".to_string(),
        "messenger" | "market" | "news" | "forum" => "services".to_string(),
        _ => "general".to_string(),
    }
}

fn get_sites_root() -> PathBuf {
    // Ищем папку sites начиная от текущей директории (где запущен бэкенд)
    // Это позволяет использовать файлы напрямую из backend/sites/ без копирования
    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let sites_dir = current_dir.join("sites");
    
    // Если папка существует — используем её
    if sites_dir.exists() {
        return sites_dir;
    }
    
    // Иначе пробуем найти относительно exe (для release сборок)
    let exe = std::env::current_exe().unwrap_or_default();
    let dir = exe.parent().unwrap_or(Path::new("."));
    dir.join("sites")
}

pub fn get_site_folder(site_name: &str) -> PathBuf {
    get_sites_root().join(site_name)
}

/// Получить файл сайта по пути
pub fn get_site_file(site_name: &str, file_path: &str) -> Option<Vec<u8>> {
    let site_dir = get_site_folder(site_name);
    let file = site_dir.join(file_path);
    
    // Защита от выхода за пределы папки сайта
    if !file.starts_with(&site_dir) {
        return None;
    }
    
    fs::read(&file).ok()
}

/// Создать новый сайт (папку)
pub fn create_site(name: &str) -> Result<Site, String> {
    let site_dir = get_site_folder(name);
    
    if site_dir.exists() {
        return Err("Site already exists".to_string());
    }
    
    fs::create_dir_all(&site_dir)
        .map_err(|e| format!("Failed to create site folder: {}", e))?;
    
    // Создаём index.html по умолчанию
    let index_path = site_dir.join("index.html");
    let default_html = format!(r#"<!DOCTYPE html>
<html>
<head>
    <title>{name}</title>
    <style>
        body {{
            font-family: system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            color: #f1f5f9;
            min-height: 100vh;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        .container {{
            text-align: center;
            padding: 2rem;
        }}
        h1 {{ font-size: 2.5rem; margin-bottom: 1rem; }}
        p {{ color: #94a3b8; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{name}</h1>
        <p>Welcome to ZeroDay Browser</p>
    </div>
</body>
</html>"#);
    
    fs::write(&index_path, default_html)
        .map_err(|e| format!("Failed to create index.html: {}", e))?;
    
    Ok(Site {
        id: Uuid::new_v4().to_string(),
        name: name.to_string(),
        url: format!("zeroday://{}", name),
        description: Some(format!("{} site", name)),
        icon_url: Some(format!("/sites/{}/icon.svg", name)),
        category: get_site_category(name),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    })
}

/// Удалить сайт
pub fn delete_site(name: &str) -> Result<(), String> {
    let site_dir = get_site_folder(name);
    
    if !site_dir.exists() {
        return Err("Site not found".to_string());
    }
    
    fs::remove_dir_all(&site_dir)
        .map_err(|e| format!("Failed to delete site: {}", e))
}

/// Получить список файлов сайта
pub fn list_site_files(site_name: &str) -> Result<Vec<SiteFile>, String> {
    let site_dir = get_site_folder(site_name);
    
    if !site_dir.exists() {
        return Err("Site not found".to_string());
    }
    
    let mut files = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&site_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();
            
            let rel_path = path.strip_prefix(&site_dir)
                .unwrap_or(Path::new(&name))
                .to_string_lossy()
                .replace('\\', "/");
            
            files.push(SiteFile {
                name,
                path: rel_path,
                is_dir: path.is_dir(),
                size: path.metadata().map(|m| m.len()).unwrap_or(0),
            });
        }
    }
    
    Ok(files)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteFile {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

/// Загрузить файл в сайт
pub fn upload_site_file(
    site_name: &str,
    file_path: &str,
    content: &[u8],
) -> Result<(), String> {
    let site_dir = get_site_folder(site_name);
    
    if !site_dir.exists() {
        return Err("Site not found".to_string());
    }
    
    // Защита от выхода за пределы папки сайта
    let target = site_dir.join(file_path);
    if !target.starts_with(&site_dir) {
        return Err("Invalid file path".to_string());
    }
    
    // Создаём родительские папки
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    
    fs::write(&target, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

/// Удалить файл сайта
pub fn delete_site_file(site_name: &str, file_path: &str) -> Result<(), String> {
    let site_dir = get_site_folder(site_name);
    let file = site_dir.join(file_path);
    
    if !file.exists() {
        return Err("File not found".to_string());
    }
    
    if !file.starts_with(&site_dir) {
        return Err("Invalid file path".to_string());
    }
    
    fs::remove_file(&file)
        .or_else(|_| fs::remove_dir_all(&file))
        .map_err(|e| format!("Failed to delete file: {}", e))
}
