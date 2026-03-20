import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../hooks/useAuth";
import { useDesktopIconLayout, DESKTOP_COMPUTER_CELL_KEY, DESKTOP_TRASH_CELL_KEY } from "../hooks/useDesktopIconLayout";
import { useI18n } from "../hooks/useI18n";
import { useGameConfig } from "../hooks/useGameConfig";
import { TerminalApp } from "../components/terminal/TerminalApp";
import { useNavigate } from "react-router-dom";
import { SettingsApp } from "../components/settings/SettingsApp";
import { ConfirmDialog } from "../components/dialog/ConfirmDialog";
import { TextPromptDialog } from "../components/dialog/TextPromptDialog";
import {
  deleteFs,
  initGameFs,
  listFs,
  mkdirFs,
  moveFs,
  readBytesBase64Fs,
  writeTextFs,
  type FsEntry
} from "../lib/gameFs";
import {
  CUSTOM_WALLPAPER_PREFIX,
  DEFAULT_WALLPAPER,
  getWallpaperBackground,
  mimeFromRelPath,
  parseCustomWallpaperRelPath,
  type WallpaperId
} from "../lib/wallpapers";
import { FilesApp } from "../components/files/FilesApp";
import { NotesApp } from "../components/notes/NotesApp";
import { CodeEditorApp } from "../components/code/CodeEditorApp";
import { MediaApp } from "../components/media/MediaApp";
import { ZeroBrowser } from "../components/browser/ZeroBrowser";
import { NetworkPopover } from "../components/network/NetworkPopover";
import {
  findUtcMsForZonedDate,
  formatZonedDateShort,
  formatZonedTime,
  formatZonedTimeWithSeconds,
  getZonedWeekdayMon0,
  getZonedYmd,
  resolveGameTimeZone
} from "../lib/zonedClock";
import type { GameLanguage } from "../lib/gameConfig";
import { getGameStrings } from "../lib/i18n/gameStrings";
import { playDesktopLogin, playDesktopLogout, playTrashEmpty } from "../lib/osSounds";
import { breezePlaceUrl, themeIconUrl } from "../lib/themeIcons";

/** Содержимое этой папки в игровой ФС отображается как иконки на рабочем столе (создаётся в fs_init). */
const GAME_DESKTOP_FOLDER_REL = "Desktop";

async function uniqueChildNameInParent(parentRel: string, baseName: string): Promise<string> {
  const items = await listFs(parentRel);
  const taken = new Set(items.map((i) => i.name.toLowerCase()));
  if (!taken.has(baseName.toLowerCase())) return baseName;
  const lastDot = baseName.lastIndexOf(".");
  const stem = lastDot > 0 ? baseName.slice(0, lastDot) : baseName;
  const ext = lastDot > 0 ? baseName.slice(lastDot) : "";
  let n = 2;
  while (taken.has(`${stem} (${n})${ext}`.toLowerCase())) n += 1;
  return `${stem} (${n})${ext}`;
}

export type StartGroup =
  | "games"
  | "graphics"
  | "internet"
  | "office"
  | "sundry"
  | "programming"
  | "science"
  | "sound_video"
  | "other"
  | "wallpapers"
  | "system";

type SettingsTabArg = "system" | "desktop" | "network" | "profile";

type StartMenuHandlerApi = {
  openTerminal: () => void;
  openSettings: (tab?: SettingsTabArg) => void;
  openFiles: (path: string) => void;
  openNotes: () => void;
  openScripts: () => void;
  openMedia: () => void;
  openBrowser: () => void;
};

export type StartMenuCatalogRow = {
  key: string;
  icon: ReactNode;
  label: string;
  /** Lowercase string: both RU/EN labels + keywords for search */
  matchText: string;
  action: () => void;
};

function PowerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v10" />
      <path d="M7.5 4.5 6 6a8 8 0 1 0 12 0l-1.5-1.5" />
    </svg>
  );
}

function DoorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7" />
      <path d="M11 12h0" />
      <path d="M7 3v18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function TaskbarThemeIcon({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} className={className ?? "taskbar-theme-icon"} draggable={false} />;
}

const smIco = "taskbar-theme-icon start-menu-theme-icon";

function lowerBlob(parts: Array<string | undefined | null>) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Single source for category pane + global search (all programs). */
function buildStartMenuCatalog(lang: GameLanguage, h: StartMenuHandlerApi): {
  groupLabel: Record<StartGroup, string>;
  rowsByGroup: Record<StartGroup, StartMenuCatalogRow[]>;
  allSearchRows: StartMenuCatalogRow[];
} {
  const tRu = getGameStrings("ru");
  const tEn = getGameStrings("en");
  const L = (ru: string, en: string) => (lang === "ru" ? ru : en);

  const row = (
    key: string,
    icon: ReactNode,
    ru: string,
    en: string,
    action: () => void,
    ...keywords: string[]
  ): StartMenuCatalogRow => ({
    key,
    icon,
    label: L(ru, en),
    matchText: lowerBlob([ru, en, ...keywords]),
    action
  });

  const groupLabel: Record<StartGroup, string> = {
    games: L("Игры", "Games"),
    graphics: L("Графика", "Graphics"),
    internet: L("Интернет", "Internet"),
    office: L("Офис", "Office"),
    sundry: L("Разное", "Sundry"),
    programming: L("Программирование", "Programming"),
    science: L("Наука", "Science"),
    sound_video: L("Звук и видео", "Sound & Video"),
    other: L("Другое", "Other"),
    wallpapers: L("Обои", "Wallpapers"),
    system: L("Система", "System")
  };

  const rowsByGroup: Record<StartGroup, StartMenuCatalogRow[]> = {
    games: [
      row(
        "games-hack-arena",
        <TaskbarThemeIcon src={themeIconUrl("scripts.svg")} alt="" className={smIco} />,
        "HackScript Arena",
        "HackScript Arena",
        () => h.openScripts(),
        "hack",
        "hackscript",
        "скрипт",
        "script",
        "ctf",
        "code",
        "код"
      ),
    ],
    graphics: [
      row(
        "graphics-image",
        <TaskbarThemeIcon src={themeIconUrl("media.svg")} alt="" className={smIco} />,
        "Просмотр изображений",
        "Image viewer",
        () => h.openMedia(),
        "фото",
        "photo",
        "image",
        "картинк",
        "picture",
        "png",
        "jpg",
        "медиа",
        "media"
      ),
      row(
        "graphics-video",
        <TaskbarThemeIcon src={themeIconUrl("media.svg")} alt="" className={smIco} />,
        "Видео-плеер",
        "Video player",
        () => h.openMedia(),
        "видео",
        "video",
        "плеер",
        "player",
        "movie"
      )
    ],
    internet: [
      row(
        "internet-browser",
        <TaskbarThemeIcon src={themeIconUrl("browser.svg")} alt="" className={smIco} />,
        "Zero Browser",
        "Zero Browser",
        () => h.openBrowser(),
        "browser",
        "web",
        "интернет",
        "internet",
        "сеть",
        "network"
      ),
      row(
        "internet-net-settings",
        <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" className={smIco} />,
        "Параметры сети",
        "Network settings",
        () => h.openSettings("network"),
        "настройки",
        "settings",
        "параметры",
        "сеть",
        "network",
        "vpn",
        "прокси",
        "proxy",
        "websocket",
        tRu.dockSettings,
        tEn.dockSettings
      )
    ],
    office: [
      row(
        "office-notes",
        <TaskbarThemeIcon src={themeIconUrl("notes.svg")} alt="" className={smIco} />,
        "Заметки",
        "Notes",
        () => h.openNotes(),
        "note",
        "markdown",
        "md",
        "текст",
        "text",
        "заметк"
      ),
      row(
        "office-fm",
        <TaskbarThemeIcon src={themeIconUrl("files.svg")} alt="" className={smIco} />,
        "Файловый менеджер",
        "File manager",
        () => h.openFiles(""),
        "файл",
        "file",
        "проводник",
        "explorer",
        "каталог",
        "folder",
        tRu.dockFiles,
        tEn.dockFiles
      )
    ],
    sundry: [
      row(
        "sundry-terminal",
        <TaskbarThemeIcon src={themeIconUrl("terminal.svg")} alt="" className={smIco} />,
        tRu.dockTerminal,
        tEn.dockTerminal,
        () => h.openTerminal(),
        "терминал",
        "terminal",
        "консоль",
        "console",
        "bash",
        "shell"
      ),
      row(
        "sundry-settings",
        <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" className={smIco} />,
        tRu.dockSettings,
        tEn.dockSettings,
        () => h.openSettings(),
        "настройки",
        "settings",
        "параметры",
        "preferences",
        "options"
      ),
      row(
        "sundry-files",
        <TaskbarThemeIcon src={themeIconUrl("files.svg")} alt="" className={smIco} />,
        tRu.dockFiles,
        tEn.dockFiles,
        () => h.openFiles(""),
        "файл",
        "files",
        "проводник"
      ),
      row(
        "sundry-computer",
        <TaskbarThemeIcon src={breezePlaceUrl("computer")} alt="" className={smIco} />,
        "Компьютер",
        "Computer",
        () => h.openFiles(""),
        "pc",
        "this",
        "мой компьютер",
        "home",
        "корень",
        "root"
      ),
      row(
        "sundry-trash",
        <TaskbarThemeIcon src={breezePlaceUrl("user-trash")} alt="" className={smIco} />,
        "Корзина",
        "Trash",
        () => h.openFiles("Trash"),
        "удален",
        "delete",
        "recycle",
        "bin",
        "мусор"
      ),
      row(
        "sundry-notes",
        <TaskbarThemeIcon src={themeIconUrl("notes.svg")} alt="" className={smIco} />,
        "Заметки",
        "Notes",
        () => h.openNotes(),
        "note",
        "markdown",
        "заметк"
      ),
      row(
        "sundry-scripts",
        <TaskbarThemeIcon src={themeIconUrl("scripts.svg")} alt="" className={smIco} />,
        "Скрипты",
        "Scripts",
        () => h.openScripts(),
        "hack",
        "hackscript",
        "код",
        "code",
        "редактор",
        "editor"
      ),
      row(
        "sundry-media",
        <TaskbarThemeIcon src={themeIconUrl("media.svg")} alt="" className={smIco} />,
        "Фото и видео",
        "Media",
        () => h.openMedia(),
        "медиа",
        "media",
        "музыка",
        "music",
        "видео",
        "video",
        "плеер"
      )
    ],
    programming: [
      row(
        "prog-editor",
        <TaskbarThemeIcon src={themeIconUrl("scripts.svg")} alt="" className={smIco} />,
        "HackScript / редактор",
        "HackScript editor",
        () => h.openScripts(),
        "hack",
        "hackscript",
        "ide",
        "код",
        "code",
        "программ",
        "develop"
      ),
      row(
        "prog-terminal",
        <TaskbarThemeIcon src={themeIconUrl("terminal.svg")} alt="" className={smIco} />,
        "Терминал",
        "Terminal",
        () => h.openTerminal(),
        "терминал",
        "terminal",
        "cli",
        tRu.dockTerminal,
        tEn.dockTerminal
      )
    ],
    science: [
      row(
        "science-lab-notes",
        <TaskbarThemeIcon src={themeIconUrl("notes.svg")} alt="" className={smIco} />,
        "Лабораторный журнал",
        "Lab notes",
        () => h.openNotes(),
        "лаб",
        "lab",
        "наука",
        "science",
        "журнал",
        "journal"
      ),
      row(
        "science-script-lab",
        <TaskbarThemeIcon src={themeIconUrl("scripts.svg")} alt="" className={smIco} />,
        "Скриптовая лаборатория",
        "Script lab",
        () => h.openScripts(),
        "скрипт",
        "script",
        "lab",
        "эксперимент"
      )
    ],
    sound_video: [
      row(
        "sv-music",
        <TaskbarThemeIcon src={themeIconUrl("media.svg")} alt="" className={smIco} />,
        "Музыка",
        "Music",
        () => h.openMedia(),
        "audio",
        "sound",
        "звук",
        "аудио",
        "mp3"
      ),
      row(
        "sv-video",
        <TaskbarThemeIcon src={themeIconUrl("media.svg")} alt="" className={smIco} />,
        "Видео",
        "Video",
        () => h.openMedia(),
        "movie",
        "плеер",
        "player",
        "клип"
      )
    ],
    other: [
      row(
        "other-browse",
        <TaskbarThemeIcon src={themeIconUrl("files.svg")} alt="" className={smIco} />,
        "Обзор файлов",
        "Browse files",
        () => h.openFiles(""),
        "файл",
        "browse",
        "открыть",
        "open",
        tRu.dockFiles,
        tEn.dockFiles
      ),
      row(
        "other-all-settings",
        <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" className={smIco} />,
        "Все параметры",
        "All settings",
        () => h.openSettings(),
        "настройки",
        "settings",
        "все",
        "all",
        "control",
        "панель",
        tRu.dockSettings,
        tEn.dockSettings
      )
    ],
    wallpapers: [
      row(
        "wp-desktop",
        <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" className={smIco} />,
        "Параметры рабочего стола",
        "Desktop settings",
        () => h.openSettings("desktop"),
        "обои",
        "wallpaper",
        "фон",
        "background",
        "тема",
        "theme",
        "рабочий стол",
        "desktop"
      ),
      row(
        "wp-folder",
        <TaskbarThemeIcon src={breezePlaceUrl("folder")} alt="" className={smIco} />,
        "Папка «Обои»",
        "Wallpapers folder",
        () => h.openFiles("Wallpapers"),
        "обои",
        "wallpapers",
        "картинк",
        "images",
        "фон"
      )
    ],
    system: [
      row(
        "sys-settings",
        <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" className={smIco} />,
        "Системные параметры",
        "System settings",
        () => h.openSettings("system"),
        "система",
        "system",
        "настройки",
        "settings",
        "ядро",
        "kernel",
        tRu.dockSettings,
        tEn.dockSettings
      ),
      row(
        "sys-desktop",
        <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" className={smIco} />,
        "Рабочий стол",
        "Desktop",
        () => h.openSettings("desktop"),
        "desktop",
        "обои",
        "wallpaper",
        "персонализация"
      ),
      row(
        "sys-network",
        <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" className={smIco} />,
        "Сеть",
        "Network",
        () => h.openSettings("network"),
        "сеть",
        "network",
        "интернет",
        "internet",
        "wifi",
        "ws",
        "socket"
      ),
      row(
        "sys-computer",
        <TaskbarThemeIcon src={themeIconUrl("files.svg")} alt="" className={smIco} />,
        "Компьютер",
        "Computer",
        () => h.openFiles(""),
        "компьютер",
        "computer",
        "диск",
        "drive",
        tRu.dockFiles,
        tEn.dockFiles
      )
    ]
  };

  const allSearchRows = (Object.keys(rowsByGroup) as StartGroup[]).flatMap((g) => rowsByGroup[g]);

  return { groupLabel, rowsByGroup, allSearchRows };
}

function WifiIcon({ ok }: { ok: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 8.5a16 16 0 0 1 20 0" />
      <path d="M5.5 12a11 11 0 0 1 13 0" />
      <path d="M9 15.5a6 6 0 0 1 6 0" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
      {!ok ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

export function DashboardPage() {
  const { user, logout, wsState, wsUrl } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { config, patchConfig } = useGameConfig();

  const [toasts, setToasts] = useState<Array<{ id: string; message: string }>>([]);
  const addToast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalMinimized, setTerminalMinimized] = useState(false);

  const [startOpen, setStartOpen] = useState(false);
  const startRef = useRef<HTMLDivElement | null>(null);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    playDesktopLogin();
  }, []);

  const gameTimeZone = useMemo(() => resolveGameTimeZone(config.timezone), [config.timezone]);
  const clockText = useMemo(
    () => formatZonedTime(now.getTime(), gameTimeZone, lang),
    [now, gameTimeZone, lang]
  );
  const clockDateText = useMemo(
    () => formatZonedDateShort(now.getTime(), gameTimeZone, lang),
    [now, gameTimeZone, lang]
  );
  const clockPopoverTimeText = useMemo(
    () => formatZonedTimeWithSeconds(now.getTime(), gameTimeZone, lang),
    [now, gameTimeZone, lang]
  );

  const [clockMenuOpen, setClockMenuOpen] = useState(false);
  const clockMenuRef = useRef<HTMLDivElement | null>(null);
  const clockBtnRef = useRef<HTMLButtonElement | null>(null);
  const [clockMenuPos, setClockMenuPos] = useState<{ right: number; bottom: number }>({ right: 8, bottom: 52 });
  const [calendarView, setCalendarView] = useState(() => {
    const z = getZonedYmd(Date.now(), resolveGameTimeZone(undefined));
    return { year: z.y, month: z.m0 }; // month: 0..11 in game timezone
  });

  useEffect(() => {
    const z = getZonedYmd(Date.now(), gameTimeZone);
    setCalendarView({ year: z.y, month: z.m0 });
  }, [gameTimeZone]);
  const [calendarSelectedIso, setCalendarSelectedIso] = useState<string | null>(null);

  const customWallpaperRel = parseCustomWallpaperRelPath(config.wallpaper ?? null);
  const builtinWallpaperId = (customWallpaperRel ? DEFAULT_WALLPAPER : ((config.wallpaper ?? DEFAULT_WALLPAPER) as WallpaperId));
  const builtinWallpaperBackground = getWallpaperBackground(builtinWallpaperId);
  const [customWallpaperDataUrl, setCustomWallpaperDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!customWallpaperRel) {
        setCustomWallpaperDataUrl(null);
        return;
      }
      await initGameFs();
      const b64 = await readBytesBase64Fs(customWallpaperRel);
      if (cancelled) return;
      const mime = mimeFromRelPath(customWallpaperRel);
      setCustomWallpaperDataUrl(`data:${mime};base64,${b64}`);
    };
    void run().catch(() => {
      if (!cancelled) setCustomWallpaperDataUrl(null);
    });
    return () => {
      cancelled = true;
    };
  }, [customWallpaperRel]);

  const desktopBackground = customWallpaperDataUrl
    ? `url(${customWallpaperDataUrl}) center/cover no-repeat, ${builtinWallpaperBackground}`
    : builtinWallpaperBackground;

  // Network state
  const [isNetworkConnected, setIsNetworkConnected] = useState(false);
  const [isNetworkConnecting, setIsNetworkConnecting] = useState(false);
  const [networkBandwidth, setNetworkBandwidth] = useState(0);
  const [networkPopoverOpen, setNetworkPopoverOpen] = useState(false);
  const networkPopoverRef = useRef<HTMLDivElement | null>(null);

  // Симуляция изменения пропускной способности
  useEffect(() => {
    if (!isNetworkConnected) {
      setNetworkBandwidth(0);
      return;
    }

    const interval = window.setInterval(() => {
      setNetworkBandwidth(prev => {
        const baseBandwidth = 100;
        const variance = Math.random() * 20 - 10;
        return Math.max(10, Math.round(baseBandwidth + variance));
      });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [isNetworkConnected]);

  const toggleNetworkConnection = () => {
    if (isNetworkConnected) {
      setIsNetworkConnected(false);
    } else {
      setIsNetworkConnecting(true);
      setTimeout(() => {
        setIsNetworkConnecting(false);
        setIsNetworkConnected(true);
      }, 1500);
    }
  };

  const netIsConnected = wsState === "open";
  const netIsConnecting = wsState === "connecting";
  const netStatusText =
    netIsConnected ? (lang === "ru" ? "Сеть подключена" : "Network connected") : netIsConnecting
      ? (lang === "ru" ? "Подключение..." : "Connecting...")
      : lang === "ru"
        ? "Нет соединения"
        : "No connection";

  // Keyboard layout indicator - отслеживание реальной раскладки клавиатуры ПК
  const [keyboardLayout, setKeyboardLayout] = useState<"RU" | "EN">("EN");
  const lastLayoutRef = useRef<"RU" | "EN">("EN");
  const isModifierPressed = useRef(false);
  const lastToggleTimeRef = useRef(0);

  useEffect(() => {
    // Определяем раскладку по последнему введенному символу
    const detectLayout = (event: KeyboardEvent) => {
      const key = event.key;
      
      // Обработка Alt+Shift или Shift+Alt для переключения раскладки
      if ((event.altKey && event.key === "Shift") || (event.shiftKey && event.key === "Alt")) {
        if (!isModifierPressed.current) {
          isModifierPressed.current = true;
          const newLayout = lastLayoutRef.current === "RU" ? "EN" : "RU";
          lastLayoutRef.current = newLayout;
          setKeyboardLayout(newLayout);
          lastToggleTimeRef.current = Date.now();
        }
        event.preventDefault();
        return;
      }

      // Не обновляем по символам сразу после переключения (даём 500мс на переход)
      if (Date.now() - lastToggleTimeRef.current < 500) {
        return;
      }

      if (!key || key.length !== 1) return;

      // Проверяем, является ли символ кириллицей
      const isCyrillic = /[\u0400-\u04FF]/.test(key);
      const newLayout = isCyrillic ? "RU" : "EN";

      // Обновляем только если раскладка изменилась
      if (newLayout !== lastLayoutRef.current) {
        lastLayoutRef.current = newLayout;
        setKeyboardLayout(newLayout);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt" || event.key === "Shift") {
        isModifierPressed.current = false;
      }
    };

    // Слушаем нажатия клавиш для определения раскладки
    window.addEventListener("keydown", detectLayout);
    window.addEventListener("keyup", handleKeyUp);

    // Начальная проверка по navigator.language
    const navLang = navigator.language || (navigator as any).userLanguage || "en-US";
    const initialLayout = navLang.toLowerCase().startsWith("ru") ? "RU" : "EN";
    lastLayoutRef.current = initialLayout;
    setKeyboardLayout(initialLayout);

    return () => {
      window.removeEventListener("keydown", detectLayout);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [desktopMenuPos, setDesktopMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  /** `null` = ПКМ по фону; иначе ключи для контекстного меню (`""` = Компьютер, `Trash`, либо `relPath`). */
  const [desktopMenuItemKeys, setDesktopMenuItemKeys] = useState<string[] | null>(null);

  const [terminalInjectKey, setTerminalInjectKey] = useState(0);
  const [terminalInjectLines, setTerminalInjectLines] = useState<string[]>([]);

  const injectTerminalLines = (lines: string[]) => {
    setTerminalInjectLines(lines);
    setTerminalInjectKey((k) => k + 1);
  };

  // Window stacking / focus management (full rewrite: shared mechanics for all app windows).
  type WindowId = "terminal" | "settings" | "files" | "notes" | "scripts" | "media" | "browser";
  type WindowBaseState = { id: string; minimized: boolean; z: number };
  const [activeWindowToken, setActiveWindowToken] = useState<string | null>(null);
  const zTopRef = useRef(90);
  const makeWindowId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const makeWindowToken = (windowType: WindowId, id: string) => `${windowType}:${id}`;
  const nextZ = () => {
    zTopRef.current += 1;
    return zTopRef.current;
  };
  const focusWindowInList = <T extends WindowBaseState>(
    setState: Dispatch<SetStateAction<T[]>>,
    windowType: WindowId,
    id: string
  ) => {
    const z = nextZ();
    setState((prev) => prev.map((w) => (w.id === id ? { ...w, z, minimized: false } : w)));
    setActiveWindowToken(makeWindowToken(windowType, id));
  };
  const [terminalZ, setTerminalZ] = useState(91);
  const focusTerminal = () => {
    setTerminalZ(nextZ());
    setActiveWindowToken(makeWindowToken("terminal", "main"));
  };

  type SettingsTab = "system" | "desktop" | "network" | "profile";
  type SettingsWindowState = WindowBaseState & { initialTab: SettingsTab };
  const [settingsWindows, setSettingsWindows] = useState<SettingsWindowState[]>([]);
  const openSettings = (initialTab: SettingsTab = "system") => {
    const z = nextZ();
    const id = makeWindowId();
    setSettingsWindows((prev) => [...prev, { id, initialTab, minimized: false, z }]);
    setActiveWindowToken(makeWindowToken("settings", id));
  };
  const closeSettingsWindow = (id: string) => {
    setSettingsWindows((prev) => prev.filter((w) => w.id !== id));
    if (activeWindowToken === makeWindowToken("settings", id)) setActiveWindowToken(null);
  };
  const minimizeSettingsWindow = (id: string) => {
    setSettingsWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
    if (activeWindowToken === makeWindowToken("settings", id)) setActiveWindowToken(null);
  };
  const focusSettingsWindow = (id: string) => focusWindowInList(setSettingsWindows, "settings", id);

  type FilesWindowState = WindowBaseState & { startRelPath: string };
  const [filesWindows, setFilesWindows] = useState<FilesWindowState[]>([]);
  const openFiles = (startRelPath = "") => {
    const z = nextZ();
    const id = makeWindowId();
    setFilesWindows((prev) => [...prev, { id, startRelPath, minimized: false, z }]);
    setActiveWindowToken(makeWindowToken("files", id));
  };
  const closeFilesWindow = (id: string) => {
    setFilesWindows((prev) => prev.filter((w) => w.id !== id));
    if (activeWindowToken === makeWindowToken("files", id)) setActiveWindowToken(null);
  };
  const minimizeFilesWindow = (id: string) => {
    setFilesWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
    if (activeWindowToken === makeWindowToken("files", id)) setActiveWindowToken(null);
  };
  const focusFilesWindow = (id: string) => focusWindowInList(setFilesWindows, "files", id);

  type NotesWindowState = WindowBaseState & { initialRelPath?: string };
  const [notesWindows, setNotesWindows] = useState<NotesWindowState[]>([]);
  const openNotes = (relPath?: string) => {
    const z = nextZ();
    const id = makeWindowId();
    setNotesWindows((prev) => [...prev, { id, initialRelPath: relPath, minimized: false, z }]);
    setActiveWindowToken(makeWindowToken("notes", id));
  };
  const closeNotesWindow = (id: string) => {
    setNotesWindows((prev) => prev.filter((w) => w.id !== id));
    if (activeWindowToken === makeWindowToken("notes", id)) setActiveWindowToken(null);
  };
  const minimizeNotesWindow = (id: string) => {
    setNotesWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
    if (activeWindowToken === makeWindowToken("notes", id)) setActiveWindowToken(null);
  };
  const focusNotesWindow = (id: string) => focusWindowInList(setNotesWindows, "notes", id);

  type ScriptsWindowState = WindowBaseState & { initialRelPath?: string };
  const [scriptsWindows, setScriptsWindows] = useState<ScriptsWindowState[]>([]);
  const openScripts = (relPath?: string) => {
    const z = nextZ();
    const id = makeWindowId();
    setScriptsWindows((prev) => [...prev, { id, initialRelPath: relPath, minimized: false, z }]);
    setActiveWindowToken(makeWindowToken("scripts", id));
  };
  const closeScriptsWindow = (id: string) => {
    setScriptsWindows((prev) => prev.filter((w) => w.id !== id));
    if (activeWindowToken === makeWindowToken("scripts", id)) setActiveWindowToken(null);
  };
  const minimizeScriptsWindow = (id: string) => {
    setScriptsWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
    if (activeWindowToken === makeWindowToken("scripts", id)) setActiveWindowToken(null);
  };
  const focusScriptsWindow = (id: string) => focusWindowInList(setScriptsWindows, "scripts", id);

  type MediaWindowState = WindowBaseState & { initialRelPath?: string };
  const [mediaWindows, setMediaWindows] = useState<MediaWindowState[]>([]);
  const openMedia = (relPath?: string) => {
    const z = nextZ();
    const id = makeWindowId();
    setMediaWindows((prev) => [...prev, { id, initialRelPath: relPath, minimized: false, z }]);
    setActiveWindowToken(makeWindowToken("media", id));
  };
  const closeMediaWindow = (id: string) => {
    setMediaWindows((prev) => prev.filter((w) => w.id !== id));
    if (activeWindowToken === makeWindowToken("media", id)) setActiveWindowToken(null);
  };
  const minimizeMediaWindow = (id: string) => {
    setMediaWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
    if (activeWindowToken === makeWindowToken("media", id)) setActiveWindowToken(null);
  };
  const focusMediaWindow = (id: string) => focusWindowInList(setMediaWindows, "media", id);

  type BrowserWindowState = WindowBaseState;
  const [browserWindows, setBrowserWindows] = useState<BrowserWindowState[]>([]);
  const openBrowser = () => {
    const z = nextZ();
    const id = makeWindowId();
    setBrowserWindows((prev) => [...prev, { id, minimized: false, z }]);
    setActiveWindowToken(makeWindowToken("browser", id));
  };
  const closeBrowserWindow = (id: string) => {
    setBrowserWindows((prev) => prev.filter((w) => w.id !== id));
    if (activeWindowToken === makeWindowToken("browser", id)) setActiveWindowToken(null);
  };
  const minimizeBrowserWindow = (id: string) => {
    setBrowserWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
    if (activeWindowToken === makeWindowToken("browser", id)) setActiveWindowToken(null);
  };
  const focusBrowserWindow = (id: string) => focusWindowInList(setBrowserWindows, "browser", id);

  /** Элементы папки `Desktop/` в ФС — иконки на рабочем столе (плюс «Компьютер» и «Корзина»). */
  const [desktopItems, setDesktopItems] = useState<FsEntry[]>([]);
  /** После первого `reloadDesktopDirs` хук раскладки синхронизирует ячейки. */
  const [desktopListReady, setDesktopListReady] = useState(false);

  // If user creates an item via RMB on the desktop, we try to place the newly created
  // icon near the cursor cell (Linux-like behavior).
  const [desktopCreateDesiredCell, setDesktopCreateDesiredCell] = useState<{
    col: number;
    row: number;
  } | null>(null);

  const {
    desktopIconCells,
    setDesktopIconCells,
    desktopIconCellsRef,
    DESK_LEFT,
    DESK_TOP,
    CELL_W,
    CELL_H,
    getDefaultSpecialCells,
    getSpecialCellsCurrent,
    cellKey,
    findNearestFreeCell
  } = useDesktopIconLayout({
    authUserId: user?.id,
    desktopItems,
    desktopListReady,
    desktopCreateDesiredCell,
    setDesktopCreateDesiredCell,
    addToast,
    lang
  });

  const [desktopSelectedRelPaths, setDesktopSelectedRelPaths] = useState<Set<string>>(() => new Set());
  const desktopSelectedRelPathsRef = useRef(desktopSelectedRelPaths);
  useEffect(() => {
    desktopSelectedRelPathsRef.current = desktopSelectedRelPaths;
  }, [desktopSelectedRelPaths]);

  const [desktopSelectionRect, setDesktopSelectionRect] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const desktopSelectionRectRef = useRef(desktopSelectionRect);
  useEffect(() => {
    desktopSelectionRectRef.current = desktopSelectionRect;
  }, [desktopSelectionRect]);

  const desktopItemsRef = useRef(desktopItems);
  useEffect(() => {
    desktopItemsRef.current = desktopItems;
  }, [desktopItems]);

  const [draggingRelPath, setDraggingRelPath] = useState<string | null>(null);
  const [dragPreviewPos, setDragPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const [desktopDropActive, setDesktopDropActive] = useState(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  /** Якорь для Shift+клик (как в проводнике). */
  const desktopSelectionAnchorRef = useRef<string | null>(null);
  /** Файлы/папки на столе, участвующие в текущем перетаскивании (не Компьютер/Корзина). */
  const desktopDragGroupRef = useRef<string[]>([]);
  /** Смещения верхнего левого угла каждой иконки относительно «ведущей» при групповом drag. */
  const dragGroupPixelOffsetsRef = useRef<Map<string, { dx: number; dy: number }>>(new Map());

  const [desktopInfo, setDesktopInfo] = useState<{
    pos: { x: number; y: number };
    title: string;
    lines: string[];
  } | null>(null);
  const desktopInfoRef = useRef<HTMLDivElement | null>(null);

  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirmAsync = (message: string) =>
    new Promise<boolean>((resolve) => {
      setConfirmState({
        title: lang === "ru" ? "Подтверждение" : "Confirm",
        message,
        resolve
      });
    });

  const [promptState, setPromptState] = useState<{
    title: string;
    defaultValue: string;
    resolve: (value: string | null) => void;
  } | null>(null);

  const promptAsync = (title: string, defaultValue = "") =>
    new Promise<string | null>((resolve) => {
      setPromptState({
        title,
        defaultValue,
        resolve
      });
    });

  const getDesktopKeysInVisualOrder = () => {
    const cells = desktopIconCellsRef.current;
    const defaults = getDefaultSpecialCells();
    const pairs: { k: string; row: number; col: number }[] = [];
    const comp = cells[DESKTOP_COMPUTER_CELL_KEY] ?? defaults.computer;
    const trash = cells[DESKTOP_TRASH_CELL_KEY] ?? defaults.trash;
    pairs.push({ k: "", row: comp.row, col: comp.col });
    pairs.push({ k: "Trash", row: trash.row, col: trash.col });
    for (const f of desktopItemsRef.current) {
      const ce = cells[f.relPath];
      if (ce) pairs.push({ k: f.relPath, row: ce.row, col: ce.col });
    }
    pairs.sort((a, b) => a.row - b.row || a.col - b.col || a.k.localeCompare(b.k));
    return pairs.map((p) => p.k);
  };

  useEffect(() => {
    if (!draggingRelPath) return;

    const onMove = (e: PointerEvent) => {
      setDragPreviewPos({
        x: e.clientX - dragOffsetRef.current.dx,
        y: e.clientY - dragOffsetRef.current.dy
      });
    };

    const onUp = (e: PointerEvent) => {
      const primary = draggingRelPath;
      const snapX = e.clientX - dragOffsetRef.current.dx;
      const snapY = e.clientY - dragOffsetRef.current.dy;

      const prev = desktopIconCellsRef.current;
      const fileGroup = desktopDragGroupRef.current.filter((k) =>
        desktopItemsRef.current.some((it) => it.relPath === k)
      );

      const finishSingleSpecial = (rel: string) => {
        const occupied = new Map<string, string>();
        const special = getSpecialCellsCurrent(prev);
        occupied.set(cellKey(special.computer.col, special.computer.row), DESKTOP_COMPUTER_CELL_KEY);
        occupied.set(cellKey(special.trash.col, special.trash.row), DESKTOP_TRASH_CELL_KEY);
        for (const [r, cell] of Object.entries(prev)) {
          occupied.set(cellKey(cell.col, cell.row), r);
        }
        const desiredCol = Math.round((snapX - DESK_LEFT) / CELL_W);
        const desiredRow = Math.round((snapY - DESK_TOP) / CELL_H);
        const best = findNearestFreeCell(desiredCol, desiredRow, rel, occupied);
        if (!best) {
          addToast(lang === "ru" ? "Нет места на рабочем столе" : "No space on the desktop");
          return;
        }
        setDesktopIconCells((p) => ({ ...p, [rel]: best }));
      };

      if (
        primary === DESKTOP_COMPUTER_CELL_KEY ||
        primary === DESKTOP_TRASH_CELL_KEY
      ) {
        finishSingleSpecial(primary);
        setDraggingRelPath(null);
        setDragPreviewPos(null);
        dragGroupPixelOffsetsRef.current = new Map();
        desktopDragGroupRef.current = [];
        return;
      }

      if (!primary || fileGroup.length === 0) {
        setDraggingRelPath(null);
        setDragPreviewPos(null);
        dragGroupPixelOffsetsRef.current = new Map();
        desktopDragGroupRef.current = [];
        return;
      }

      if (fileGroup.length === 1) {
        const rel = primary;
        const occupied = new Map<string, string>();
        const special = getSpecialCellsCurrent(prev);
        occupied.set(cellKey(special.computer.col, special.computer.row), DESKTOP_COMPUTER_CELL_KEY);
        occupied.set(cellKey(special.trash.col, special.trash.row), DESKTOP_TRASH_CELL_KEY);
        for (const [r, cell] of Object.entries(prev)) {
          occupied.set(cellKey(cell.col, cell.row), r);
        }
        const desiredCol = Math.round((snapX - DESK_LEFT) / CELL_W);
        const desiredRow = Math.round((snapY - DESK_TOP) / CELL_H);
        const best = findNearestFreeCell(desiredCol, desiredRow, rel, occupied);
        if (!best) {
          addToast(lang === "ru" ? "Нет места на рабочем столе" : "No space on the desktop");
        } else {
          setDesktopIconCells((p) => ({ ...p, [rel]: best }));
        }
        setDraggingRelPath(null);
        setDragPreviewPos(null);
        dragGroupPixelOffsetsRef.current = new Map();
        desktopDragGroupRef.current = [];
        return;
      }

      const oldPrimary = prev[primary];
      if (!oldPrimary) {
        setDraggingRelPath(null);
        setDragPreviewPos(null);
        dragGroupPixelOffsetsRef.current = new Map();
        desktopDragGroupRef.current = [];
        return;
      }

      const occupied = new Map<string, string>();
      const special = getSpecialCellsCurrent(prev);
      occupied.set(cellKey(special.computer.col, special.computer.row), DESKTOP_COMPUTER_CELL_KEY);
      occupied.set(cellKey(special.trash.col, special.trash.row), DESKTOP_TRASH_CELL_KEY);
      for (const [r, cell] of Object.entries(prev)) {
        if (fileGroup.includes(r)) continue;
        occupied.set(cellKey(cell.col, cell.row), r);
      }

      const desiredCol = Math.round((snapX - DESK_LEFT) / CELL_W);
      const desiredRow = Math.round((snapY - DESK_TOP) / CELL_H);
      const bestPrimary = findNearestFreeCell(desiredCol, desiredRow, primary, occupied);
      if (!bestPrimary) {
        addToast(lang === "ru" ? "Нет места на рабочем столе" : "No space on the desktop");
        setDraggingRelPath(null);
        setDragPreviewPos(null);
        dragGroupPixelOffsetsRef.current = new Map();
        desktopDragGroupRef.current = [];
        return;
      }

      occupied.set(cellKey(bestPrimary.col, bestPrimary.row), primary);
      const dCol = bestPrimary.col - oldPrimary.col;
      const dRow = bestPrimary.row - oldPrimary.row;

      const next: typeof prev = { ...prev, [primary]: bestPrimary };

      for (const rel of fileGroup) {
        if (rel === primary) continue;
        const old = prev[rel];
        if (!old) continue;
        const wantCol = old.col + dCol;
        const wantRow = old.row + dRow;
        const best = findNearestFreeCell(wantCol, wantRow, rel, occupied);
        if (best) {
          next[rel] = best;
          occupied.set(cellKey(best.col, best.row), rel);
        }
      }

      setDesktopIconCells(next);
      setDraggingRelPath(null);
      setDragPreviewPos(null);
      dragGroupPixelOffsetsRef.current = new Map();
      desktopDragGroupRef.current = [];
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingRelPath, lang]);

  useEffect(() => {
    if (draggingRelPath) {
      document.body.classList.add("zd-dragging-cursor");
    } else {
      document.body.classList.remove("zd-dragging-cursor");
    }
    return () => {
      document.body.classList.remove("zd-dragging-cursor");
    };
  }, [draggingRelPath]);

  useEffect(() => {
    if (!desktopSelectionRect) return;

    const onMove = (e: PointerEvent) => {
      setDesktopSelectionRect((prev) => {
        if (!prev) return prev;
        return { ...prev, x2: e.clientX, y2: e.clientY };
      });
    };

    const onUp = () => {
      const rect = desktopSelectionRectRef.current;
      setDesktopSelectionRect(null);
      if (!rect) return;

      const xMin = Math.min(rect.x1, rect.x2);
      const xMax = Math.max(rect.x1, rect.x2);
      const yMin = Math.min(rect.y1, rect.y2);
      const yMax = Math.max(rect.y1, rect.y2);

      const w = xMax - xMin;
      const h = yMax - yMin;

      // If user just clicked (no drag), clear selection like most desktop WMs.
      if (w < 6 && h < 6) {
        setDesktopSelectedRelPaths(new Set());
        return;
      }

      const next = new Set<string>();

      const intersects = (rx: number, ry: number, rw: number, rh: number) => {
        return !(xMax < rx || xMin > rx + rw || yMax < ry || yMin > ry + rh);
      };

      // "Computer" and "Trash" icons.
      const special = getDefaultSpecialCells();
      const compCell = desktopIconCellsRef.current[DESKTOP_COMPUTER_CELL_KEY] ?? special.computer;
      const trashCell = desktopIconCellsRef.current[DESKTOP_TRASH_CELL_KEY] ?? special.trash;
      {
        const compX = DESK_LEFT + compCell.col * CELL_W;
        const compY = DESK_TOP + compCell.row * CELL_H;
        if (intersects(compX, compY, CELL_W, CELL_H)) next.add("");
      }
      {
        const trashX = DESK_LEFT + trashCell.col * CELL_W;
        const trashY = DESK_TOP + trashCell.row * CELL_H;
        if (intersects(trashX, trashY, CELL_W, CELL_H)) next.add("Trash");
      }

      for (const item of desktopItemsRef.current) {
        const cell = desktopIconCellsRef.current[item.relPath];
        if (!cell) continue;
        const ix = DESK_LEFT + cell.col * CELL_W;
        const iy = DESK_TOP + cell.row * CELL_H;
        if (intersects(ix, iy, CELL_W, CELL_H)) next.add(item.relPath);
      }

      setDesktopSelectedRelPaths(next);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [desktopSelectionRect]);

  const reloadDesktopDirs = async () => {
    try {
      await initGameFs();
      const items = await listFs(GAME_DESKTOP_FOLDER_REL);
      setDesktopItems(items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addToast(lang === "ru" ? `FS ошибка: ${msg}` : `FS error: ${msg}`);
      setDesktopItems([]);
    } finally {
      setDesktopListReady(true);
    }
  };

  useEffect(() => {
    void reloadDesktopDirs();
    // We don't want to block rendering on language changes;
    // directory names are mostly user-created and don't depend on `lang`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createDesktopFolder = async (parentRelPath: string | null = null) => {
    try {
      await initGameFs();
      const parent = parentRelPath === null ? GAME_DESKTOP_FOLDER_REL : parentRelPath;
      const siblings = await listFs(parent);
      const taken = new Set(siblings.map((i) => i.name.toLowerCase()));
      let n = 1;
      let base = lang === "ru" ? `Папка ${n}` : `Folder ${n}`;
      while (taken.has(base.toLowerCase())) {
        n += 1;
        base = lang === "ru" ? `Папка ${n}` : `Folder ${n}`;
      }
      const rel = parent === "" ? base : `${parent}/${base}`;
      await mkdirFs(rel);
      await reloadDesktopDirs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addToast(lang === "ru" ? `Не удалось создать папку: ${msg}` : `Failed to create folder: ${msg}`);
    }
  };

  const sanitizeBaseName = (nameRaw: string) =>
    nameRaw
      .trim()
      .replace(/[<>:"/\\|?*]+/g, "_")
      .replace(/\.+$/g, "")
      .trim();

  const createTextFileAt = async (parentRelPath: string | null, ext: "txt" | "md") => {
    try {
      const n = ext === "md" ? (lang === "ru" ? "Заметка" : "Note") : (lang === "ru" ? "Текст" : "Text");
      const name = await promptAsync(lang === "ru" ? `Имя файла (${n}).${ext}` : `File name (${n}).${ext}:`);
      if (name === null) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const base = sanitizeBaseName(name.endsWith(`.${ext}`) ? name.slice(0, -ext.length - 1) : name);
      if (!base) return;
      const parent = parentRelPath === null ? GAME_DESKTOP_FOLDER_REL : parentRelPath;
      const rel = parent === "" ? `${base}.${ext}` : `${parent}/${base}.${ext}`;
      const initial = ext === "md" ? "# Title\n\n" : "";
      await writeTextFs(rel, initial);
      addToast(lang === "ru" ? "Файл создан" : "File created");
      await reloadDesktopDirs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addToast(lang === "ru" ? `Ошибка создания файла: ${msg}` : `Failed to create file: ${msg}`);
    }
  };

  const createHackFileAt = async (parentRelPath: string | null) => {
    try {
      const name = await promptAsync(
        lang === "ru" ? "Имя HackScript файла (.hack):" : "HackScript file name (.hack):"
      );
      if (name === null) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const base = sanitizeBaseName(trimmed.endsWith(".hack") ? trimmed.slice(0, -5) : trimmed);
      if (!base) return;
      const parent = parentRelPath === null ? GAME_DESKTOP_FOLDER_REL : parentRelPath;
      const rel = parent === "" ? `${base}.hack` : `${parent}/${base}.hack`;
      const initial = `# HackScript example\nprint("Hello from HackScript")\n`;
      await writeTextFs(rel, initial);
      addToast(lang === "ru" ? "Скрипт создан" : "Script created");
      await reloadDesktopDirs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addToast(lang === "ru" ? `Ошибка создания скрипта: ${msg}` : `Failed to create script: ${msg}`);
    }
  };

  const moveEntryToTrash = async (relPath: string) => {
    await initGameFs();
    try {
      // If the item is already in Trash - delete permanently.
      if (relPath.startsWith("Trash/") || relPath === "Trash") {
        await deleteFs(relPath);
        return;
      }
      const base = relPath.split("/").filter(Boolean).pop() ?? relPath;
      const dst = `Trash/${base}__${Date.now()}`;
      await moveFs(relPath, dst);
      if (relPath === GAME_DESKTOP_FOLDER_REL || relPath.startsWith(`${GAME_DESKTOP_FOLDER_REL}/`)) {
        await reloadDesktopDirs();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addToast(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
    }
  };

  const moveEntryToDesktopRoot = async (srcRelPath: string) => {
    await moveMultipleEntriesToDesktopRoot([srcRelPath]);
  };

  const moveMultipleEntriesToDesktopRoot = async (srcRelPaths: string[]) => {
    const unique = [...new Set(srcRelPaths)].filter(
      p => p !== "" && p !== "Trash" && p !== GAME_DESKTOP_FOLDER_REL && !p.startsWith(`${GAME_DESKTOP_FOLDER_REL}/`)
    );
    if (!unique.length) {
      addToast(lang === "ru" ? "Уже на рабочем столе" : "Already on Desktop");
      return;
    }
    let moved = 0;
    let blocked = false;
    for (const srcRelPath of unique) {
      const baseName = srcRelPath.split("/").filter(Boolean).pop();
      if (!baseName) continue;
      if (srcRelPath === baseName) continue;
      if (
        ["Notes", "Scripts", "Photos", "Videos", "Wallpapers", "Trash", "Desktop", "Documents", "Music", "Downloads"].includes(
          srcRelPath
        )
      ) {
        blocked = true;
        continue;
      }
      try {
        await initGameFs();
        const uniqueName = await uniqueChildNameInParent(GAME_DESKTOP_FOLDER_REL, baseName);
        const dst = `${GAME_DESKTOP_FOLDER_REL}/${uniqueName}`;
        await moveFs(srcRelPath, dst);
        moved++;
      } catch (e) {
        // skip conflict, continue others
      }
    }
    if (moved > 0) {
      await reloadDesktopDirs();
      addToast(lang === "ru" ? `Перемещено: ${moved}` : `Moved: ${moved}`);
    }
    if (blocked) {
      addToast(lang === "ru" ? "Системные папки нельзя перемещать" : "System folders cannot be moved");
    }
    if (moved === 0 && !blocked) {
      addToast(lang === "ru" ? "Ошибка перемещения" : "Move failed");
    }
  };

  const clearTrash = async () => {
    await initGameFs();
    const items = await listFs("Trash");
    for (const it of items) {
      await deleteFs(it.relPath);
    }
    if (items.length > 0) playTrashEmpty();
    addToast(lang === "ru" ? "Корзина очищена" : "Trash has been emptied");
  };

  const openOneDesktopTarget = (rel: string) => {
    if (rel === "") {
      openFiles("");
      return;
    }
    if (rel === "Trash") {
      openFiles("Trash");
      return;
    }
    const entry = desktopItems.find((d) => d.relPath === rel) ?? null;
    if (!entry) return;
    if (entry.kind === "dir") {
      openFiles(entry.relPath);
      return;
    }
    const ext = (entry.ext ?? "").toLowerCase();
    if (ext === "txt" || ext === "md") openNotes(entry.relPath);
    else if (ext === "hack") openScripts(entry.relPath);
    else if (["png", "jpg", "jpeg", "webp", "gif", "mp4", "webm", "ogg"].some((x) => ext.endsWith(x))) {
      openMedia(entry.relPath);
    } else {
      const parent = entry.relPath.split("/").filter(Boolean).slice(0, -1).join("/");
      openFiles(parent);
    }
  };

  const [startSearch, setStartSearch] = useState("");
  const [startGroup, setStartGroup] = useState<StartGroup>("sundry");

  useEffect(() => {
    // Disable browser default context menu inside the game UI.
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener("contextmenu", onContextMenu);

    const onDocClick = (e: MouseEvent) => {
      if (Date.now() < suppressTaskbarMenuDocCloseUntilRef.current) return;
      const el = startRef.current;
      const menuEl = desktopMenuRef.current;
      const networkPopoverEl = networkPopoverRef.current;
      const infoEl = desktopInfoRef.current;
      const clockEl = clockMenuRef.current;
      const clockBtnEl = clockBtnRef.current;
      const taskbarMenuEl = taskbarMenuRef.current;
      const target = e.target;
      const clickedOutsideStart = el ? !(target instanceof Node && el.contains(target)) : true;
      const clickedOutsideMenu = menuEl ? !(target instanceof Node && menuEl.contains(target)) : true;
      const clickedOutsideNetworkPopover = networkPopoverEl ? !(target instanceof Node && networkPopoverEl.contains(target)) : true;
      const clickedOutsideInfo = infoEl ? !(target instanceof Node && infoEl.contains(target)) : true;
      const clickedOutsideClockMenu = clockEl ? !(target instanceof Node && clockEl.contains(target)) : true;
      const clickedOutsideClockBtn = clockBtnEl ? !(target instanceof Node && clockBtnEl.contains(target)) : true;
      const clickedOutsideTaskbarMenu = taskbarMenuEl
        ? !(target instanceof Node && taskbarMenuEl.contains(target))
        : true;
      const clickedOutsideClock = clickedOutsideClockMenu && clickedOutsideClockBtn;
      if (clickedOutsideStart) setStartOpen(false);
      if (clickedOutsideMenu) {
        setDesktopMenuOpen(false);
        setDesktopMenuItemKeys(null);
      }
      if (clickedOutsideNetworkPopover) setNetworkPopoverOpen(false);
      if (clickedOutsideInfo) setDesktopInfo(null);
      if (clickedOutsideClock) setClockMenuOpen(false);
      if (clickedOutsideTaskbarMenu) {
        setTaskbarMenuOpen(false);
        setTaskbarMenuToken(null);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, []);

  const exitGame = () => {
    setStartOpen(false);
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().destroy();
      } catch {
        // Fallback for non-Tauri environments (dev in browser).
        window.close();
      }
    })();
  };

  const exitAccount = () => {
    setStartOpen(false);
    playDesktopLogout();
    logout();
    navigate("/login");
  };

  const openTerminal = () => {
    focusTerminal();
    setTerminalOpen(true);
    setTerminalMinimized(false);
  };

  const minimizeTerminal = () => {
    setTerminalMinimized(true);
    setTerminalOpen(false);
    if (activeWindowToken === makeWindowToken("terminal", "main")) setActiveWindowToken(null);
  };

  const closeTerminal = () => {
    setTerminalOpen(false);
    setTerminalMinimized(false);
    if (activeWindowToken === makeWindowToken("terminal", "main")) setActiveWindowToken(null);
  };

  type TaskbarWindowEntry = {
    token: string;
    windowType: WindowId;
    id: string;
    label: string;
    title: string;
    icon: ReactNode;
    minimized: boolean;
  };
  const [taskbarMenuOpen, setTaskbarMenuOpen] = useState(false);
  const [taskbarMenuPos, setTaskbarMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [taskbarMenuToken, setTaskbarMenuToken] = useState<string | null>(null);
  const taskbarMenuRef = useRef<HTMLDivElement | null>(null);
  const suppressTaskbarMenuDocCloseUntilRef = useRef(0);

  const openDesktopContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest(".taskbar")) return;
    if (target?.closest(".terminal-window")) return;
    if (target?.closest(".settings-window")) return;
    if (target?.closest(".start-menu-popup")) return;
    if (target?.closest(".network-popover")) return;
    if (target?.closest(".desktop-folder-icon")) return;

    e.preventDefault();
    e.stopPropagation();
    setNetworkPopoverOpen(false);
    setStartOpen(false);
    setDesktopMenuPos({ x: e.clientX, y: e.clientY });
    setDesktopMenuItemKeys(null);
    setDesktopMenuOpen(true);
  };

  const taskbarWindows: TaskbarWindowEntry[] = [
    ...(terminalOpen || terminalMinimized
      ? [
          {
            token: makeWindowToken("terminal", "main"),
            windowType: "terminal" as const,
            id: "main",
            label: lang === "ru" ? "Терминал" : "Terminal",
            title: t.dockTerminal,
            icon: <TaskbarThemeIcon src={themeIconUrl("terminal.svg")} alt="" />,
            minimized: terminalMinimized
          }
        ]
      : []),
    ...settingsWindows.map((w) => ({
      token: makeWindowToken("settings", w.id),
      windowType: "settings" as const,
      id: w.id,
      label: t.dockSettings,
      title: t.dockSettings,
      icon: <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" />,
      minimized: w.minimized
    })),
    ...filesWindows.map((w) => ({
      token: makeWindowToken("files", w.id),
      windowType: "files" as const,
      id: w.id,
      label: lang === "ru" ? "Файлы" : "Files",
      title: lang === "ru" ? "Файлы" : "Files",
      icon: <TaskbarThemeIcon src={themeIconUrl("files.svg")} alt="" />,
      minimized: w.minimized
    })),
    ...notesWindows.map((w) => ({
      token: makeWindowToken("notes", w.id),
      windowType: "notes" as const,
      id: w.id,
      label: lang === "ru" ? "Заметки" : "Notes",
      title: lang === "ru" ? "Заметки" : "Notes",
      icon: <TaskbarThemeIcon src={themeIconUrl("notes.svg")} alt="" />,
      minimized: w.minimized
    })),
    ...scriptsWindows.map((w) => ({
      token: makeWindowToken("scripts", w.id),
      windowType: "scripts" as const,
      id: w.id,
      label: lang === "ru" ? "Скрипты" : "Scripts",
      title: lang === "ru" ? "Скрипты" : "Scripts",
      icon: <TaskbarThemeIcon src={themeIconUrl("scripts.svg")} alt="" />,
      minimized: w.minimized
    })),
    ...mediaWindows.map((w) => ({
      token: makeWindowToken("media", w.id),
      windowType: "media" as const,
      id: w.id,
      label: lang === "ru" ? "Медиа" : "Media",
      title: lang === "ru" ? "Медиа" : "Media",
      icon: <TaskbarThemeIcon src={themeIconUrl("media.svg")} alt="" />,
      minimized: w.minimized
    })),
    ...browserWindows.map((w) => ({
      token: makeWindowToken("browser", w.id),
      windowType: "browser" as const,
      id: w.id,
      label: "Zero Browser",
      title: "Zero Browser",
      icon: <TaskbarThemeIcon src={themeIconUrl("browser.svg")} alt="" />,
      minimized: w.minimized
    }))
  ];

  const focusTaskbarWindow = (entry: TaskbarWindowEntry) => {
    switch (entry.windowType) {
      case "terminal":
        setTerminalOpen(true);
        setTerminalMinimized(false);
        focusTerminal();
        break;
      case "settings":
        focusSettingsWindow(entry.id);
        break;
      case "files":
        focusFilesWindow(entry.id);
        break;
      case "notes":
        focusNotesWindow(entry.id);
        break;
      case "scripts":
        focusScriptsWindow(entry.id);
        break;
      case "media":
        focusMediaWindow(entry.id);
        break;
      case "browser":
        setBrowserWindows((prev) => prev.map((w) => w.id === entry.id ? { ...w, minimized: false } : w));
        focusBrowserWindow(entry.id);
        break;
    }
  };

  const minimizeTaskbarWindow = (entry: TaskbarWindowEntry) => {
    switch (entry.windowType) {
      case "terminal":
        minimizeTerminal();
        break;
      case "settings":
        minimizeSettingsWindow(entry.id);
        break;
      case "files":
        minimizeFilesWindow(entry.id);
        break;
      case "notes":
        minimizeNotesWindow(entry.id);
        break;
      case "scripts":
        minimizeScriptsWindow(entry.id);
        break;
      case "media":
        minimizeMediaWindow(entry.id);
        break;
      case "browser":
        minimizeBrowserWindow(entry.id);
        break;
    }
  };

  const closeTaskbarWindow = (entry: TaskbarWindowEntry) => {
    switch (entry.windowType) {
      case "terminal":
        closeTerminal();
        break;
      case "settings":
        closeSettingsWindow(entry.id);
        break;
      case "files":
        closeFilesWindow(entry.id);
        break;
      case "notes":
        closeNotesWindow(entry.id);
        break;
      case "scripts":
        closeScriptsWindow(entry.id);
        break;
      case "media":
        closeMediaWindow(entry.id);
        break;
      case "browser":
        closeBrowserWindow(entry.id);
        break;
    }
  };

  const onTaskbarWindowClick = (entry: TaskbarWindowEntry) => {
    if (entry.minimized) {
      focusTaskbarWindow(entry);
      return;
    }
    if (activeWindowToken === entry.token) {
      minimizeTaskbarWindow(entry);
      return;
    }
    focusTaskbarWindow(entry);
  };
  const openTaskbarWindowMenu = (entry: TaskbarWindowEntry, x: number, y: number) => {
    const MENU_W = 240;
    const MENU_H = 148;
    const GAP = 8;
    const clampedX = Math.min(Math.max(GAP, x), Math.max(GAP, window.innerWidth - MENU_W - GAP));
    const clampedY = Math.min(Math.max(GAP, y), Math.max(GAP, window.innerHeight - MENU_H - GAP));
    setStartOpen(false);
    setDesktopMenuOpen(false);
    setClockMenuOpen(false);
    setNetworkPopoverOpen(false);
    setTaskbarMenuPos({ x: clampedX, y: clampedY });
    setTaskbarMenuToken(entry.token);
    setTaskbarMenuOpen(true);
    suppressTaskbarMenuDocCloseUntilRef.current = Date.now() + 120;
  };

  const toggleClockPopover = (anchor: HTMLButtonElement) => {
    if (clockMenuOpen) {
      setClockMenuOpen(false);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const right = Math.max(8, viewportW - rect.right);
    const bottom = Math.max(50, viewportH - rect.top + 6);
    setClockMenuPos({ right, bottom });
    setCalendarView({ year: now.getFullYear(), month: now.getMonth() });
    setClockMenuOpen(true);
    setNetworkPopoverOpen(false);
    setDesktopMenuOpen(false);
  };

  const taskbarMenuEntry = taskbarWindows.find((w) => w.token === taskbarMenuToken) ?? null;
  const taskbarMenuNode =
    taskbarMenuOpen && taskbarMenuEntry ? (
      <div
        ref={taskbarMenuRef}
        className="desktop-ctx-menu taskbar-window-menu"
        style={{ left: taskbarMenuPos.x, top: taskbarMenuPos.y, zIndex: 1800 }}
        role="menu"
        aria-label={lang === "ru" ? "Меню окна" : "Window menu"}
      >
        <button
          type="button"
          className="desktop-ctx-item"
          onClick={() => {
            if (taskbarMenuEntry.minimized) {
              focusTaskbarWindow(taskbarMenuEntry);
            } else {
              minimizeTaskbarWindow(taskbarMenuEntry);
            }
            setTaskbarMenuOpen(false);
            setTaskbarMenuToken(null);
          }}
        >
          <span className="taskbar-window-menu-ico" aria-hidden="true">
            {taskbarMenuEntry.minimized ? "🗗" : "🗕"}
          </span>
          <span>
            {taskbarMenuEntry.minimized
              ? lang === "ru"
                ? "Развернуть"
                : "Restore"
              : lang === "ru"
                ? "Свернуть"
                : "Minimize"}
          </span>
        </button>
        <button
          type="button"
          className="desktop-ctx-item"
          onClick={() => {
            focusTaskbarWindow(taskbarMenuEntry);
            setTaskbarMenuOpen(false);
            setTaskbarMenuToken(null);
          }}
        >
          <span className="taskbar-window-menu-ico" aria-hidden="true">
            ◱
          </span>
          <span>{lang === "ru" ? "Показать и выделить" : "Show and focus"}</span>
        </button>
        <div className="taskbar-window-menu-sep" aria-hidden="true" />
        <button
          type="button"
          className="desktop-ctx-item desktop-ctx-item--danger"
          onClick={() => {
            closeTaskbarWindow(taskbarMenuEntry);
            setTaskbarMenuOpen(false);
            setTaskbarMenuToken(null);
          }}
        >
          <span className="taskbar-window-menu-ico" aria-hidden="true">
            ✕
          </span>
          <span>{lang === "ru" ? "Закрыть" : "Close"}</span>
        </button>
      </div>
    ) : null;

  const startMenuCatalog = buildStartMenuCatalog(lang, {
    openTerminal,
    openSettings,
    openFiles,
    openNotes,
    openScripts,
    openMedia,
    openBrowser,
  });

  return (
    <div className="game-root">
      <div
        className="game-background-layer"
        style={{
          background: desktopBackground
        }}
      />
      <div
        className="game-ui relative min-h-screen text-slate-100"
        onContextMenu={openDesktopContextMenu}
      >
      {/* Desktop taskbar */}
      <div className="taskbar taskbar-shell">
        <div className="taskbar-zone-left">
          <div className="relative" ref={startRef}>
            <button
              type="button"
              onClick={() => {
                setStartOpen((v) => !v);
                setStartSearch("");
              }}
              className="linux-start-button taskbar-start linux-launcher-btn"
              aria-label={lang === "ru" ? "Открыть меню" : "Open menu"}
              title={lang === "ru" ? "Меню" : "Menu"}
            >
              <TaskbarThemeIcon src={themeIconUrl("start.svg")} alt="" />
            </button>
            {startOpen ? (
              <div className="start-menu-popup" role="menu" aria-label="start menu">
                <header className="start-menu-header">
                  <div className="start-menu-user">
                    <div className="start-menu-avatar" aria-hidden="true">
                      {user?.username?.slice(0, 1).toUpperCase() ?? "U"}
                    </div>
                    <div className="start-menu-user-meta">
                      <div className="start-menu-username">{user?.username ?? (lang === "ru" ? "гость" : "guest")}</div>
                      <div className="start-menu-user-hint">{lang === "ru" ? "Выберите категорию слева" : "Pick a category on the left"}</div>
                    </div>
                  </div>
                </header>

                <div className="start-menu-body">
                  <nav className="start-menu-categories" aria-label={lang === "ru" ? "Категории" : "Categories"}>
                    {(
                      [
                        { id: "games" as const, glyph: "◇", ru: "Игры", en: "Games" },
                        { id: "graphics" as const, glyph: "▣", ru: "Графика", en: "Graphics" },
                        { id: "internet" as const, glyph: "◎", ru: "Интернет", en: "Internet" },
                        { id: "office" as const, glyph: "▦", ru: "Офис", en: "Office" },
                        { id: "sundry" as const, glyph: "▤", ru: "Разное", en: "Sundry" },
                        { id: "programming" as const, glyph: "⌘", ru: "Программирование", en: "Programming" },
                        { id: "science" as const, glyph: "⚗", ru: "Наука", en: "Science" },
                        { id: "sound_video" as const, glyph: "▶", ru: "Звук и видео", en: "Sound & Video" },
                        { id: "other" as const, glyph: "⋯", ru: "Другое", en: "Other" },
                        { id: "wallpapers" as const, glyph: "◫", ru: "Обои", en: "Wallpapers" },
                        { id: "system" as const, glyph: "⚙", ru: "Система", en: "System" }
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`start-menu-cat${startGroup === c.id ? " is-active" : ""}${startSearch.trim() ? " is-dimmed" : ""}`}
                        role="menuitem"
                        onClick={() => {
                          setStartGroup(c.id);
                          setStartSearch("");
                        }}
                      >
                        <span className="start-menu-cat-glyph" aria-hidden="true">
                          {c.glyph}
                        </span>
                        <span className="start-menu-cat-label">{lang === "ru" ? c.ru : c.en}</span>
                      </button>
                    ))}
                  </nav>

                  <div className="start-menu-pane">
                    {startSearch.trim() ? (
                      <>
                        <div className="start-menu-pane-title">
                          {lang === "ru" ? "Результаты поиска" : "Search results"}
                        </div>
                        <div className="start-menu-app-list" role="presentation">
                          {(() => {
                            const q = lowerBlob([startSearch.trim()]);
                            const filtered = startMenuCatalog.allSearchRows.filter((a) => a.matchText.includes(q));
                            if (!filtered.length) {
                              return (
                                <div className="start-menu-pane-empty">
                                  {lang === "ru" ? "Ничего не найдено" : "No results"}
                                </div>
                              );
                            }
                            return filtered.map((a) => (
                              <button
                                key={a.key}
                                type="button"
                                className="start-menu-app-row"
                                role="menuitem"
                                onClick={() => {
                                  setStartOpen(false);
                                  a.action();
                                }}
                              >
                                <span className="start-menu-app-row-ico" aria-hidden="true">
                                  {a.icon}
                                </span>
                                <span className="start-menu-app-row-text">{a.label}</span>
                              </button>
                            ));
                          })()}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="start-menu-pane-title">{startMenuCatalog.groupLabel[startGroup]}</div>
                        <div className="start-menu-app-list" role="presentation">
                          {startMenuCatalog.rowsByGroup[startGroup].map((row) => (
                            <button
                              key={row.key}
                              type="button"
                              className="start-menu-app-row"
                              role="menuitem"
                              onClick={() => {
                                setStartOpen(false);
                                row.action();
                              }}
                            >
                              <span className="start-menu-app-row-ico" aria-hidden="true">
                                {row.icon}
                              </span>
                              <span className="start-menu-app-row-text">{row.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="start-menu-bottom">
                  <div className="start-menu-search">
                    <span className="start-menu-search-ico" aria-hidden="true">
                      <SearchIcon />
                    </span>
                    <input
                      className="start-menu-search-input"
                      placeholder={lang === "ru" ? "Введите для поиска..." : "Type to search..."}
                      value={startSearch}
                      onChange={(e) => setStartSearch(e.target.value)}
                      autoComplete="off"
                    />
                  </div>

                  <div className="start-menu-bottom-actions" role="presentation">
                    <button
                      type="button"
                      className="start-menu-circle-btn"
                      onClick={() => {
                        setStartOpen(false);
                        exitAccount();
                      }}
                      aria-label={lang === "ru" ? "Выйти из аккаунта" : "Log out"}
                      title={lang === "ru" ? "Выйти из аккаунта" : "Log out"}
                    >
                      <DoorIcon />
                    </button>
                    <button
                      type="button"
                      className="start-menu-circle-btn"
                      onClick={() => {
                        setStartOpen(false);
                        exitGame();
                      }}
                      aria-label={lang === "ru" ? "Выйти из игры" : "Exit game"}
                      title={lang === "ru" ? "Выйти из игры" : "Exit game"}
                    >
                      <PowerIcon />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="taskbar-zone-center">
          <div className="taskbar-app-grid">
            {taskbarWindows.map((app) => (
              <button
                key={app.token}
                type="button"
                onClick={() => {
                  setTaskbarMenuOpen(false);
                  setTaskbarMenuToken(null);
                  onTaskbarWindowClick(app);
                }}
                onPointerDown={(e) => {
                  if (e.button !== 2) return;
                  e.preventDefault();
                  e.stopPropagation();
                  openTaskbarWindowMenu(app, e.clientX, e.clientY);
                }}
                onMouseUp={(e) => {
                  if (e.button !== 2) return;
                  e.preventDefault();
                  e.stopPropagation();
                  openTaskbarWindowMenu(app, e.clientX, e.clientY);
                }}
                onAuxClick={(e) => {
                  if (e.button !== 2) return;
                  e.preventDefault();
                  e.stopPropagation();
                  openTaskbarWindowMenu(app, e.clientX, e.clientY);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openTaskbarWindowMenu(app, e.clientX, e.clientY);
                }}
                className={`taskbar-app taskbar-app-chip ${
                  activeWindowToken === app.token && !app.minimized ? "taskbar-app--active" : ""
                } ${app.minimized ? "taskbar-app--minimized" : ""}`}
                aria-label={app.label}
                title={app.title}
              >
                <span className="taskbar-app-chip-icon">{app.icon}</span>
                <span className="taskbar-app-chip-label">{app.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="taskbar-zone-right">
          <div className="taskbar-status-icons">
            <button
              type="button"
              className={`taskbar-app taskbar-status-btn ${
                isNetworkConnected ? "taskbar-net-btn--ok" : isNetworkConnecting ? "taskbar-net-btn--connecting" : "taskbar-net-btn--bad"
              }`}
              onClick={() => setNetworkPopoverOpen((v) => !v)}
              aria-label={lang === "ru" ? "Интернет" : "Network"}
              title={lang === "ru" ? "Сеть" : "Network"}
            >
              <WifiIcon ok={isNetworkConnected} />
            </button>

            <button
              type="button"
              className="taskbar-app taskbar-status-btn"
              onClick={() => {
                setNetworkPopoverOpen(false);
                openSettings();
              }}
              aria-label={t.dockSettings}
              title={t.dockSettings}
            >
              <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" />
            </button>

            {/* Keyboard layout indicator */}
            <button
              type="button"
              className="taskbar-app taskbar-status-btn"
              aria-label={lang === "ru" ? "Раскладка клавиатуры" : "Keyboard layout"}
              title={lang === "ru" ? "Текущая раскладка клавиатуры" : "Current keyboard layout"}
              style={{ minWidth: "48px", fontWeight: 700, fontSize: "11px", cursor: "default" }}
            >
              {keyboardLayout}
            </button>

            {/* Exit/Logout buttons removed (handled via system UI), see Start menu / dialogs. */}
          </div>

          <button
            ref={clockBtnRef}
            type="button"
            className="taskbar-clock linux-clock-btn"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleClockPopover(e.currentTarget as HTMLButtonElement);
            }}
            aria-label={lang === "ru" ? "Часы" : "Clock"}
            title={
              lang === "ru"
                ? `Системное время (${gameTimeZone})`
                : `System time (${gameTimeZone})`
            }
          >
            <span className="taskbar-clock-wrap">
              <span>{clockText}</span>
              <span className="taskbar-clock-date">{clockDateText}</span>
            </span>
          </button>

          {clockMenuOpen ? (
            <div
              ref={clockMenuRef}
              className="clock-popover"
              style={{
                right: clockMenuPos.right,
                bottom: clockMenuPos.bottom
              }}
              role="dialog"
              aria-label={lang === "ru" ? "Календарь" : "Calendar"}
            >
              {(() => {
                const monthNamesRu = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
                const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                const monthNames = lang === "ru" ? monthNamesRu : monthNamesEn;
                const weekdayLabels = lang === "ru" ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

                const year = calendarView.year;
                const month = calendarView.month;
                const firstMs = findUtcMsForZonedDate(year, month, 1, gameTimeZone);
                const startOffset = getZonedWeekdayMon0(firstMs, gameTimeZone); // Monday first
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                const todayZ = getZonedYmd(now.getTime(), gameTimeZone);

                const monthIso = `${year}-${String(month + 1).padStart(2, "0")}`;
                const cells = Array.from({ length: 42 }, (_, idx) => {
                  const dayNum = idx - startOffset + 1;
                  const inCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                  if (!inCurrentMonth) return <div key={idx} className="clock-day clock-day--ghost" />;
                  const isToday =
                    todayZ.y === year && todayZ.m0 === month && dayNum === todayZ.d;
                  const iso = `${monthIso}-${String(dayNum).padStart(2, "0")}`;
                  const isSelected = calendarSelectedIso === iso;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`clock-day ${isToday ? "clock-day--today" : ""} ${isSelected ? "clock-day--selected" : ""}`}
                      onClick={() => {
                        setCalendarSelectedIso(iso);
                      }}
                    >
                      {dayNum}
                    </button>
                  );
                });

                return (
                  <>
                    <div className="clock-popover-header">
                      <button
                        type="button"
                        className="clock-nav-btn"
                        onClick={() => {
                          const d = new Date(year, month - 1, 1);
                          setCalendarView({ year: d.getFullYear(), month: d.getMonth() });
                        }}
                        aria-label={lang === "ru" ? "Предыдущий месяц" : "Previous month"}
                      >
                        ‹
                      </button>
                      <div className="clock-month-label">
                        {monthNames[month]} {year}
                      </div>
                      <button
                        type="button"
                        className="clock-nav-btn"
                        onClick={() => {
                          const d = new Date(year, month + 1, 1);
                          setCalendarView({ year: d.getFullYear(), month: d.getMonth() });
                        }}
                        aria-label={lang === "ru" ? "Следующий месяц" : "Next month"}
                      >
                        ›
                      </button>
                    </div>

                    <div className="clock-popover-time">
                      <span className="clock-time">{clockPopoverTimeText}</span>
                      <button
                        type="button"
                        className="clock-today-btn"
                        onClick={() => {
                          const z = getZonedYmd(now.getTime(), gameTimeZone);
                          setCalendarView({ year: z.y, month: z.m0 });
                          const iso = `${z.y}-${String(z.m0 + 1).padStart(2, "0")}-${String(z.d).padStart(2, "0")}`;
                          setCalendarSelectedIso(iso);
                        }}
                      >
                        {lang === "ru" ? "Сегодня" : "Today"}
                      </button>
                    </div>

                    <div className="clock-weekdays">
                      {weekdayLabels.map((w) => (
                        <div key={w} className="clock-weekday">
                          {w}
                        </div>
                      ))}
                    </div>

                    <div className="clock-days-grid">{cells}</div>
                  </>
                );
              })()}
            </div>
          ) : null}

          {networkPopoverOpen ? (
            <div
              ref={networkPopoverRef}
              style={{
                position: "fixed",
                right: 8,
                bottom: 56,
                zIndex: 1200
              }}
              role="menu"
              aria-label={lang === "ru" ? "Меню сети" : "Network menu"}
            >
              <NetworkPopover
                isConnected={isNetworkConnected}
                isConnecting={isNetworkConnecting}
                bandwidth={networkBandwidth}
                userIpAddress={user?.ip_address || null}
                onToggleConnection={toggleNetworkConnection}
                lang={lang}
              />
            </div>
          ) : null}

        </div>
      </div>

      {typeof document !== "undefined" && taskbarMenuNode ? createPortal(taskbarMenuNode, document.body) : null}

      {/* Desktop context menu (ПКМ по рабочему столу) */}
      {desktopMenuOpen ? (
        <div
          ref={desktopMenuRef}
          className="desktop-ctx-menu"
          style={{
            left: Math.min(desktopMenuPos.x, window.innerWidth - 240),
            top: Math.min(desktopMenuPos.y, window.innerHeight - 220)
          }}
          role="menu"
          aria-label="desktop context menu"
        >
          {desktopMenuItemKeys !== null ? (
            (() => {
              const keys = desktopMenuItemKeys;
              const uniq = [...new Set(keys)];
              const deletableFs = uniq.filter((k) => k !== "" && k !== "Trash");
              const onlyTrashSingle = uniq.length === 1 && uniq[0] === "Trash";
              const single = uniq.length === 1 ? uniq[0]! : null;
              const createParentDir =
                single === null
                  ? null
                  : single === "" || single === "Trash"
                    ? single
                    : (() => {
                        const ent = desktopItems.find((d) => d.relPath === single);
                        if (!ent) return "";
                        if (ent.kind === "file") {
                          return ent.relPath.split("/").filter(Boolean).slice(0, -1).join("/");
                        }
                        return single;
                      })();
              /* Один целевой объект: создаём в его папке (корень, корзина, каталог или родитель файла). */
              const showCreate = single !== null;
              const showRename = uniq.length === 1 && deletableFs.length === 1;
              const renameRel = showRename ? deletableFs[0]! : "";

              return (
                <>
                  <div
                    className="desktop-ctx-item"
                    role="menuitem"
                    onClick={() => {
                      setDesktopMenuOpen(false);
                      setDesktopMenuItemKeys(null);
                      for (const rel of uniq) {
                        openOneDesktopTarget(rel);
                      }
                    }}
                  >
                    <span className="desktop-ctx-ico" aria-hidden="true">
                      ▶
                    </span>
                    <span>{lang === "ru" ? "Открыть" : "Open"}</span>
                  </div>
                  {showCreate && createParentDir !== null ? (
                    <>
                      <div
                        className="desktop-ctx-item"
                        role="menuitem"
                        onClick={() => {
                          setDesktopMenuOpen(false);
                          setDesktopMenuItemKeys(null);
                          void createDesktopFolder(createParentDir);
                        }}
                      >
                        <span className="desktop-ctx-ico" aria-hidden="true">
                          <span style={{ fontSize: 16, opacity: 0.95 }}>＋</span>
                        </span>
                        <span>{lang === "ru" ? "Создать папку" : "New folder"}</span>
                      </div>
                      <div
                        className="desktop-ctx-item"
                        role="menuitem"
                        onClick={() => {
                          setDesktopMenuOpen(false);
                          setDesktopMenuItemKeys(null);
                          void createTextFileAt(createParentDir, "txt");
                        }}
                      >
                        <span className="desktop-ctx-ico" aria-hidden="true">
                          ●
                        </span>
                        <span>{lang === "ru" ? "Создать текстовый файл" : "New text file"}</span>
                      </div>
                      <div
                        className="desktop-ctx-item"
                        role="menuitem"
                        onClick={() => {
                          setDesktopMenuOpen(false);
                          setDesktopMenuItemKeys(null);
                          void createHackFileAt(createParentDir);
                        }}
                      >
                        <span className="desktop-ctx-ico" aria-hidden="true">
                          ⌁
                        </span>
                        <span>{lang === "ru" ? "Создать HackScript" : "New HackScript"}</span>
                      </div>
                    </>
                  ) : null}
                  {showRename ? (
                    <div
                      className="desktop-ctx-item"
                      role="menuitem"
                      onClick={() => {
                        const rel = renameRel;
                        if (!rel || rel === "Trash") return;
                        setDesktopMenuOpen(false);
                        setDesktopMenuItemKeys(null);
                        void (async () => {
                          const base = rel.split("/").filter(Boolean).pop() ?? "";
                          const parent = rel.includes("/") ? rel.split("/").filter(Boolean).slice(0, -1).join("/") : "";
                          const newName = await promptAsync(
                            lang === "ru" ? `Новое имя для (${base})` : `New name for (${base})`,
                            base
                          );
                          if (newName === null) return;
                          const safe = sanitizeBaseName(newName);
                          if (!safe) return;
                          const dst = parent ? `${parent}/${safe}` : safe;
                          await moveFs(rel, dst);
                          await reloadDesktopDirs();
                        })().catch((e) => {
                          const msg = e instanceof Error ? e.message : String(e);
                          addToast(lang === "ru" ? `Ошибка переименования: ${msg}` : `Rename failed: ${msg}`);
                        });
                      }}
                    >
                      <span className="desktop-ctx-ico" aria-hidden="true">
                        ✎
                      </span>
                      <span>{lang === "ru" ? "Переименовать" : "Rename"}</span>
                    </div>
                  ) : null}
                  {onlyTrashSingle ? (
                    <div
                      className="desktop-ctx-item"
                      role="menuitem"
                      onClick={() => {
                        setDesktopMenuOpen(false);
                        setDesktopMenuItemKeys(null);
                        void (async () => {
                          const ok = await confirmAsync(lang === "ru" ? "Очистить корзину?" : "Empty trash?");
                          if (!ok) return;
                          await clearTrash();
                        })().catch((e) => {
                          const msg = e instanceof Error ? e.message : String(e);
                          addToast(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
                        });
                      }}
                    >
                      <span className="desktop-ctx-ico" aria-hidden="true">
                        <img src={breezePlaceUrl("user-trash")} alt="" className="desktop-ctx-theme-icon" draggable={false} />
                      </span>
                      <span>{lang === "ru" ? "Очистить корзину" : "Empty Trash"}</span>
                    </div>
                  ) : deletableFs.length > 0 ? (
                    <div
                      className="desktop-ctx-item"
                      role="menuitem"
                      onClick={() => {
                        setDesktopMenuOpen(false);
                        setDesktopMenuItemKeys(null);
                        void (async () => {
                          const n = deletableFs.length;
                          const ok = await confirmAsync(
                            lang === "ru"
                              ? `Удалить выбранные объекты (${n})?`
                              : `Delete ${n} selected item(s)?`
                          );
                          if (!ok) return;
                          for (const rel of deletableFs) {
                            await moveEntryToTrash(rel);
                          }
                        })().catch((e) => {
                          const msg = e instanceof Error ? e.message : String(e);
                          addToast(lang === "ru" ? `Ошибка удаления: ${msg}` : `Delete failed: ${msg}`);
                        });
                      }}
                    >
                      <span className="desktop-ctx-ico" aria-hidden="true">
                        <img src={breezePlaceUrl("user-trash")} alt="" className="desktop-ctx-theme-icon" draggable={false} />
                      </span>
                      <span>
                        {lang === "ru"
                          ? deletableFs.length > 1
                            ? `Удалить (${deletableFs.length})`
                            : "Удалить"
                          : deletableFs.length > 1
                            ? `Delete (${deletableFs.length})`
                            : "Delete"}
                      </span>
                    </div>
                  ) : null}
                  <div
                    className="desktop-ctx-item"
                    role="menuitem"
                    onClick={() => {
                      const lines: string[] = [];
                      if (uniq.length > 1) {
                        lines.push(
                          lang === "ru" ? `Выбрано объектов: ${uniq.length}` : `Selected items: ${uniq.length}`
                        );
                        for (const rel of uniq.slice(0, 14)) {
                          if (rel === "")
                            lines.push(lang === "ru" ? "Компьютер" : "Computer");
                          else if (rel === "Trash") lines.push(lang === "ru" ? "Корзина" : "Trash");
                          else lines.push(`${lang === "ru" ? "Путь" : "Path"}: ${rel}`);
                        }
                        if (uniq.length > 14) {
                          lines.push("…");
                        }
                      } else {
                        const rel = uniq[0]!;
                        const entry = desktopItems.find((d) => d.relPath === rel) ?? null;
                        const pathText = rel === "" ? "/" : rel;
                        lines.push(lang === "ru" ? `Путь: ${pathText}` : `Path: ${pathText}`);
                        if (entry) {
                          lines.push(
                            lang === "ru"
                              ? `Тип: ${entry.kind === "dir" ? "Папка" : "Файл"}${entry.ext ? `.${entry.ext}` : ""}`
                              : `Type: ${entry.kind === "dir" ? "Folder" : "File"}${entry.ext ? `.${entry.ext}` : ""}`
                          );
                          lines.push(lang === "ru" ? `Размер: ${entry.size} байт` : `Size: ${entry.size} bytes`);
                        } else if (rel === "Trash") {
                          lines.push(lang === "ru" ? "Тип: Корзина" : "Type: Trash");
                        } else if (rel === "") {
                          lines.push(lang === "ru" ? "Тип: Компьютер" : "Type: Computer");
                        }
                      }

                      setDesktopMenuOpen(false);
                      setDesktopMenuItemKeys(null);
                      setDesktopInfo({
                        pos: desktopMenuPos,
                        title: lang === "ru" ? "Свойства" : "Properties",
                        lines
                      });
                    }}
                  >
                    <span className="desktop-ctx-ico" aria-hidden="true">
                      ℹ
                    </span>
                    <span>{lang === "ru" ? "Свойства" : "Properties"}</span>
                  </div>
                </>
              );
            })()
          ) : (
            <>
              <div
                className="desktop-ctx-item"
                role="menuitem"
                onClick={() => {
                  setDesktopMenuOpen(false);
                  setDesktopMenuItemKeys(null);
                  setDesktopCreateDesiredCell({
                    col: Math.round((desktopMenuPos.x - DESK_LEFT) / CELL_W),
                    row: Math.round((desktopMenuPos.y - DESK_TOP) / CELL_H)
                  });
                  void createDesktopFolder(null);
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true"><span style={{ fontSize: 16, opacity: 0.95 }}>＋</span></span>
                <span>{lang === "ru" ? "Создать папку" : "New folder"}</span>
              </div>
              <div
                className="desktop-ctx-item"
                role="menuitem"
                onClick={() => {
                  setDesktopMenuOpen(false);
                  setDesktopMenuItemKeys(null);
                  void createTextFileAt(null, "txt");
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true">●</span>
                <span>{lang === "ru" ? "Создать текстовый файл" : "New text file"}</span>
              </div>
              <div
                className="desktop-ctx-item"
                role="menuitem"
                onClick={() => {
                  setDesktopMenuOpen(false);
                  setDesktopMenuItemKeys(null);
                  void createHackFileAt(null);
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true">⌁</span>
                <span>{lang === "ru" ? "Создать HackScript" : "New HackScript"}</span>
              </div>
              <div
                className="desktop-ctx-item"
                role="menuitem"
                onClick={() => {
                  setDesktopMenuOpen(false);
                  setDesktopMenuItemKeys(null);
                  openSettings("system");
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true"><span style={{ fontSize: 16, opacity: 0.95 }}>⚙</span></span>
                <span>{lang === "ru" ? "Свойства" : "Properties"}</span>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Desktop icons */}
      <div
        className={`desktop-icons-layer ${desktopDropActive ? "desktop-drop-active" : ""}`}
        onDragOver={(e) => {
          const internal =
            e.dataTransfer.getData("application/x-zeroday-fs-relpath") ||
            (e.dataTransfer.getData("text/plain").startsWith("zd-fs:")
              ? e.dataTransfer.getData("text/plain").slice(6)
              : e.dataTransfer.getData("text/plain"));
          if (!internal) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDesktopDropActive(true);
        }}
        onDragLeave={(e) => {
          const nextTarget = e.relatedTarget as Node | null;
          if (!nextTarget || !e.currentTarget.contains(nextTarget)) {
            setDesktopDropActive(false);
          }
        }}
        onDrop={(e) => {
          const internal =
            e.dataTransfer.getData("application/x-zeroday-fs-relpath") ||
            (e.dataTransfer.getData("text/plain").startsWith("zd-fs:")
              ? e.dataTransfer.getData("text/plain").slice(6)
              : e.dataTransfer.getData("text/plain"));
          setDesktopDropActive(false);
          if (!internal) return;
          e.preventDefault();
          // Use selected paths if multiple files are selected, otherwise just the dragged one
          const sources = desktopSelectedRelPaths.size > 1 
            ? [...desktopSelectedRelPaths].filter(p => p !== "" && p !== "Trash")
            : [internal];
          void moveMultipleEntriesToDesktopRoot(sources);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if (draggingRelPath) return;
          const target = e.target as HTMLElement | null;
          if (target?.closest(".desktop-folder-icon")) return;

          setDesktopMenuOpen(false);
          setNetworkPopoverOpen(false);
          setStartOpen(false);

          setDesktopSelectionRect({
            x1: e.clientX,
            y1: e.clientY,
            x2: e.clientX,
            y2: e.clientY
          });
        }}
      >
        {(() => {
          const defaults = getDefaultSpecialCells();
          const computer = desktopIconCells[DESKTOP_COMPUTER_CELL_KEY] ?? defaults.computer;
          const trash = desktopIconCells[DESKTOP_TRASH_CELL_KEY] ?? defaults.trash;
          const computerLeft = DESK_LEFT + computer.col * CELL_W;
          const computerTop = DESK_TOP + computer.row * CELL_H;
          const trashLeft = DESK_LEFT + trash.col * CELL_W;
          const trashTop = DESK_TOP + trash.row * CELL_H;
          const computerDragging = draggingRelPath === DESKTOP_COMPUTER_CELL_KEY && dragPreviewPos;
          const trashDragging = draggingRelPath === DESKTOP_TRASH_CELL_KEY && dragPreviewPos;

          return (
            <>
              <div
                className={`desktop-folder-icon ${
                  desktopSelectedRelPaths.has("") ? "desktop-folder-icon--selected" : ""
                }`}
                style={{
                  left: computerDragging ? dragPreviewPos!.x : computerLeft,
                  top: computerDragging ? dragPreviewPos!.y : computerTop,
                  zIndex: computerDragging ? 120 : 10
                }}
                onDoubleClick={() => openFiles("")}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const sel = desktopSelectedRelPathsRef.current;
                  if (sel.size > 1 && sel.has("")) {
                    setDesktopMenuItemKeys([...sel]);
                  } else {
                    setDesktopSelectedRelPaths(new Set([""]));
                    setDesktopMenuItemKeys([""]);
                  }
                  setDesktopMenuPos({ x: e.clientX, y: e.clientY });
                  setDesktopMenuOpen(true);
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const order = getDesktopKeysInVisualOrder();
                  if (e.ctrlKey || e.metaKey) {
                    setDesktopSelectedRelPaths((prev) => {
                      const next = new Set(prev);
                      if (next.has("")) next.delete("");
                      else next.add("");
                      return next;
                    });
                    desktopSelectionAnchorRef.current = "";
                  } else if (e.shiftKey) {
                    const anchor = desktopSelectionAnchorRef.current;
                    const ia = anchor == null ? -1 : order.indexOf(anchor);
                    const ib = order.indexOf("");
                    if (ia < 0 || ib < 0) {
                      setDesktopSelectedRelPaths(new Set([""]));
                    } else {
                      const lo = Math.min(ia, ib);
                      const hi = Math.max(ia, ib);
                      setDesktopSelectedRelPaths(new Set(order.slice(lo, hi + 1)));
                    }
                  } else {
                    setDesktopSelectedRelPaths(new Set([""]));
                    desktopSelectionAnchorRef.current = "";
                  }
                  desktopDragGroupRef.current = [];
                  dragGroupPixelOffsetsRef.current = new Map();
                  dragOffsetRef.current = { dx: e.clientX - computerLeft, dy: e.clientY - computerTop };
                  setDraggingRelPath(DESKTOP_COMPUTER_CELL_KEY);
                  setDragPreviewPos({ x: computerLeft, y: computerTop });
                }}
              >
                <span className="desktop-folder-ico" aria-hidden="true">
                  <img src={breezePlaceUrl("computer")} alt="" className="desktop-breeze-icon" draggable={false} />
                </span>
                <span className="desktop-folder-name">{lang === "ru" ? "Компьютер" : "Computer"}</span>
              </div>
              <div
                className={`desktop-folder-icon ${
                  desktopSelectedRelPaths.has("Trash") ? "desktop-folder-icon--selected" : ""
                }`}
                style={{
                  left: trashDragging ? dragPreviewPos!.x : trashLeft,
                  top: trashDragging ? dragPreviewPos!.y : trashTop,
                  zIndex: trashDragging ? 120 : 10
                }}
                onDoubleClick={() => openFiles("Trash")}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const sel = desktopSelectedRelPathsRef.current;
                  if (sel.size > 1 && sel.has("Trash")) {
                    setDesktopMenuItemKeys([...sel]);
                  } else {
                    setDesktopSelectedRelPaths(new Set(["Trash"]));
                    setDesktopMenuItemKeys(["Trash"]);
                  }
                  setDesktopMenuPos({ x: e.clientX, y: e.clientY });
                  setDesktopMenuOpen(true);
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const order = getDesktopKeysInVisualOrder();
                  if (e.ctrlKey || e.metaKey) {
                    setDesktopSelectedRelPaths((prev) => {
                      const next = new Set(prev);
                      if (next.has("Trash")) next.delete("Trash");
                      else next.add("Trash");
                      return next;
                    });
                    desktopSelectionAnchorRef.current = "Trash";
                  } else if (e.shiftKey) {
                    const anchor = desktopSelectionAnchorRef.current;
                    const ia = anchor == null ? -1 : order.indexOf(anchor);
                    const ib = order.indexOf("Trash");
                    if (ia < 0 || ib < 0) {
                      setDesktopSelectedRelPaths(new Set(["Trash"]));
                    } else {
                      const lo = Math.min(ia, ib);
                      const hi = Math.max(ia, ib);
                      setDesktopSelectedRelPaths(new Set(order.slice(lo, hi + 1)));
                    }
                  } else {
                    setDesktopSelectedRelPaths(new Set(["Trash"]));
                    desktopSelectionAnchorRef.current = "Trash";
                  }
                  desktopDragGroupRef.current = [];
                  dragGroupPixelOffsetsRef.current = new Map();
                  dragOffsetRef.current = { dx: e.clientX - trashLeft, dy: e.clientY - trashTop };
                  setDraggingRelPath(DESKTOP_TRASH_CELL_KEY);
                  setDragPreviewPos({ x: trashLeft, y: trashTop });
                }}
              >
                <span className="desktop-folder-ico" aria-hidden="true">
                  <img src={breezePlaceUrl("user-trash")} alt="" className="desktop-breeze-icon" draggable={false} />
                </span>
                <span className="desktop-folder-name">{lang === "ru" ? "Корзина" : "Trash"}</span>
              </div>
              {desktopItems.map((f) => {
                const cell = desktopIconCells[f.relPath];
                if (!cell) return null;
                const groupDrag = desktopDragGroupRef.current;
                const px = dragPreviewPos;
                const multiDragging = Boolean(
                  px && draggingRelPath && groupDrag.length > 1 && groupDrag.includes(f.relPath)
                );
                const off = dragGroupPixelOffsetsRef.current.get(f.relPath);
                const left =
                  multiDragging && px && off
                    ? px.x + off.dx
                    : draggingRelPath === f.relPath && px
                      ? px.x
                      : DESK_LEFT + cell.col * CELL_W;
                const top =
                  multiDragging && px && off
                    ? px.y + off.dy
                    : draggingRelPath === f.relPath && px
                      ? px.y
                      : DESK_TOP + cell.row * CELL_H;
                const raised = multiDragging || draggingRelPath === f.relPath;

                return (
                  <div
                    key={f.relPath}
                    className={`desktop-folder-icon ${
                      desktopSelectedRelPaths.has(f.relPath) ? "desktop-folder-icon--selected" : ""
                    }`}
                    style={{
                      left,
                      top,
                      zIndex: raised ? 120 : 10
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const sel = desktopSelectedRelPathsRef.current;
                      if (sel.size > 1 && sel.has(f.relPath)) {
                        setDesktopMenuItemKeys([...sel]);
                      } else {
                        setDesktopSelectedRelPaths(new Set([f.relPath]));
                        setDesktopMenuItemKeys([f.relPath]);
                      }
                      setDesktopMenuPos({ x: e.clientX, y: e.clientY });
                      setDesktopMenuOpen(true);
                      setStartOpen(false);
                      setNetworkPopoverOpen(false);
                    }}
                    onDoubleClick={() => {
                      if (draggingRelPath) return;
                      if (f.kind === "dir") {
                        openFiles(f.relPath);
                        return;
                      }
                      const ext = (f.ext ?? "").toLowerCase();
                      if (ext === "txt" || ext === "md") {
                        openNotes(f.relPath);
                      } else if (ext === "hack") {
                        openScripts(f.relPath);
                      } else if (
                        ["png", "jpg", "jpeg", "webp", "gif", "mp4", "webm", "ogg"].some((x) => ext.endsWith(x))
                      ) {
                        openMedia(f.relPath);
                      } else {
                        const parent = f.relPath.split("/").filter(Boolean).slice(0, -1).join("/");
                        openFiles(parent);
                      }
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;

                      const cur = desktopSelectedRelPathsRef.current;
                      const order = getDesktopKeysInVisualOrder();
                      let nextSel: Set<string>;

                      if (e.ctrlKey || e.metaKey) {
                        nextSel = new Set(cur);
                        if (nextSel.has(f.relPath)) nextSel.delete(f.relPath);
                        else nextSel.add(f.relPath);
                        setDesktopSelectedRelPaths(nextSel);
                        desktopSelectionAnchorRef.current = f.relPath;
                      } else if (e.shiftKey) {
                        const anchor = desktopSelectionAnchorRef.current;
                        const ia = anchor == null ? -1 : order.indexOf(anchor);
                        const ib = order.indexOf(f.relPath);
                        if (ia < 0 || ib < 0) {
                          nextSel = new Set([f.relPath]);
                        } else {
                          const lo = Math.min(ia, ib);
                          const hi = Math.max(ia, ib);
                          nextSel = new Set(order.slice(lo, hi + 1));
                        }
                        setDesktopSelectedRelPaths(nextSel);
                        desktopSelectionAnchorRef.current = f.relPath;
                      } else if (cur.has(f.relPath) && cur.size > 1) {
                        nextSel = new Set(cur);
                      } else {
                        nextSel = new Set([f.relPath]);
                        setDesktopSelectedRelPaths(nextSel);
                        desktopSelectionAnchorRef.current = f.relPath;
                      }

                      const fileGroup = [...nextSel].filter((k) =>
                        desktopItemsRef.current.some((it) => it.relPath === k)
                      );
                      const primary = f.relPath;
                      const cells = desktopIconCellsRef.current;
                      const c = cells[primary];
                      if (!c) return;
                      const startLeft = DESK_LEFT + c.col * CELL_W;
                      const startTop = DESK_TOP + c.row * CELL_H;
                      dragOffsetRef.current = { dx: e.clientX - startLeft, dy: e.clientY - startTop };

                      const offsets = new Map<string, { dx: number; dy: number }>();
                      for (const rel of fileGroup) {
                        const ce = cells[rel];
                        if (!ce) continue;
                        const L = DESK_LEFT + ce.col * CELL_W;
                        const T = DESK_TOP + ce.row * CELL_H;
                        offsets.set(rel, { dx: L - startLeft, dy: T - startTop });
                      }
                      dragGroupPixelOffsetsRef.current = offsets;
                      desktopDragGroupRef.current = fileGroup;

                      setDraggingRelPath(primary);
                      setDragPreviewPos({ x: startLeft, y: startTop });
                      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <span className="desktop-folder-ico" aria-hidden="true">
                      {f.kind === "dir" ? (
                        <img src={breezePlaceUrl("folder")} alt="" className="desktop-breeze-icon" draggable={false} />
                      ) : (
                        <span style={{ fontSize: 11, opacity: 0.95 }}>
                          {(f.ext ? `.${f.ext}` : "").slice(0, 6).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="desktop-folder-name">{f.name}</span>
                  </div>
                );
              })}
            </>
          );
        })()}
      </div>

      {desktopSelectionRect ? (
        <div
          className="desktop-selection-rect"
          style={{
            left: Math.min(desktopSelectionRect.x1, desktopSelectionRect.x2),
            top: Math.min(desktopSelectionRect.y1, desktopSelectionRect.y2),
            width: Math.abs(desktopSelectionRect.x2 - desktopSelectionRect.x1),
            height: Math.abs(desktopSelectionRect.y2 - desktopSelectionRect.y1)
          }}
        />
      ) : null}

      {desktopInfo ? (
        <div
          ref={desktopInfoRef}
          className="desktop-info-popover"
          style={{
            left: Math.min(desktopInfo.pos.x, window.innerWidth - 260),
            top: Math.min(desktopInfo.pos.y, window.innerHeight - 200)
          }}
          role="dialog"
          aria-label={desktopInfo.title}
        >
          <div className="desktop-info-title">{desktopInfo.title}</div>
          <div className="desktop-info-lines">
            {desktopInfo.lines.map((l, idx) => (
              <div key={`${idx}-${l}`} className="desktop-info-line">
                {l}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title ?? ""}
        message={confirmState?.message ?? ""}
        danger
        confirmLabel={lang === "ru" ? "Удалить" : "Delete"}
        cancelLabel={lang === "ru" ? "Отмена" : "Cancel"}
        onConfirm={() => {
          const res = confirmState?.resolve;
          setConfirmState(null);
          res?.(true);
        }}
        onCancel={() => {
          const res = confirmState?.resolve;
          setConfirmState(null);
          res?.(false);
        }}
      />

      <TextPromptDialog
        open={Boolean(promptState)}
        title={promptState?.title ?? ""}
        defaultValue={promptState?.defaultValue ?? ""}
        placeholder={lang === "ru" ? "Введите значение" : "Enter value"}
        okLabel={lang === "ru" ? "ОК" : "OK"}
        cancelLabel={lang === "ru" ? "Отмена" : "Cancel"}
        onSubmit={(v) => {
          const res = promptState?.resolve;
          setPromptState(null);
          res?.(v);
        }}
      />

      {/* In-game notifications */}
      {toasts.length ? (
        <div className="game-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="game-toast">
              {t.message}
            </div>
          ))}
        </div>
      ) : null}

      <div className="window-stage">
        {/* Settings app windows */}
        {settingsWindows.map((w) => (
          <SettingsApp
            key={w.id}
            lang={lang}
            onClose={() => closeSettingsWindow(w.id)}
            onMinimize={() => minimizeSettingsWindow(w.id)}
            minimized={w.minimized}
            initialTab={w.initialTab}
            onFocus={() => focusSettingsWindow(w.id)}
            zIndex={w.z}
          />
        ))}

        {/* Files app windows */}
        {filesWindows.map((w) => (
          <FilesApp
            key={w.id}
            lang={lang}
            startRelPath={w.startRelPath}
            onMinimize={() => minimizeFilesWindow(w.id)}
            onClose={() => closeFilesWindow(w.id)}
            minimized={w.minimized}
              diskCapacityMb={user?.disk_capacity_mb}
            onOpenNotes={(relPath) => openNotes(relPath)}
            onOpenScript={(relPath) => openScripts(relPath)}
            onOpenMedia={(relPath) => openMedia(relPath)}
            onFsChanged={() => {
              void reloadDesktopDirs();
            }}
            onFocus={() => focusFilesWindow(w.id)}
            zIndex={w.z}
          />
        ))}

        {/* Notes app windows */}
        {notesWindows.map((w) => (
          <NotesApp
            key={w.id}
            lang={lang}
            initialRelPath={w.initialRelPath}
            onMinimize={() => minimizeNotesWindow(w.id)}
            onClose={() => closeNotesWindow(w.id)}
            minimized={w.minimized}
            onFocus={() => focusNotesWindow(w.id)}
            zIndex={w.z}
          />
        ))}

        {/* Code editor app windows */}
        {scriptsWindows.map((w) => (
          <CodeEditorApp
            key={w.id}
            lang={lang}
            initialRelPath={w.initialRelPath}
            onMinimize={() => minimizeScriptsWindow(w.id)}
            onClose={() => closeScriptsWindow(w.id)}
            minimized={w.minimized}
            onFocus={() => focusScriptsWindow(w.id)}
            zIndex={w.z}
            onRunScript={(scriptPath, scriptCode) => {
              // Script execution handled internally by CodeEditorApp
              console.log(`Script executed: ${scriptPath}`);
            }}
          />
        ))}

        {/* Media app windows */}
        {mediaWindows.map((w) => (
          <MediaApp
            key={w.id}
            lang={lang}
            initialRelPath={w.initialRelPath}
            onMinimize={() => minimizeMediaWindow(w.id)}
            onClose={() => closeMediaWindow(w.id)}
            minimized={w.minimized}
            onFocus={() => focusMediaWindow(w.id)}
            zIndex={w.z}
          />
        ))}

        {/* Browser windows */}
        {browserWindows.map((w) => (
          <ZeroBrowser
            key={w.id}
            lang={lang}
            onMinimize={() => minimizeBrowserWindow(w.id)}
            onClose={() => closeBrowserWindow(w.id)}
            minimized={w.minimized}
            onFocus={() => focusBrowserWindow(w.id)}
            zIndex={w.z}
            isOnline={isNetworkConnected}
            bandwidth={networkBandwidth}
          />
        ))}

        {/* Terminal window */}
        {terminalOpen || terminalMinimized ? (
          <TerminalApp
            user={user}
            lang={lang}
            onExitGame={exitGame}
            onLogout={exitAccount}
            onMinimize={minimizeTerminal}
            onClose={closeTerminal}
            minimized={terminalMinimized && !terminalOpen}
            injectKey={terminalInjectKey}
            injectLines={terminalInjectLines}
            onFocus={focusTerminal}
            zIndex={terminalZ}
          />
        ) : null}
      </div>
      </div>
    </div>
  );
}
