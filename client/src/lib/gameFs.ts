import { invoke } from "@tauri-apps/api/core";

export type FsKind = "dir" | "file";

export type FsEntry = {
  name: string;
  relPath: string;
  kind: FsKind;
  ext?: string | null;
  size: number;
};

export type FsDiskUsage = {
  capacityBytes: number;
  usedBytes: number;
  freeBytes: number;
};

const STORAGE_USER_KEY = "zeroday.user";
const STORAGE_JWT_KEY = "zeroday.jwt";

/** Получает JWT токен из localStorage */
function getJwtToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_JWT_KEY);
  } catch {
    return null;
  }
}

/**
 * Получает userScope для идентификации пользователя.
 * Приоритет:
 * 1. JWT токен (безопасно, user_id из claims)
 * 2. localStorage (fallback для совместимости)
 * 3. "default"
 */
function getUserScope(): string {
  // Пытаемся получить user_id из JWT токена
  const token = getJwtToken();
  if (token) {
    try {
      // Декодируем JWT (payload без проверки подписи - это делает Tauri)
      const base64Url = token.split('.')[1];
      if (base64Url) {
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const claims = JSON.parse(jsonPayload) as { sub?: string; user_id?: string };
        const userId = claims.sub || claims.user_id;
        if (userId) {
          return `user_${userId}`;
        }
      }
    } catch {
      // JWT декодирование не удалось, fallback
    }
  }

  // Fallback: localStorage (старая логика)
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    if (!raw) return "default";
    const parsed = JSON.parse(raw) as { id?: string; email?: string; username?: string } | null;
    const base = parsed?.id || parsed?.email || parsed?.username || "default";
    return String(base);
  } catch {
    return "default";
  }
}

export async function initGameFs(): Promise<void> {
  try {
    await invoke("fs_init", { userScope: getUserScope() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_init failed: ${msg}`);
  }
}

export async function createFullFsStructure(): Promise<void> {
  try {
    await invoke("fs_create_full_structure", { userScope: getUserScope() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_create_full_structure failed: ${msg}`);
  }
}

export async function getGameFilesRootPath(): Promise<string> {
  try {
    return await invoke("fs_root_path", { userScope: getUserScope() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_root_path failed: ${msg}`);
  }
}

export async function listFs(relPath: string): Promise<FsEntry[]> {
  try {
    const items = await invoke<Array<unknown>>("fs_list", { relPath, userScope: getUserScope() });
  // Tauri serde -> camelCase for FsEntry
    return items as FsEntry[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_list failed: ${msg}`);
  }
}

export async function getFsDiskUsage(): Promise<FsDiskUsage> {
  try {
    return await invoke<FsDiskUsage>("fs_disk_usage", { userScope: getUserScope() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_disk_usage failed: ${msg}`);
  }
}

export async function mkdirFs(relPath: string): Promise<void> {
  try {
    await invoke("fs_mkdir", { relPath, userScope: getUserScope() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_mkdir failed: ${msg}`);
  }
}

export async function deleteFs(relPath: string): Promise<void> {
  try {
    await invoke("fs_delete", { relPath, userScope: getUserScope() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_delete failed: ${msg}`);
  }
}

export async function readTextFs(relPath: string): Promise<string> {
  try {
    return await invoke("fs_read_text", { relPath, userScope: getUserScope() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_read_text failed: ${msg}`);
  }
}

export async function writeTextFs(relPath: string, content: string): Promise<void> {
  try {
    await invoke("fs_write_text", { relPath, content, userScope: getUserScope() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_write_text failed: ${msg}`);
  }
}

export async function readBytesBase64Fs(relPath: string): Promise<string> {
  try {
    return await invoke("fs_read_bytes_base64", { relPath, userScope: getUserScope() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_read_bytes_base64 failed: ${msg}`);
  }
}

export async function writeBytesBase64Fs(relPath: string, contentBase64: string): Promise<void> {
  try {
    await invoke("fs_write_bytes_base64", { relPath, contentBase64, userScope: getUserScope() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_write_bytes_base64 failed: ${msg}`);
  }
}

export async function moveFs(srcRelPath: string, dstRelPath: string): Promise<void> {
  try {
    await invoke("fs_move", { srcRelPath, dstRelPath, userScope: getUserScope() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_move failed: ${msg}`);
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const res = reader.result;
      if (typeof res !== "string") return reject(new Error("Unexpected FileReader result"));
      // reader.readAsDataURL => "data:...;base64,<base64>"
      const comma = res.indexOf(",");
      resolve(res.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

