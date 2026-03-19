import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_GAME_CONFIG,
  getGameConfigPath,
  loadGameConfig,
  saveGameConfig,
  type GameConfigFile
} from "../lib/gameConfig";
import { EARLY_BOOT_DISPLAY_MS } from "../lib/bootConsoleSequence";

type GameConfigContextValue = {
  ready: boolean;
  config: GameConfigFile;
  configPath: string | null;
  reload: () => Promise<void>;
  setConfig: (next: GameConfigFile) => Promise<void>;
  patchConfig: (partial: Partial<GameConfigFile>) => Promise<void>;
};

const GameConfigContext = createContext<GameConfigContextValue | null>(null);

export function GameConfigProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [config, setConfigState] = useState<GameConfigFile>(DEFAULT_GAME_CONFIG);
  const [configPath, setConfigPath] = useState<string | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const reload = useCallback(async () => {
    const [loaded, path] = await Promise.all([loadGameConfig(), getGameConfigPath()]);
    setConfigState(loaded);
    setConfigPath(path);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const t0 = performance.now();
      await reload();
      const elapsed = performance.now() - t0;
      const pad = Math.max(120, EARLY_BOOT_DISPLAY_MS - elapsed);
      await new Promise((r) => setTimeout(r, pad));
      if (!cancelled) setReady(true);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const setConfig = useCallback(async (next: GameConfigFile) => {
    await saveGameConfig(next);
    setConfigState(next);
  }, []);

  const patchConfig = useCallback(async (partial: Partial<GameConfigFile>) => {
    const next = { ...configRef.current, ...partial };
    await saveGameConfig(next);
    setConfigState(next);
  }, []);

  const value = useMemo<GameConfigContextValue>(
    () => ({
      ready,
      config,
      configPath,
      reload,
      setConfig,
      patchConfig
    }),
    [config, configPath, patchConfig, ready, reload, setConfig]
  );

  return <GameConfigContext.Provider value={value}>{children}</GameConfigContext.Provider>;
}

export function useGameConfig() {
  const ctx = useContext(GameConfigContext);
  if (!ctx) {
    throw new Error("useGameConfig must be used inside GameConfigProvider");
  }
  return ctx;
}
