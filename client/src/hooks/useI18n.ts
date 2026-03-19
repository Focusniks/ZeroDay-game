import { useMemo } from "react";
import { getGameStrings } from "../lib/i18n/gameStrings";
import { normalizeGameLanguage, type GameLanguage } from "../lib/gameConfig";
import { useGameConfig } from "./useGameConfig";

export function useI18n() {
  const { config } = useGameConfig();
  const lang: GameLanguage = useMemo(
    () => normalizeGameLanguage(config.gameLanguage),
    [config.gameLanguage]
  );
  const t = useMemo(() => getGameStrings(lang), [lang]);
  return { lang, t };
}
