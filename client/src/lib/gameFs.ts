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

export async function initGameFs(): Promise<void> {
  try {
    await invoke("fs_init");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_init failed: ${msg}`);
  }
}

export async function getGameFilesRootPath(): Promise<string> {
  try {
    return await invoke("fs_root_path");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_root_path failed: ${msg}`);
  }
}

export async function listFs(relPath: string): Promise<FsEntry[]> {
  try {
    const items = await invoke<Array<unknown>>("fs_list", { relPath });
  // Tauri serde -> camelCase for FsEntry
    return items as FsEntry[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_list failed: ${msg}`);
  }
}

export async function getFsDiskUsage(): Promise<FsDiskUsage> {
  try {
    return await invoke<FsDiskUsage>("fs_disk_usage");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_disk_usage failed: ${msg}`);
  }
}

export async function mkdirFs(relPath: string): Promise<void> {
  try {
    await invoke("fs_mkdir", { relPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_mkdir failed: ${msg}`);
  }
}

export async function deleteFs(relPath: string): Promise<void> {
  try {
    await invoke("fs_delete", { relPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_delete failed: ${msg}`);
  }
}

export async function readTextFs(relPath: string): Promise<string> {
  try {
    return await invoke("fs_read_text", { relPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_read_text failed: ${msg}`);
  }
}

export async function writeTextFs(relPath: string, content: string): Promise<void> {
  try {
    await invoke("fs_write_text", { relPath, content });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_write_text failed: ${msg}`);
  }
}

export async function readBytesBase64Fs(relPath: string): Promise<string> {
  try {
    return await invoke("fs_read_bytes_base64", { relPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_read_bytes_base64 failed: ${msg}`);
  }
}

export async function writeBytesBase64Fs(relPath: string, contentBase64: string): Promise<void> {
  try {
    await invoke("fs_write_bytes_base64", { relPath, contentBase64 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fs_write_bytes_base64 failed: ${msg}`);
  }
}

export async function moveFs(srcRelPath: string, dstRelPath: string): Promise<void> {
  try {
    await invoke("fs_move", { srcRelPath, dstRelPath });
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

