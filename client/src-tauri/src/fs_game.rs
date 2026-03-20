use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use base64::{engine::general_purpose, Engine as _};

const FILES_DIRNAME: &str = "zeroday_game_files";
const USERS_DIRNAME: &str = "users";

// Soft guards for resource exhaustion. The game UI is expected to handle small-ish
// documents/scripts and moderate media sizes.
const MAX_LIST_ENTRIES: usize = 2000;
const MAX_RELPATH_CHARS: usize = 300;

const MAX_TEXT_BYTES: u64 = 2 * 1024 * 1024; // 2 MiB
const MAX_BINARY_BYTES: u64 = 15 * 1024 * 1024; // 15 MiB (decoded bytes)
const DISK_CAPACITY_BYTES: u64 = 512 * 1024 * 1024; // 512 MiB virtual disk

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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsDiskUsage {
  pub capacity_bytes: u64,
  pub used_bytes: u64,
  pub free_bytes: u64,
}

fn sanitize_user_scope(user_scope: &str) -> String {
  let trimmed = user_scope.trim();
  if trimmed.is_empty() {
    return "default".to_string();
  }
  let mut out = String::with_capacity(trimmed.len());
  for ch in trimmed.chars() {
    let ok = ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == '.';
    out.push(if ok { ch } else { '_' });
  }
  let out = out.trim_matches('.');
  if out.is_empty() {
    "default".to_string()
  } else {
    out.chars().take(80).collect()
  }
}

fn files_root(user_scope: Option<String>) -> Result<PathBuf, String> {
  let exe = std::env::current_exe().map_err(|e| e.to_string())?;
  let dir = exe
    .parent()
    .ok_or_else(|| "executable has no parent directory".to_string())?;
  let scope = sanitize_user_scope(user_scope.as_deref().unwrap_or("default"));
  Ok(dir.join(FILES_DIRNAME).join(USERS_DIRNAME).join(scope))
}

fn sanitize_rel_path(rel_path: &str) -> Result<PathBuf, String> {
  let rel_path = rel_path.replace('\\', "/");
  let rel_path = rel_path.trim();
  if rel_path.len() > MAX_RELPATH_CHARS {
    return Err("Path is too long".to_string());
  }
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

fn abs_from_rel(rel_path: &str, user_scope: Option<String>) -> Result<PathBuf, String> {
  let base = files_root(user_scope)?;
  let rel = sanitize_rel_path(rel_path)?;
  Ok(base.join(rel))
}

fn dir_size_recursive(path: &Path) -> Result<u64, String> {
  if !path.exists() {
    return Ok(0);
  }
  if path.is_file() {
    return fs::metadata(path).map(|m| m.len()).map_err(|e| e.to_string());
  }
  let mut sum: u64 = 0;
  let rd = fs::read_dir(path).map_err(|e| e.to_string())?;
  for entry in rd {
    let entry = entry.map_err(|e| e.to_string())?;
    let p = entry.path();
    if p.is_dir() {
      sum = sum
        .checked_add(dir_size_recursive(&p)?)
        .ok_or_else(|| "Disk usage overflow".to_string())?;
    } else {
      let sz = entry.metadata().map_err(|e| e.to_string())?.len();
      sum = sum
        .checked_add(sz)
        .ok_or_else(|| "Disk usage overflow".to_string())?;
    }
  }
  Ok(sum)
}

fn ensure_capacity_after_write(target_abs: &Path, new_size: u64, user_scope: Option<String>) -> Result<(), String> {
  let root = files_root(user_scope)?;
  let used = dir_size_recursive(&root)?;
  let old_size = if target_abs.exists() && target_abs.is_file() {
    fs::metadata(target_abs).map_err(|e| e.to_string())?.len()
  } else {
    0
  };
  let next_used = used
    .checked_sub(old_size)
    .and_then(|v| v.checked_add(new_size))
    .ok_or_else(|| "Disk usage overflow".to_string())?;
  if next_used > DISK_CAPACITY_BYTES {
    return Err(format!(
      "Not enough disk space (capacity {} bytes, used {} bytes, trying to write {} bytes)",
      DISK_CAPACITY_BYTES, used, new_size
    ));
  }
  Ok(())
}

fn is_root_rel(rel_path: &str) -> bool {
  let normalized = rel_path.replace('\\', "/").trim().to_string();
  normalized.is_empty() || normalized == "/"
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_init(userScope: Option<String>) -> Result<(), String> {
  let base = files_root(userScope)?;
  fs::create_dir_all(&base).map_err(|e| e.to_string())?;

  // Subfolders (physical)
  let photos = base.join("Photos");
  let videos = base.join("Videos");
  let notes = base.join("Notes");
  let scripts = base.join("Scripts");
  let wallpapers = base.join("Wallpapers");
  let trash = base.join("Trash");
  let desktop = base.join("Desktop");
  let documents = base.join("Documents");
  let music = base.join("Music");
  let downloads = base.join("Downloads");

  fs::create_dir_all(photos).map_err(|e| e.to_string())?;
  fs::create_dir_all(videos).map_err(|e| e.to_string())?;
  fs::create_dir_all(notes).map_err(|e| e.to_string())?;
  fs::create_dir_all(scripts).map_err(|e| e.to_string())?;
  fs::create_dir_all(wallpapers).map_err(|e| e.to_string())?;
  fs::create_dir_all(trash).map_err(|e| e.to_string())?;
  fs::create_dir_all(desktop).map_err(|e| e.to_string())?;
  fs::create_dir_all(documents).map_err(|e| e.to_string())?;
  fs::create_dir_all(music).map_err(|e| e.to_string())?;
  fs::create_dir_all(downloads).map_err(|e| e.to_string())?;
  Ok(())
}

// Создаёт полную структуру файловой системы Linux (симуляция через пустые папки)
#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_create_full_structure(userScope: Option<String>) -> Result<(), String> {
  let base = files_root(userScope)?;
  
  // Linux root directories
  let dirs = [
    "bin", "boot", "dev", "etc", "home", "home/user", "lib", "lib64",
    "media", "mnt", "opt", "proc", "root", "run", "sbin", "srv",
    "sys", "tmp", "usr", "usr/bin", "usr/lib", "usr/local", "usr/share",
    "var", "var/log", "var/cache", "var/tmp",
    // User directories
    "Desktop", "Documents", "Downloads", "Music", "Pictures", "Videos",
    "Notes", "Scripts", "Photos", "Wallpapers", "Trash"
  ];
  
  for dir in &dirs {
    let path = base.join(dir);
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
  }
  
  // Создаём несколько системных файлов-заглушек (пустые файлы для симуляции)
  let files = [
    ("etc/fstab", "# File system table\n/dev/vda2  /  ext4  defaults  0 1"),
    ("etc/hostname", "zeroday-pc"),
    ("etc/hosts", "127.0.0.1  localhost\n127.0.1.1  zeroday-pc"),
    ("etc/passwd", "root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:User:/home/user:/bin/bash"),
    ("etc/os-release", "NAME=\"ZeroDay OS\"\nVERSION=\"0.1\"\nID=zeroday\nPRETTY_NAME=\"ZeroDay GNU/Linux 0.1\""),
    ("proc/version", "Linux version 0.1.0 (zeroday)"),
    ("sys/kernel/hostname", "zeroday-pc"),
  ];
  
  for (file_path, content) in &files {
    let path = base.join(file_path);
    if let Some(parent) = path.parent() {
      fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, *content).map_err(|e| e.to_string())?;
  }
  
  Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_root_path(userScope: Option<String>) -> Result<String, String> {
  files_root(userScope)
    .map(|p| p.to_string_lossy().to_string())
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_disk_usage(userScope: Option<String>) -> Result<FsDiskUsage, String> {
  let root = files_root(userScope)?;
  let used = dir_size_recursive(&root)?;
  let free = DISK_CAPACITY_BYTES.saturating_sub(used);
  Ok(FsDiskUsage {
    capacity_bytes: DISK_CAPACITY_BYTES,
    used_bytes: used,
    free_bytes: free,
  })
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_list(relPath: String, userScope: Option<String>) -> Result<Vec<FsEntry>, String> {
  let abs = abs_from_rel(&relPath, userScope.clone())?;
  let base = files_root(userScope)?;

  let rd = fs::read_dir(&abs).map_err(|e| e.to_string())?;
  let mut out: Vec<FsEntry> = Vec::new();

  for entry in rd {
    if out.len() >= MAX_LIST_ENTRIES {
      return Err(format!(
        "Too many entries in this folder (max {}). Refusing to list further.",
        MAX_LIST_ENTRIES
      ));
    }
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
pub fn fs_mkdir(relPath: String, userScope: Option<String>) -> Result<(), String> {
  let abs = abs_from_rel(&relPath, userScope)?;
  fs::create_dir_all(&abs).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_delete(relPath: String, userScope: Option<String>) -> Result<(), String> {
  if is_root_rel(&relPath) {
    return Err("Refusing to delete filesystem root".to_string());
  }
  let abs = abs_from_rel(&relPath, userScope)?;
  if abs.is_dir() {
    fs::remove_dir_all(&abs).map_err(|e| e.to_string())?;
  } else {
    fs::remove_file(&abs).map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_read_text(relPath: String, userScope: Option<String>) -> Result<String, String> {
  if is_root_rel(&relPath) {
    return Err("Refusing to read filesystem root".to_string());
  }
  let abs = abs_from_rel(&relPath, userScope)?;
  let meta = fs::metadata(&abs).map_err(|e| e.to_string())?;
  if meta.is_dir() {
    return Err(
      "Is a directory: cat cannot read folders (use ls)".to_string(),
    );
  }
  if !meta.is_file() {
    return Err("Not a regular file".to_string());
  }
  if meta.len() > MAX_TEXT_BYTES {
    return Err(format!(
      "Text file is too large (max {} bytes)",
      MAX_TEXT_BYTES
    ));
  }
  fs::read_to_string(&abs).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_write_text(relPath: String, content: String, userScope: Option<String>) -> Result<(), String> {
  if is_root_rel(&relPath) {
    return Err("Refusing to write to filesystem root".to_string());
  }
  if content.len() as u64 > MAX_TEXT_BYTES {
    return Err(format!(
      "Text payload is too large (max {} bytes)",
      MAX_TEXT_BYTES
    ));
  }
  let abs = abs_from_rel(&relPath, userScope.clone())?;
  if let Some(parent) = abs.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  ensure_capacity_after_write(&abs, content.len() as u64, userScope)?;
  fs::write(&abs, content).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_read_bytes_base64(relPath: String, userScope: Option<String>) -> Result<String, String> {
  if is_root_rel(&relPath) {
    return Err("Refusing to read filesystem root".to_string());
  }
  let abs = abs_from_rel(&relPath, userScope)?;
  let meta = fs::metadata(&abs).map_err(|e| e.to_string())?;
  if meta.is_dir() {
    return Err("Is a directory (cannot read as binary file)".to_string());
  }
  if !meta.is_file() {
    return Err("Not a regular file".to_string());
  }
  if meta.len() > MAX_BINARY_BYTES {
    return Err(format!(
      "Binary file is too large (max {} bytes, decoded)",
      MAX_BINARY_BYTES
    ));
  }
  let bytes = fs::read(&abs).map_err(|e| e.to_string())?;
  Ok(general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_write_bytes_base64(
  relPath: String,
  contentBase64: String,
  userScope: Option<String>,
) -> Result<(), String> {
  if is_root_rel(&relPath) {
    return Err("Refusing to write to filesystem root".to_string());
  }
  let abs = abs_from_rel(&relPath, userScope.clone())?;
  if let Some(parent) = abs.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  // Base64 expands ~4/3. We cap the encoded payload too, to avoid huge allocations
  // during decode.
  const BASE64_OVERHEAD_NUM: u64 = 4;
  const BASE64_OVERHEAD_DEN: u64 = 3;
  let max_base64_len = (MAX_BINARY_BYTES * BASE64_OVERHEAD_NUM) / BASE64_OVERHEAD_DEN + 4096;
  if contentBase64.len() as u64 > max_base64_len {
    return Err(format!(
      "Base64 payload is too large (max {} chars)",
      max_base64_len
    ));
  }

  let bytes = general_purpose::STANDARD
    .decode(contentBase64.as_bytes())
    .map_err(|e| e.to_string())?;
  if bytes.len() as u64 > MAX_BINARY_BYTES {
    return Err(format!(
      "Decoded binary payload is too large (max {} bytes)",
      MAX_BINARY_BYTES
    ));
  }
  ensure_capacity_after_write(&abs, bytes.len() as u64, userScope)?;
  fs::write(&abs, bytes).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn fs_move(srcRelPath: String, dstRelPath: String, userScope: Option<String>) -> Result<(), String> {
  if is_root_rel(&srcRelPath) || is_root_rel(&dstRelPath) {
    return Err("Refusing to move filesystem root".to_string());
  }
  let src = abs_from_rel(&srcRelPath, userScope.clone())?;
  let dst = abs_from_rel(&dstRelPath, userScope)?;
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

