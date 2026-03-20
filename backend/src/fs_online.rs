//! Онлайн файловая система для ZeroDay Game
//! Синхронизация между устройствами через PostgreSQL

use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, FromRow};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Модель файла из БД
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct GameFile {
    pub id: Uuid,
    pub user_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub path: String,
    pub kind: String,
    pub mime_type: Option<String>,
    pub extension: Option<String>,
    pub size_bytes: i64,
    pub content_text: Option<String>,
    pub content_hash: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// DTO для ответа (без чувствительных данных)
#[derive(Debug, Clone, Serialize)]
pub struct GameFileDto {
    pub id: String,
    pub name: String,
    pub path: String,
    pub kind: String,
    pub extension: Option<String>,
    pub size: u64,
    pub created_at: i64,
    pub updated_at: i64,
}

impl GameFile {
    pub fn to_dto(&self) -> GameFileDto {
        GameFileDto {
            id: self.id.to_string(),
            name: self.name.clone(),
            path: self.path.clone(),
            kind: self.kind.clone(),
            extension: self.extension.clone(),
            size: self.size_bytes as u64,
            created_at: self.created_at.timestamp_millis(),
            updated_at: self.updated_at.timestamp_millis(),
        }
    }
}

// ==================== Request/Response DTOs ====================

#[derive(Debug, Deserialize)]
pub struct FsListQuery {
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FsListResponse {
    pub ok: bool,
    pub entries: Vec<GameFileDto>,
}

#[derive(Debug, Deserialize)]
pub struct FsCreateRequest {
    pub path: String,
    pub kind: String, // "dir" или "file"
    pub content: Option<String>, // Для текстовых файлов
}

#[derive(Debug, Deserialize)]
pub struct FsDeleteRequest {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct FsMoveRequest {
    pub src_path: String,
    pub dst_path: String,
}

#[derive(Debug, Serialize)]
pub struct FsResponse {
    pub ok: bool,
    pub error: Option<String>,
}

// ==================== API Handlers ====================
/// Все функции принимают user_id как &str (UUID string)
/// Возвращают конкретный HttpResponse (не impl Responder)

/// Список файлов в папке
pub async fn fs_list(
    pool: web::Data<PgPool>,
    user_id: &str,
    query: web::Query<FsListQuery>,
) -> HttpResponse {
    let rel_path = query.path.clone().unwrap_or_default();
    
    // Нормализуем путь
    let path = rel_path.trim_matches('/');
    
    // Для списка файлов ищем все файлы у которых path начинается с parent_path
    let like_path = if path.is_empty() {
        "%".to_string()
    } else {
        format!("{}/%", path)
    };
    
    let user_uuid = match Uuid::parse_str(user_id) {
        Ok(u) => u,
        Err(_) => return HttpResponse::BadRequest().json(FsResponse { 
            ok: false, 
            error: Some("Invalid user ID format".to_string()) 
        }),
    };
    
    let entries = sqlx::query_as::<_, GameFile>(
        r#"
        SELECT * FROM game_files 
        WHERE user_id = $1 
          AND (path = $2 OR path LIKE $3)
          AND deleted_at IS NULL
        ORDER BY kind DESC, name ASC
        LIMIT 2000
        "#
    )
    .bind(user_uuid)
    .bind(path)
    .bind(&like_path)
    .fetch_all(pool.get_ref())
    .await;

    match entries {
        Ok(files) => {
            let dtos: Vec<GameFileDto> = files.into_iter().map(|f| f.to_dto()).collect();
            HttpResponse::Ok().json(FsListResponse { ok: true, entries: dtos })
        }
        Err(e) => HttpResponse::InternalServerError().json(FsResponse { 
            ok: false, 
            error: Some(format!("Database error: {}", e)) 
        }),
    }
}

/// Создать файл или папку
pub async fn fs_create(
    pool: web::Data<PgPool>,
    user_id: &str,
    req: web::Json<FsCreateRequest>,
) -> HttpResponse {
    let user_uuid = match Uuid::parse_str(user_id) {
        Ok(u) => u,
        Err(_) => return HttpResponse::BadRequest().json(FsResponse { 
            ok: false, 
            error: Some("Invalid user ID format".to_string()) 
        }),
    };
    
    let path = req.path.trim_matches('/');
    let kind = &req.kind;
    
    // Валидация
    if path.is_empty() {
        return HttpResponse::BadRequest().json(FsResponse { 
            ok: false, 
            error: Some("Path cannot be empty".to_string()) 
        });
    }
    
    if kind != "dir" && kind != "file" {
        return HttpResponse::BadRequest().json(FsResponse { 
            ok: false, 
            error: Some("Kind must be 'dir' or 'file'".to_string()) 
        });
    }
    
    // Проверка на существование
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM game_files WHERE user_id = $1 AND path = $2 AND deleted_at IS NULL)"
    )
    .bind(user_uuid)
    .bind(path)
    .fetch_one(pool.get_ref())
    .await;
    
    if matches!(exists, Ok(true)) {
        return HttpResponse::Conflict().json(FsResponse { 
            ok: false, 
            error: Some("File already exists".to_string()) 
        });
    }
    
    // Извлекаем имя файла из пути
    let name = path.split('/').last().unwrap_or(path).to_string();
    let extension = name.split('.').nth(1).map(|s| s.to_string());
    
    // Определяем parent_id
    let parent_path = path.rsplit_once('/').map(|(p, _)| p.to_string());
    
    let parent_id = if let Some(pp) = &parent_path {
        let pid = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM game_files WHERE user_id = $1 AND path = $2 AND kind = 'dir' AND deleted_at IS NULL"
        )
        .bind(user_uuid)
        .bind(pp)
        .fetch_optional(pool.get_ref())
        .await
        .ok()
        .flatten();
        pid
    } else {
        None // Корневой уровень
    };
    
    // Создаём запись
    let result = sqlx::query(
        r#"
        INSERT INTO game_files (user_id, parent_id, name, path, kind, extension, content_text, size_bytes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        "#
    )
    .bind(user_uuid)
    .bind(parent_id)
    .bind(&name)
    .bind(path)
    .bind(kind)
    .bind(&extension)
    .bind(&req.content)
    .bind(req.content.as_ref().map(|c| c.len() as i64).unwrap_or(0))
    .fetch_one(pool.get_ref())
    .await;
    
    match result {
        Ok(_) => HttpResponse::Created().json(FsResponse { ok: true, error: None }),
        Err(e) => HttpResponse::InternalServerError().json(FsResponse { 
            ok: false, 
            error: Some(format!("Database error: {}", e)) 
        }),
    }
}

/// Удалить файл или папку (soft delete)
pub async fn fs_delete(
    pool: web::Data<PgPool>,
    user_id: &str,
    req: web::Json<FsDeleteRequest>,
) -> HttpResponse {
    let user_uuid = match Uuid::parse_str(user_id) {
        Ok(u) => u,
        Err(_) => return HttpResponse::BadRequest().json(FsResponse { 
            ok: false, 
            error: Some("Invalid user ID format".to_string()) 
        }),
    };
    
    let path = req.path.trim_matches('/');
    
    // Soft delete с каскадом для вложенных файлов
    let result = sqlx::query(
        r#"
        UPDATE game_files 
        SET deleted_at = NOW()
        WHERE user_id = $1 AND (path = $2 OR path LIKE $3)
        "#
    )
    .bind(user_uuid)
    .bind(path)
    .bind(&format!("{}/%", path))
    .execute(pool.get_ref())
    .await;
    
    match result {
        Ok(_) => HttpResponse::Ok().json(FsResponse { ok: true, error: None }),
        Err(e) => HttpResponse::InternalServerError().json(FsResponse { 
            ok: false, 
            error: Some(format!("Database error: {}", e)) 
        }),
    }
}

/// Переместить файл или папку
pub async fn fs_move(
    pool: web::Data<PgPool>,
    user_id: &str,
    req: web::Json<FsMoveRequest>,
) -> HttpResponse {
    let user_uuid = match Uuid::parse_str(user_id) {
        Ok(u) => u,
        Err(_) => return HttpResponse::BadRequest().json(FsResponse { 
            ok: false, 
            error: Some("Invalid user ID format".to_string()) 
        }),
    };
    
    let src_path = req.src_path.trim_matches('/');
    let dst_path = req.dst_path.trim_matches('/');
    
    // Проверка существования источника
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM game_files WHERE user_id = $1 AND path = $2 AND deleted_at IS NULL)"
    )
    .bind(user_uuid)
    .bind(src_path)
    .fetch_one(pool.get_ref())
    .await;
    
    if !matches!(exists, Ok(true)) {
        return HttpResponse::NotFound().json(FsResponse { 
            ok: false, 
            error: Some("Source file not found".to_string()) 
        });
    }
    
    // Обновляем путь
    let result = sqlx::query(
        r#"
        UPDATE game_files 
        SET path = $3, 
            name = COALESCE(NULLIF(split_part($3, '/', -1), ''), name),
            updated_at = NOW()
        WHERE user_id = $1 AND path = $2 AND deleted_at IS NULL
        "#
    )
    .bind(user_uuid)
    .bind(src_path)
    .bind(dst_path)
    .execute(pool.get_ref())
    .await;
    
    match result {
        Ok(_) => HttpResponse::Ok().json(FsResponse { ok: true, error: None }),
        Err(e) => HttpResponse::InternalServerError().json(FsResponse { 
            ok: false, 
            error: Some(format!("Database error: {}", e)) 
        }),
    }
}

/// Получить содержимое текстового файла
pub async fn fs_read_text(
    pool: web::Data<PgPool>,
    user_id: &str,
    path: web::Path<String>,
) -> HttpResponse {
    let user_uuid = match Uuid::parse_str(user_id) {
        Ok(u) => u,
        Err(_) => return HttpResponse::BadRequest().finish(),
    };
    
    let path = path.trim_matches('/');

    let result = sqlx::query_scalar::<_, Option<String>>(
        "SELECT content_text FROM game_files WHERE user_id = $1 AND path = $2 AND kind = 'file' AND deleted_at IS NULL"
    )
    .bind(user_uuid)
    .bind(path)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(Some(content)) => HttpResponse::Ok().body(content),
        Ok(None) | Err(sqlx::Error::RowNotFound) => HttpResponse::NotFound().finish(),
        Err(_) => HttpResponse::InternalServerError().finish(),
    }
}

/// Записать содержимое текстового файла
pub async fn fs_write_text(
    pool: web::Data<PgPool>,
    user_id: &str,
    req: web::Json<FsCreateRequest>,
) -> HttpResponse {
    let user_uuid = match Uuid::parse_str(user_id) {
        Ok(u) => u,
        Err(_) => return HttpResponse::BadRequest().json(FsResponse { 
            ok: false, 
            error: Some("Invalid user ID format".to_string()) 
        }),
    };
    
    let path = req.path.trim_matches('/');
    let content = req.content.clone().unwrap_or_default();
    
    // Обновляем файл
    let result = sqlx::query(
        r#"
        UPDATE game_files 
        SET content_text = $3, 
            size_bytes = $4,
            updated_at = NOW()
        WHERE user_id = $1 AND path = $2 AND kind = 'file' AND deleted_at IS NULL
        "#
    )
    .bind(user_uuid)
    .bind(path)
    .bind(&content)
    .bind(content.len() as i64)
    .execute(pool.get_ref())
    .await;
    
    match result {
        Ok(_) => HttpResponse::Ok().json(FsResponse { ok: true, error: None }),
        Err(e) => HttpResponse::InternalServerError().json(FsResponse { 
            ok: false, 
            error: Some(format!("Database error: {}", e)) 
        }),
    }
}

// ==================== Инициализация системных папок ====================

/// Создаёт стандартную структуру папок для нового пользователя
pub async fn init_user_fs_structure(pool: &PgPool, user_id: Uuid) -> Result<(), sqlx::Error> {
    let folders = [
        "Desktop", "Documents", "Downloads", "Music", "Pictures", 
        "Videos", "Notes", "Scripts", "Photos", "Wallpapers", "Trash"
    ];
    
    for folder in &folders {
        sqlx::query(
            r#"
            INSERT INTO game_files (user_id, name, path, kind, extension)
            VALUES ($1, $2, $3, 'dir', NULL)
            ON CONFLICT (user_id, path) DO NOTHING
            "#
        )
        .bind(user_id)
        .bind(folder)
        .bind(folder)
        .execute(pool)
        .await?;
    }
    
    Ok(())
}
