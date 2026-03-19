use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use base64::{engine::general_purpose, Engine as _};

const FILES_DIRNAME: &str = "zeroday_game_files";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
  pub name: String,
  pub rel_path: String,
  pub kind: FsKind,
  pub ext: Option<String>,
  pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FsKind {
  Dir,
  File,
}

fn files_root() -> Result<PathBuf, String> {
  let exe = std::env::current_exe().map_err(|e| e.to_string())?;
  let dir = exe
    .parent()
    .ok_or_else(|| "executable has no parent directory".to_string())?;
  Ok(dir.join(FILES_DIRNAME))
}

fn sanitize_rel_path(rel_path: &str) -> Result<PathBuf, String> {
  let rel_path = rel_path.replace('\\', "/");
  let rel_path = rel_path.trim();
  if rel_path.is_empty() || rel_path == "/" {
    return Ok(PathBuf::new());
  }

  if rel_path.starts_with('/') || rel_path.contains(':') {
    return Err("absolute paths are not allowed".to_string());
  }

  let mut out = PathBuf::new();
  let p = Path::new(rel_path);
  for c in p.components() {
    match c {
      Component::Normal(seg) => out.push(seg),
      Component::CurDir => {}
      Component::ParentDir => return Err(".. is not allowed in paths".to_string()),
      Component::RootDir | Component::Prefix(_) => return Err("absolute paths are not allowed".to_string()),
    }
  }
  Ok(out)
}

fn abs_from_rel(rel_path: &str) -> Result<PathBuf, String> {
  let base = files_root()?;
  let rel = sanitize_rel_path(rel_path)?;
  Ok(base.join(rel))
}

#[tauri::command]
pub fn fs_init() -> Result<(), String> {
  let base = files_root()?;
  fs::create_dir_all(&base).map_err(|e| e.to_string())?;

  // Subfolders (physical)
  let photos = base.join("Photos");
  let videos = base.join("Videos");
  let notes = base.join("Notes");
  let scripts = base.join("Scripts");

  fs::create_dir_all(photos).map_err(|e| e.to_string())?;
  fs::create_dir_all(videos).map_err(|e| e.to_string())?;
  fs::create_dir_all(notes).map_err(|e| e.to_string())?;
  fs::create_dir_all(scripts).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub fn fs_root_path() -> Result<String, String> {
  files_root()
    .map(|p| p.to_string_lossy().to_string())
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_list(relPath: String) -> Result<Vec<FsEntry>, String> {
  let abs = abs_from_rel(&relPath)?;
  let base = files_root()?;

  let rd = fs::read_dir(&abs).map_err(|e| e.to_string())?;
  let mut out: Vec<FsEntry> = Vec::new();

  for entry in rd {
    let entry = entry.map_err(|e| e.to_string())?;
    let meta = entry.metadata().map_err(|e| e.to_string())?;
    let name = entry.file_name().to_string_lossy().to_string();
    let is_dir = meta.is_dir();
    let kind = if is_dir { FsKind::Dir } else { FsKind::File };

    let ext = entry
      .path()
      .extension()
      .and_then(|s| s.to_str())
      .map(|s| s.to_string());

    let size = meta.len();

    let abs_child = entry.path();
    let rel = abs_child.strip_prefix(&base).unwrap_or(Path::new(&name));
    let rel_norm = rel.to_string_lossy().replace('\\', "/");

    out.push(FsEntry {
      name,
      rel_path: rel_norm,
      kind,
      ext,
      size,
    });
  }

  // Sort: dirs first, then name
  out.sort_by(|a, b| {
    let k = match (&a.kind, &b.kind) {
      (FsKind::Dir, FsKind::File) => std::cmp::Ordering::Less,
      (FsKind::File, FsKind::Dir) => std::cmp::Ordering::Greater,
      _ => std::cmp::Ordering::Equal,
    };
    if k != std::cmp::Ordering::Equal {
      return k;
    }
    a.name.to_lowercase().cmp(&b.name.to_lowercase())
  });

  Ok(out)
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_mkdir(relPath: String) -> Result<(), String> {
  let abs = abs_from_rel(&relPath)?;
  fs::create_dir_all(&abs).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_delete(relPath: String) -> Result<(), String> {
  let abs = abs_from_rel(&relPath)?;
  if abs.is_dir() {
    fs::remove_dir_all(&abs).map_err(|e| e.to_string())?;
  } else {
    fs::remove_file(&abs).map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_read_text(relPath: String) -> Result<String, String> {
  let abs = abs_from_rel(&relPath)?;
  fs::read_to_string(&abs).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_write_text(relPath: String, content: String) -> Result<(), String> {
  let abs = abs_from_rel(&relPath)?;
  if let Some(parent) = abs.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::write(&abs, content).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_read_bytes_base64(relPath: String) -> Result<String, String> {
  let abs = abs_from_rel(&relPath)?;
  let bytes = fs::read(&abs).map_err(|e| e.to_string())?;
  Ok(general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_write_bytes_base64(relPath: String, contentBase64: String) -> Result<(), String> {
  let abs = abs_from_rel(&relPath)?;
  if let Some(parent) = abs.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  let bytes = general_purpose::STANDARD
    .decode(contentBase64.as_bytes())
    .map_err(|e| e.to_string())?;
  fs::write(&abs, bytes).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_move(srcRelPath: String, dstRelPath: String) -> Result<(), String> {
  let src = abs_from_rel(&srcRelPath)?;
  let dst = abs_from_rel(&dstRelPath)?;
  if let Some(parent) = dst.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }

  // Try rename first (fast)
  if let Err(_e) = fs::rename(&src, &dst) {
    // Fallback: copy + delete
    if src.is_dir() {
      fs_extra_dir_copy(&src, &dst).map_err(|e| e.to_string())?;
      fs::remove_dir_all(&src).map_err(|e| e.to_string())?;
    } else {
      fs::copy(&src, &dst).map_err(|e| e.to_string())?;
      fs::remove_file(&src).map_err(|e| e.to_string())?;
    }
  }

  Ok(())
}

fn fs_extra_dir_copy(src: &Path, dst: &Path) -> Result<(), String> {
  fs::create_dir_all(dst).map_err(|e| e.to_string())?;
  let rd = fs::read_dir(src).map_err(|e| e.to_string())?;
  for entry in rd {
    let entry = entry.map_err(|e| e.to_string())?;
    let path = entry.path();
    let name = entry.file_name();
    let target = dst.join(name);
    if path.is_dir() {
      fs_extra_dir_copy(&path, &target)?;
    } else {
      fs::copy(&path, &target).map_err(|e| e.to_string())?;
    }
  }
  Ok(())
}

