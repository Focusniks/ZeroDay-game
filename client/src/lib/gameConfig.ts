import { invoke } from "@tauri-apps/api/core";

export type GameConfigFile = {
  version: number;
  setupComplete: boolean;
  wsUrl?: string;
  lastLoginEmailHint?: string;
};

const LS_KEY = "zeroday.game.config.v1";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const DEFAULT_GAME_CONFIG: GameConfigFile = {
  version: 1,
  setupComplete: false,
  wsUrl: undefined,
  lastLoginEmailHint: undefined
};

export async function loadGameConfig(): Promise<GameConfigFile> {
  if (!isTauriRuntime()) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { ...DEFAULT_GAME_CONFIG };
      return { ...DEFAULT_GAME_CONFIG, ...JSON.parse(raw) } as GameConfigFile;
    } catch {
      return { ...DEFAULT_GAME_CONFIG };
    }
  }

  try {
    return await invoke<GameConfigFile>("get_game_config");
  } catch {
    return { ...DEFAULT_GAME_CONFIG };
  }
}

export async function saveGameConfig(config: GameConfigFile): Promise<void> {
  if (!isTauriRuntime()) {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
    return;
  }
  await invoke("save_game_config", { config });
}

export async function getGameConfigPath(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await invoke<string>("get_game_config_path");
  } catch {
    return null;
  }
}
