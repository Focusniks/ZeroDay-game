import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useAuth } from "../hooks/useAuth";
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

function TerminalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M6 9l4 3-4 3" />
    </svg>
  );
}

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

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v11h14V10" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h6l2 2h10v12H3V7z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="7" width="13" height="14" rx="2" />
      <path d="M16 11l5-3v12l-5-3" />
    </svg>
  );
}

function GearIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-1.6 2.77-.08-.02a1.65 1.65 0 0 0-1.88.53l-.05.05-2.77-1.6.02-.08a1.65 1.65 0 0 0-.99-1.6l-.07-.03v-3.2l.07-.03a1.65 1.65 0 0 0 .99-1.6l-.02-.08 2.77-1.6.05.05a1.65 1.65 0 0 0 1.88.53l.08-.02 1.6 2.77-.06.06a1.65 1.65 0 0 0-.33 1.82z" />
    </svg>
  );
}

function FilesIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function NoteIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h6" />
    </svg>
  );
}

function CodeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 18l6-6-6-6" />
      <path d="M8 6l-6 6 6 6" />
    </svg>
  );
}

function MediaIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 10h.01" />
      <path d="M21 15l-5-5-4 4-2-2-4 4" />
    </svg>
  );
}

function StartOrbIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function WifiIcon({ ok }: { ok: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 10.5a10 10 0 0 1 14 0" />
      <path d="M8.5 13.8a6 6 0 0 1 7 0" />
      <path d="M12 17.1h0" />
      {ok ? <path d="M7.5 7.5a14 14 0 0 1 9 0" /> : <path d="M4 4l16 16" />}
    </svg>
  );
}

export function DashboardPage() {
  const { user, logout, wsState, wsUrl } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { config } = useGameConfig();

  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalMinimized, setTerminalMinimized] = useState(false);

  const [startOpen, setStartOpen] = useState(false);
  const startRef = useRef<HTMLDivElement | null>(null);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const clockText = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const clockDateText = now.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const [clockMenuOpen, setClockMenuOpen] = useState(false);
  const clockMenuRef = useRef<HTMLDivElement | null>(null);
  const clockBtnRef = useRef<HTMLButtonElement | null>(null);
  const [clockMenuPos, setClockMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [calendarView, setCalendarView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; // month: 0..11
  });

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

  const [netMenuOpen, setNetMenuOpen] = useState(false);
  const netMenuRef = useRef<HTMLDivElement | null>(null);

  const netIsConnected = wsState === "open";
  const netIsConnecting = wsState === "connecting";
  const netStatusText =
    netIsConnected ? (lang === "ru" ? "Сеть подключена" : "Network connected") : netIsConnecting
      ? (lang === "ru" ? "Подключение..." : "Connecting...")
      : lang === "ru"
        ? "Нет соединения"
        : "No connection";

  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [desktopMenuPos, setDesktopMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const [desktopMenuTargetRelPath, setDesktopMenuTargetRelPath] = useState<string | null>(null);

  const [terminalInjectKey, setTerminalInjectKey] = useState(0);
  const [terminalInjectLines, setTerminalInjectLines] = useState<string[]>([]);

  const injectTerminalLines = (lines: string[]) => {
    setTerminalInjectLines(lines);
    setTerminalInjectKey((k) => k + 1);
  };

  // Window stacking / focus management (full rewrite: shared mechanics for all app windows).
  type WindowId = "terminal" | "settings" | "files" | "notes" | "scripts" | "media";
  type WindowBaseState = { id: string; minimized: boolean; z: number };
  const [activeWindowId, setActiveWindowId] = useState<WindowId>("terminal");
  const zTopRef = useRef(90);
  const makeWindowId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const nextZ = () => {
    zTopRef.current += 1;
    return zTopRef.current;
  };
  const topByZ = <T extends WindowBaseState>(windows: T[]) =>
    [...windows].sort((a, b) => b.z - a.z)[0] ?? null;
  const hasOpenWindows = <T extends WindowBaseState>(windows: T[]) => windows.some((w) => !w.minimized);
  const hasMinimizedWindows = <T extends WindowBaseState>(windows: T[]) => windows.some((w) => w.minimized);
  const focusWindowInList = <T extends WindowBaseState>(
    setState: Dispatch<SetStateAction<T[]>>,
    windowType: WindowId,
    id: string
  ) => {
    const z = nextZ();
    setState((prev) => prev.map((w) => (w.id === id ? { ...w, z, minimized: false } : w)));
    setActiveWindowId(windowType);
  };
  const restoreTopMinimizedInList = <T extends WindowBaseState>(
    windows: T[],
    setState: Dispatch<SetStateAction<T[]>>,
    windowType: WindowId
  ) => {
    const target = [...windows].filter((w) => w.minimized).sort((a, b) => b.z - a.z)[0];
    if (!target) return;
    const z = nextZ();
    setState((prev) => prev.map((w) => (w.id === target.id ? { ...w, minimized: false, z } : w)));
    setActiveWindowId(windowType);
  };

  const [terminalZ, setTerminalZ] = useState(91);
  const focusTerminal = () => {
    setTerminalZ(nextZ());
    setActiveWindowId("terminal");
  };

  type SettingsTab = "system" | "desktop" | "network" | "profile";
  type SettingsWindowState = WindowBaseState & { initialTab: SettingsTab };
  const [settingsWindows, setSettingsWindows] = useState<SettingsWindowState[]>([]);
  const openSettings = (initialTab: SettingsTab = "system") => {
    const z = nextZ();
    const id = makeWindowId();
    setSettingsWindows((prev) => [...prev, { id, initialTab, minimized: false, z }]);
    setActiveWindowId("settings");
  };
  const closeSettingsWindow = (id: string) => setSettingsWindows((prev) => prev.filter((w) => w.id !== id));
  const minimizeSettingsWindow = (id: string) =>
    setSettingsWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  const focusSettingsWindow = (id: string) => focusWindowInList(setSettingsWindows, "settings", id);
  const restoreTopSettingsWindow = () => restoreTopMinimizedInList(settingsWindows, setSettingsWindows, "settings");
  const settingsOpen = hasOpenWindows(settingsWindows);
  const settingsMinimized = hasMinimizedWindows(settingsWindows);
  const topSettingsWindow = topByZ(settingsWindows);

  type FilesWindowState = WindowBaseState & { startRelPath: string };
  const [filesWindows, setFilesWindows] = useState<FilesWindowState[]>([]);
  const openFiles = (startRelPath = "") => {
    const z = nextZ();
    const id = makeWindowId();
    setFilesWindows((prev) => [...prev, { id, startRelPath, minimized: false, z }]);
    setActiveWindowId("files");
  };
  const closeFilesWindow = (id: string) => setFilesWindows((prev) => prev.filter((w) => w.id !== id));
  const minimizeFilesWindow = (id: string) =>
    setFilesWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  const focusFilesWindow = (id: string) => focusWindowInList(setFilesWindows, "files", id);
  const restoreTopFilesWindow = () => restoreTopMinimizedInList(filesWindows, setFilesWindows, "files");
  const filesOpen = hasOpenWindows(filesWindows);
  const filesMinimized = hasMinimizedWindows(filesWindows);
  const topFilesWindow = topByZ(filesWindows);

  type NotesWindowState = WindowBaseState & { initialRelPath?: string };
  const [notesWindows, setNotesWindows] = useState<NotesWindowState[]>([]);
  const openNotes = (relPath?: string) => {
    const z = nextZ();
    const id = makeWindowId();
    setNotesWindows((prev) => [...prev, { id, initialRelPath: relPath, minimized: false, z }]);
    setActiveWindowId("notes");
  };
  const closeNotesWindow = (id: string) => setNotesWindows((prev) => prev.filter((w) => w.id !== id));
  const minimizeNotesWindow = (id: string) =>
    setNotesWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  const focusNotesWindow = (id: string) => focusWindowInList(setNotesWindows, "notes", id);
  const restoreTopNotesWindow = () => restoreTopMinimizedInList(notesWindows, setNotesWindows, "notes");
  const notesOpen = hasOpenWindows(notesWindows);
  const notesMinimized = hasMinimizedWindows(notesWindows);
  const topNotesWindow = topByZ(notesWindows);

  type ScriptsWindowState = WindowBaseState & { initialRelPath?: string };
  const [scriptsWindows, setScriptsWindows] = useState<ScriptsWindowState[]>([]);
  const openScripts = (relPath?: string) => {
    const z = nextZ();
    const id = makeWindowId();
    setScriptsWindows((prev) => [...prev, { id, initialRelPath: relPath, minimized: false, z }]);
    setActiveWindowId("scripts");
  };
  const closeScriptsWindow = (id: string) => setScriptsWindows((prev) => prev.filter((w) => w.id !== id));
  const minimizeScriptsWindow = (id: string) =>
    setScriptsWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  const focusScriptsWindow = (id: string) => focusWindowInList(setScriptsWindows, "scripts", id);
  const restoreTopScriptsWindow = () => restoreTopMinimizedInList(scriptsWindows, setScriptsWindows, "scripts");
  const scriptsOpen = hasOpenWindows(scriptsWindows);
  const scriptsMinimized = hasMinimizedWindows(scriptsWindows);
  const topScriptsWindow = topByZ(scriptsWindows);

  type MediaWindowState = WindowBaseState & { initialRelPath?: string };
  const [mediaWindows, setMediaWindows] = useState<MediaWindowState[]>([]);
  const openMedia = (relPath?: string) => {
    const z = nextZ();
    const id = makeWindowId();
    setMediaWindows((prev) => [...prev, { id, initialRelPath: relPath, minimized: false, z }]);
    setActiveWindowId("media");
  };
  const closeMediaWindow = (id: string) => setMediaWindows((prev) => prev.filter((w) => w.id !== id));
  const minimizeMediaWindow = (id: string) =>
    setMediaWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  const focusMediaWindow = (id: string) => focusWindowInList(setMediaWindows, "media", id);
  const restoreTopMediaWindow = () => restoreTopMinimizedInList(mediaWindows, setMediaWindows, "media");
  const mediaOpen = hasOpenWindows(mediaWindows);
  const mediaMinimized = hasMinimizedWindows(mediaWindows);
  const topMediaWindow = topByZ(mediaWindows);

  const [desktopItems, setDesktopItems] = useState<FsEntry[]>([]);

  // Desktop icon layout (grid wrapping into columns)
  const DESK_LEFT = 20;
  const DESK_TOP = 90;
  const DESK_RIGHT_PAD = 20;
  const DESK_BOTTOM_PAD = 12;
  const TASKBAR_H = 48;
  const CELL_W = 160; // icon width (140) + horizontal gap
  const CELL_H = 78; // icon height + vertical gap

  const [desktopIconCells, setDesktopIconCells] = useState<Record<string, { col: number; row: number }>>({});
  const desktopIconCellsRef = useRef(desktopIconCells);
  useEffect(() => {
    desktopIconCellsRef.current = desktopIconCells;
  }, [desktopIconCells]);

  const getReservedDesktopCells = () => {
    const { cols, rows } = getGrid();
    const computer = { col: 0, row: 0 };
    const trash =
      rows > 1 ? { col: 0, row: 1 } : cols > 1 ? { col: 1, row: 0 } : { col: 0, row: 0 };
    return { computer, trash };
  };

  // If user creates an item via RMB on the desktop, we try to place the newly created
  // icon near the cursor cell (Linux-like behavior).
  const [desktopCreateDesiredCell, setDesktopCreateDesiredCell] = useState<{
    col: number;
    row: number;
  } | null>(null);

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

  const getGrid = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const usableW = vw - DESK_LEFT - DESK_RIGHT_PAD;
    const usableH = vh - TASKBAR_H - DESK_TOP - DESK_BOTTOM_PAD;
    const cols = Math.max(1, Math.floor(usableW / CELL_W));
    const rows = Math.max(1, Math.floor(usableH / CELL_H));
    return { cols, rows };
  };

  const cellKey = (col: number, row: number) => `${col}:${row}`;

  const findNearestFreeCell = (
    desiredCol: number,
    desiredRow: number,
    ignoreRelPath: string | null,
    occupied: Map<string, string>
  ) => {
    const { cols, rows } = getGrid();
    const dc = Math.min(Math.max(0, desiredCol), cols - 1);
    const dr = Math.min(Math.max(0, desiredRow), rows - 1);

    let best: { col: number; row: number } | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const key = cellKey(col, row);
        const occ = occupied.get(key);
        if (occ && occ !== ignoreRelPath) continue;
        const dist = (col - dc) * (col - dc) + (row - dr) * (row - dr);
        if (dist < bestDist) {
          bestDist = dist;
          best = { col, row };
        }
      }
    }

    return best;
  };

  const [draggingRelPath, setDraggingRelPath] = useState<string | null>(null);
  const [dragPreviewPos, setDragPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const [toasts, setToasts] = useState<Array<{ id: string; message: string }>>([]);
  const addToast = (message: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  };

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

  useEffect(() => {
    if (!draggingRelPath) return;

    const onMove = (e: PointerEvent) => {
      setDragPreviewPos({
        x: e.clientX - dragOffsetRef.current.dx,
        y: e.clientY - dragOffsetRef.current.dy
      });
    };

    const onUp = (e: PointerEvent) => {
      const rel = draggingRelPath;
      const snapX = e.clientX - dragOffsetRef.current.dx;
      const snapY = e.clientY - dragOffsetRef.current.dy;

      const prev = desktopIconCellsRef.current;
      const occupied = new Map<string, string>();
      const { computer, trash } = getReservedDesktopCells();
      occupied.set(cellKey(computer.col, computer.row), "__computer__");
      occupied.set(cellKey(trash.col, trash.row), "__trash__");
      for (const [r, cell] of Object.entries(prev)) {
        occupied.set(cellKey(cell.col, cell.row), r);
      }

      const desiredCol = Math.round((snapX - DESK_LEFT) / CELL_W);
      const desiredRow = Math.round((snapY - DESK_TOP) / CELL_H);

      const best = findNearestFreeCell(desiredCol, desiredRow, rel, occupied);
      if (!best) {
        addToast(lang === "ru" ? "Нет места на рабочем столе" : "No space on the desktop");
        setDraggingRelPath(null);
        setDragPreviewPos(null);
        return;
      }

      setDesktopIconCells((p) => ({ ...p, [rel]: best }));
      setDraggingRelPath(null);
      setDragPreviewPos(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingRelPath, lang]);

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
      const { computer, trash } = getReservedDesktopCells();

      const intersects = (rx: number, ry: number, rw: number, rh: number) => {
        return !(xMax < rx || xMin > rx + rw || yMax < ry || yMin > ry + rh);
      };

      // Reserved "Computer" and "Trash" icons.
      {
        const compX = DESK_LEFT + computer.col * CELL_W;
        const compY = DESK_TOP + computer.row * CELL_H;
        if (intersects(compX, compY, CELL_W, CELL_H)) next.add("");
      }
      {
        const trashX = DESK_LEFT + trash.col * CELL_W;
        const trashY = DESK_TOP + trash.row * CELL_H;
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
      const items = await listFs("");
      // Hide internal system folders from desktop.
      const hidden = new Set(["Photos", "Videos", "Notes", "Scripts", "Trash", "Wallpapers"]);
      setDesktopItems(items.filter((i) => !hidden.has(i.name)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addToast(lang === "ru" ? `FS ошибка: ${msg}` : `FS error: ${msg}`);
      setDesktopItems([]);
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
      const n = desktopItems.length + 1;
      const name = lang === "ru" ? `Папка ${n}` : `Folder ${n}`;
      const rel = parentRelPath ? `${parentRelPath}/${name}` : name;
      await mkdirFs(rel);
      if (!parentRelPath) {
        await reloadDesktopDirs();
      }
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
      const rel = parentRelPath ? `${parentRelPath}/${base}.${ext}` : `${base}.${ext}`;
      const initial = ext === "md" ? "# Title\n\n" : "";
      await writeTextFs(rel, initial);
      addToast(lang === "ru" ? "Файл создан" : "File created");
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
      const rel = parentRelPath ? `${parentRelPath}/${base}.hack` : `${base}.hack`;
      const initial = `# HackScript example\nprint("Hello from HackScript")\n`;
      await writeTextFs(rel, initial);
      addToast(lang === "ru" ? "Скрипт создан" : "Script created");
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
      if (!relPath.includes("/")) {
        await reloadDesktopDirs();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addToast(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
    }
  };

  const clearTrash = async () => {
    await initGameFs();
    const items = await listFs("Trash");
    for (const it of items) {
      await deleteFs(it.relPath);
    }
    addToast(lang === "ru" ? "Корзина очищена" : "Trash has been emptied");
  };

  useEffect(() => {
    if (!desktopItems) return;

    const current = new Set(desktopItems.map((d) => d.relPath));
    const prev = desktopIconCellsRef.current;
    const next: Record<string, { col: number; row: number }> = { ...prev };

    let changed = false;
    for (const k of Object.keys(next)) {
      if (!current.has(k)) {
        delete next[k];
        changed = true;
      }
    }

    const { cols, rows } = getGrid();
    const reserved = getReservedDesktopCells();
    const reservedKeys = new Set([cellKey(reserved.computer.col, reserved.computer.row), cellKey(reserved.trash.col, reserved.trash.row)]);

    for (const [rel, cell] of Object.entries(next)) {
      if (reservedKeys.has(cellKey(cell.col, cell.row))) {
        delete next[rel];
        changed = true;
      }
    }

    const occupied = new Map<string, string>();
    occupied.set(cellKey(reserved.computer.col, reserved.computer.row), "__computer__");
    occupied.set(cellKey(reserved.trash.col, reserved.trash.row), "__trash__");
    for (const [rel, cell] of Object.entries(next)) {
      occupied.set(cellKey(cell.col, cell.row), rel);
    }

    let overflowCount = 0;
    let placedFromDesiredCell = false;
    for (const d of desktopItems) {
      if (next[d.relPath]) continue;
      let placed = false;

      if (desktopCreateDesiredCell && !placedFromDesiredCell) {
        const best = findNearestFreeCell(desktopCreateDesiredCell.col, desktopCreateDesiredCell.row, null, occupied);
        if (best) {
          next[d.relPath] = best;
          occupied.set(cellKey(best.col, best.row), d.relPath);
          placed = true;
          changed = true;
          placedFromDesiredCell = true;
        }
      }

      if (placed) continue;
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const key = cellKey(col, row);
          if (occupied.has(key)) continue;
          next[d.relPath] = { col, row };
          occupied.set(key, d.relPath);
          placed = true;
          changed = true;
          break;
        }
        if (placed) break;
      }
      if (!placed) overflowCount++;
    }

    if (changed) setDesktopIconCells(next);
    if (overflowCount > 0) {
      addToast(lang === "ru" ? "Нет места на рабочем столе" : "No space on the desktop");
    }

    if (placedFromDesiredCell) setDesktopCreateDesiredCell(null);
  }, [desktopItems, lang, desktopCreateDesiredCell]);

  const [startSearch, setStartSearch] = useState("");
  const [otherFolderOpen, setOtherFolderOpen] = useState(false);
  type StartGroup = "games" | "graphics" | "internet" | "office" | "science" | "sound_video" | "system";
  const [startGroup, setStartGroup] = useState<StartGroup>("system");

  useEffect(() => {
    // Disable browser default context menu inside the game UI.
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener("contextmenu", onContextMenu);

    const onDocClick = (e: MouseEvent) => {
      const el = startRef.current;
      const menuEl = desktopMenuRef.current;
      const netEl = netMenuRef.current;
      const infoEl = desktopInfoRef.current;
      const clockEl = clockMenuRef.current;
      const clockBtnEl = clockBtnRef.current;
      const target = e.target;
      const clickedOutsideStart = el ? !(target instanceof Node && el.contains(target)) : true;
      const clickedOutsideMenu = menuEl ? !(target instanceof Node && menuEl.contains(target)) : true;
      const clickedOutsideNet = netEl ? !(target instanceof Node && netEl.contains(target)) : true;
      const clickedOutsideInfo = infoEl ? !(target instanceof Node && infoEl.contains(target)) : true;
      const clickedOutsideClockMenu = clockEl ? !(target instanceof Node && clockEl.contains(target)) : true;
      const clickedOutsideClockBtn = clockBtnEl ? !(target instanceof Node && clockBtnEl.contains(target)) : true;
      const clickedOutsideClock = clickedOutsideClockMenu && clickedOutsideClockBtn;
      if (clickedOutsideStart) setStartOpen(false);
      if (clickedOutsideMenu) {
        setDesktopMenuOpen(false);
        setDesktopMenuTargetRelPath(null);
      }
      if (clickedOutsideNet) setNetMenuOpen(false);
      if (clickedOutsideInfo) setDesktopInfo(null);
      if (clickedOutsideClock) setClockMenuOpen(false);
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
  };

  const closeTerminal = () => {
    setTerminalOpen(false);
    setTerminalMinimized(false);
  };

  const openDesktopContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest(".taskbar")) return;
    if (target?.closest(".terminal-window")) return;
    if (target?.closest(".settings-window")) return;
    if (target?.closest(".start-menu-popup")) return;
    if (target?.closest(".taskbar-net-menu")) return;
    if (target?.closest(".desktop-folder-icon")) return;

    e.preventDefault();
    e.stopPropagation();
    setNetMenuOpen(false);
    setStartOpen(false);
    setDesktopMenuPos({ x: e.clientX, y: e.clientY });
    setDesktopMenuTargetRelPath(null);
    setDesktopMenuOpen(true);
  };

  const terminalTaskClick = () => {
    if (terminalOpen && !terminalMinimized && activeWindowId === "terminal") {
      minimizeTerminal();
      return;
    }
    openTerminal();
  };

  const settingsTaskClick = () => {
    if (topSettingsWindow && !topSettingsWindow.minimized && activeWindowId === "settings") {
      minimizeSettingsWindow(topSettingsWindow.id);
      return;
    }
    if (settingsWindows.length) {
      restoreTopSettingsWindow();
      return;
    }
    openSettings("system");
  };

  const filesTaskClick = () => {
    if (topFilesWindow && !topFilesWindow.minimized && activeWindowId === "files") {
      minimizeFilesWindow(topFilesWindow.id);
      return;
    }
    if (filesWindows.length) {
      restoreTopFilesWindow();
      return;
    }
    openFiles("");
  };

  const notesTaskClick = () => {
    if (topNotesWindow && !topNotesWindow.minimized && activeWindowId === "notes") {
      minimizeNotesWindow(topNotesWindow.id);
      return;
    }
    if (notesWindows.length) {
      restoreTopNotesWindow();
      return;
    }
    openNotes();
  };

  const scriptsTaskClick = () => {
    if (topScriptsWindow && !topScriptsWindow.minimized && activeWindowId === "scripts") {
      minimizeScriptsWindow(topScriptsWindow.id);
      return;
    }
    if (scriptsWindows.length) {
      restoreTopScriptsWindow();
      return;
    }
    openScripts();
  };

  const mediaTaskClick = () => {
    if (topMediaWindow && !topMediaWindow.minimized && activeWindowId === "media") {
      minimizeMediaWindow(topMediaWindow.id);
      return;
    }
    if (mediaWindows.length) {
      restoreTopMediaWindow();
      return;
    }
    openMedia();
  };

  const toggleClockPopover = (anchor: HTMLButtonElement) => {
    if (clockMenuOpen) {
      setClockMenuOpen(false);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setClockMenuPos({ x: rect.right - 320, y: rect.bottom });
    setCalendarView({ year: now.getFullYear(), month: now.getMonth() });
    setClockMenuOpen(true);
    setNetMenuOpen(false);
    setDesktopMenuOpen(false);
  };

  const runningApps: Array<{
    key: WindowId;
    shown: boolean;
    active: boolean;
    label: string;
    title: string;
    icon: ReactNode;
    onClick: () => void;
  }> = [
    {
      key: "terminal",
      shown: terminalOpen || terminalMinimized,
      active: activeWindowId === "terminal" && terminalOpen && !terminalMinimized,
      label: "Terminal",
      title: t.dockTerminal,
      icon: <TerminalIcon />,
      onClick: terminalTaskClick
    },
    {
      key: "settings",
      shown: settingsOpen || settingsMinimized,
      active: activeWindowId === "settings" && settingsOpen && !settingsMinimized,
      label: t.dockSettings,
      title: t.dockSettings,
      icon: <GearIcon size={18} />,
      onClick: settingsTaskClick
    },
    {
      key: "files",
      shown: filesOpen || filesMinimized,
      active: activeWindowId === "files" && filesOpen && !filesMinimized,
      label: lang === "ru" ? "Файлы" : "Files",
      title: lang === "ru" ? "Файлы" : "Files",
      icon: <FilesIcon />,
      onClick: filesTaskClick
    },
    {
      key: "notes",
      shown: notesOpen || notesMinimized,
      active: activeWindowId === "notes" && notesOpen && !notesMinimized,
      label: lang === "ru" ? "Заметки" : "Notes",
      title: lang === "ru" ? "Заметки" : "Notes",
      icon: <NoteIcon />,
      onClick: notesTaskClick
    },
    {
      key: "scripts",
      shown: scriptsOpen || scriptsMinimized,
      active: activeWindowId === "scripts" && scriptsOpen && !scriptsMinimized,
      label: lang === "ru" ? "Скрипты" : "Scripts",
      title: lang === "ru" ? "Скрипты" : "Scripts",
      icon: <CodeIcon />,
      onClick: scriptsTaskClick
    },
    {
      key: "media",
      shown: mediaOpen || mediaMinimized,
      active: activeWindowId === "media" && mediaOpen && !mediaMinimized,
      label: lang === "ru" ? "Медиа" : "Media",
      title: lang === "ru" ? "Медиа" : "Media",
      icon: <MediaIcon />,
      onClick: mediaTaskClick
    }
  ];

  return (
    <div
      className="game-ui relative min-h-screen text-slate-100"
      onContextMenu={openDesktopContextMenu}
      style={{
        background: desktopBackground
      }}
    >
      {/* Desktop taskbar */}
      <div className="taskbar">
        <div className="taskbar-left">
          <div className="relative" ref={startRef}>
            <button
              type="button"
              onClick={() => setStartOpen((v) => !v)}
              className="linux-start-button taskbar-start"
              aria-label={lang === "ru" ? "Открыть меню" : "Open menu"}
              title={lang === "ru" ? "Меню" : "Menu"}
            >
              <StartOrbIcon size={18} />
            </button>
            {startOpen ? (
              <div className="start-menu-popup" role="menu" aria-label="start menu">
                <div className="start-menu-left">
                  <div className="start-menu-left-title">{lang === "ru" ? "Приложения" : "Applications"}</div>

                  <div className="start-menu-left-list" role="presentation">
                    <div
                      className="start-menu-left-item is-clickable"
                      role="menuitem"
                      onClick={() => {
                        setStartGroup("games");
                      }}
                    >
                      <span className="start-menu-left-item-ico" aria-hidden="true">＋</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Игры" : "Games"}</span>
                    </div>
                    <div
                      className="start-menu-left-item is-clickable"
                      role="menuitem"
                      onClick={() => {
                        setStartGroup("graphics");
                      }}
                    >
                      <span className="start-menu-left-item-ico" aria-hidden="true">⬚</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Графика" : "Graphics"}</span>
                    </div>
                    <div
                      className="start-menu-left-item is-clickable"
                      role="menuitem"
                      onClick={() => {
                        setStartGroup("internet");
                      }}
                    >
                      <span className="start-menu-left-item-ico" aria-hidden="true">⟐</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Интернет" : "Internet"}</span>
                    </div>
                    <div
                      className="start-menu-left-item is-clickable"
                      role="menuitem"
                      onClick={() => {
                        setStartGroup("office");
                      }}
                    >
                      <span className="start-menu-left-item-ico" aria-hidden="true">▦</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Офис" : "Office"}</span>
                    </div>

                    <div
                      className={`start-menu-left-item is-clickable ${otherFolderOpen ? "is-active" : ""}`}
                      role="menuitem"
                      onClick={() => setOtherFolderOpen((v) => !v)}
                    >
                      <span className="start-menu-left-item-ico" aria-hidden="true">
                        <FolderIcon />
                      </span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Разное" : "Sundry"}</span>
                      <span className="start-menu-left-arrow" aria-hidden="true">
                        {otherFolderOpen ? "▾" : "▸"}
                      </span>
                    </div>
                    {otherFolderOpen ? (
                      <div className="start-menu-folder-sublist" role="presentation">
                        <div
                          className="start-menu-subitem is-clickable"
                          role="menuitem"
                          onClick={() => {
                            setStartOpen(false);
                            openTerminal();
                          }}
                        >
                          <span className="start-menu-subitem-ico" aria-hidden="true">
                            <TerminalIcon />
                          </span>
                          <span className="start-menu-subitem-text">{t.dockTerminal}</span>
                        </div>
                        <div
                          className="start-menu-subitem is-clickable"
                          role="menuitem"
                          onClick={() => {
                            setStartOpen(false);
                            openSettings();
                          }}
                        >
                          <span className="start-menu-subitem-ico" aria-hidden="true">
                            <GearIcon size={16} />
                          </span>
                          <span className="start-menu-subitem-text">{t.dockSettings}</span>
                        </div>

                        <div
                          className="start-menu-subitem is-clickable"
                          role="menuitem"
                          onClick={() => {
                            setStartOpen(false);
                            openFiles("");
                          }}
                        >
                          <span className="start-menu-subitem-ico" aria-hidden="true">
                            <FilesIcon />
                          </span>
                          <span className="start-menu-subitem-text">{t.dockFiles}</span>
                        </div>

                        <div
                          className="start-menu-subitem is-clickable"
                          role="menuitem"
                          onClick={() => {
                            setStartOpen(false);
                            openFiles("");
                          }}
                        >
                          <span className="start-menu-subitem-ico" aria-hidden="true">
                            <HomeIcon />
                          </span>
                          <span className="start-menu-subitem-text">{lang === "ru" ? "Компьютер" : "Computer"}</span>
                        </div>

                        <div
                          className="start-menu-subitem is-clickable"
                          role="menuitem"
                          onClick={() => {
                            setStartOpen(false);
                            openFiles("Trash");
                          }}
                        >
                          <span className="start-menu-subitem-ico" aria-hidden="true">
                            <span style={{ fontSize: 16, opacity: 0.95 }}>🗑</span>
                          </span>
                          <span className="start-menu-subitem-text">{lang === "ru" ? "Корзина" : "Trash"}</span>
                        </div>

                        <div
                          className="start-menu-subitem is-clickable"
                          role="menuitem"
                          onClick={() => {
                            setStartOpen(false);
                            openNotes();
                          }}
                        >
                          <span className="start-menu-subitem-ico" aria-hidden="true">
                            <NoteIcon />
                          </span>
                          <span className="start-menu-subitem-text">{lang === "ru" ? "Заметки" : "Notes"}</span>
                        </div>

                        <div
                          className="start-menu-subitem is-clickable"
                          role="menuitem"
                          onClick={() => {
                            setStartOpen(false);
                            openScripts();
                          }}
                        >
                          <span className="start-menu-subitem-ico" aria-hidden="true">
                            <CodeIcon />
                          </span>
                          <span className="start-menu-subitem-text">{lang === "ru" ? "Скрипты" : "Scripts"}</span>
                        </div>

                        <div
                          className="start-menu-subitem is-clickable"
                          role="menuitem"
                          onClick={() => {
                            setStartOpen(false);
                            openMedia();
                          }}
                        >
                          <span className="start-menu-subitem-ico" aria-hidden="true">
                            <MediaIcon />
                          </span>
                          <span className="start-menu-subitem-text">{lang === "ru" ? "Фото и видео" : "Media"}</span>
                        </div>
                      </div>
                    ) : null}

                    <div
                      className="start-menu-left-item is-clickable"
                      role="menuitem"
                      onClick={() => {
                        setStartOpen(false);
                        openScripts();
                      }}
                    >
                      <span className="start-menu-left-item-ico" aria-hidden="true">{lang === "ru" ? "⌘" : "⌘"}</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Программирование" : "Programming"}</span>
                    </div>
                    <div
                      className="start-menu-left-item is-clickable"
                      role="menuitem"
                      onClick={() => {
                        setStartGroup("science");
                      }}
                    >
                      <span className="start-menu-left-item-ico" aria-hidden="true">⚗</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Наука" : "Science"}</span>
                    </div>
                    <div
                      className="start-menu-left-item is-clickable"
                      role="menuitem"
                      onClick={() => {
                        setStartGroup("sound_video");
                      }}
                    >
                      <span className="start-menu-left-item-ico" aria-hidden="true">▶</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Звук и видео" : "Sound & Video"}</span>
                    </div>
                    <div
                      className="start-menu-left-item is-clickable"
                      role="menuitem"
                      onClick={() => {
                        setStartOpen(false);
                        openFiles("");
                      }}
                    >
                      <span className="start-menu-left-item-ico" aria-hidden="true">◷</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Другое" : "Other"}</span>
                    </div>
                    <div
                      className="start-menu-left-item is-clickable"
                      role="menuitem"
                      onClick={() => {
                        setStartGroup("system");
                      }}
                    >
                      <span className="start-menu-left-item-ico" aria-hidden="true">⚙</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Системные утилиты" : "System Tools"}</span>
                    </div>
                    <div
                      className="start-menu-left-item is-clickable"
                      role="menuitem"
                      onClick={() => {
                        setStartOpen(false);
                        openSettings("system");
                      }}
                    >
                      <span className="start-menu-left-item-ico" aria-hidden="true">🖼</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Обои" : "Wallpapers"}</span>
                    </div>
                  </div>
                </div>

                <div className="start-menu-right">
                  <div className="start-menu-user">
                    <div className="start-menu-avatar" aria-hidden="true">
                      {user?.username?.slice(0, 1).toUpperCase() ?? "U"}
                    </div>
                    <div className="start-menu-username">{user?.username ?? "user"}</div>
                  </div>

                  {startSearch.trim() ? (
                    <div className="start-menu-search-results" role="presentation">
                      {(() => {
                        const q = startSearch.trim().toLowerCase();
                        const apps = [
                          { key: "terminal", label: t.dockTerminal, icon: <TerminalIcon />, action: openTerminal },
                          { key: "settings", label: t.dockSettings, icon: <GearIcon size={16} />, action: openSettings },
                          {
                            key: "appearance",
                            label: lang === "ru" ? "Обои" : "Wallpapers",
                            icon: <GearIcon size={16} />,
                            action: () => openSettings("desktop")
                          },
                          { key: "files", label: t.dockFiles, icon: <FilesIcon />, action: () => openFiles("") },
                          { key: "notes", label: lang === "ru" ? "Заметки" : "Notes", icon: <NoteIcon />, action: () => openNotes() },
                          { key: "scripts", label: lang === "ru" ? "Скрипты" : "Scripts", icon: <CodeIcon />, action: () => openScripts() },
                          { key: "media", label: lang === "ru" ? "Фото и видео" : "Media", icon: <MediaIcon />, action: () => openMedia() }
                        ];
                        const filtered = apps.filter((a) => a.label.toLowerCase().includes(q));
                        if (!filtered.length) {
                          return (
                            <div className="start-menu-search-empty">
                              {lang === "ru" ? "Ничего не найдено" : "No results"}
                            </div>
                          );
                        }
                        return filtered.map((a) => (
                          <div
                            key={a.key}
                            className="start-menu-search-result is-clickable"
                            role="menuitem"
                            onClick={() => {
                              setStartOpen(false);
                              a.action();
                            }}
                          >
                            <span className="start-menu-search-result-ico" aria-hidden="true">
                              {a.icon}
                            </span>
                            <span className="start-menu-search-result-text">{a.label}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <div className="start-menu-places">
                      {(() => {
                        const groupLabel: Record<StartGroup, string> = {
                          games: lang === "ru" ? "Игры" : "Games",
                          graphics: lang === "ru" ? "Графика" : "Graphics",
                          internet: lang === "ru" ? "Интернет" : "Internet",
                          office: lang === "ru" ? "Офис" : "Office",
                          science: lang === "ru" ? "Наука" : "Science",
                          sound_video: lang === "ru" ? "Звук и видео" : "Sound & Video",
                          system: lang === "ru" ? "Системные утилиты" : "System tools"
                        };
                        const rowsByGroup: Record<
                          StartGroup,
                          Array<{ icon: ReactNode; label: string; action: () => void }>
                        > = {
                          games: [
                            { icon: <CodeIcon />, label: lang === "ru" ? "HackScript Arena" : "HackScript Arena", action: () => openScripts() },
                            { icon: <TerminalIcon />, label: lang === "ru" ? "CTF Терминал" : "CTF Terminal", action: () => openTerminal() }
                          ],
                          graphics: [
                            { icon: <ImageIcon />, label: lang === "ru" ? "Просмотр изображений" : "Image viewer", action: () => openMedia() },
                            { icon: <VideoIcon />, label: lang === "ru" ? "Видео-плеер" : "Video player", action: () => openMedia() }
                          ],
                          internet: [
                            { icon: <TerminalIcon />, label: lang === "ru" ? "Сетевой терминал" : "Network terminal", action: () => openTerminal() },
                            { icon: <GearIcon size={16} />, label: lang === "ru" ? "Параметры сети" : "Network settings", action: () => openSettings("network") }
                          ],
                          office: [
                            { icon: <NoteIcon />, label: lang === "ru" ? "Заметки" : "Notes", action: () => openNotes() },
                            { icon: <FilesIcon />, label: lang === "ru" ? "Файловый менеджер" : "File manager", action: () => openFiles("") }
                          ],
                          science: [
                            { icon: <NoteIcon />, label: lang === "ru" ? "Лабораторный журнал" : "Lab notes", action: () => openNotes() },
                            { icon: <CodeIcon />, label: lang === "ru" ? "Скриптовая лаборатория" : "Script lab", action: () => openScripts() }
                          ],
                          sound_video: [
                            { icon: <MusicIcon />, label: lang === "ru" ? "Музыка" : "Music", action: () => openMedia() },
                            { icon: <VideoIcon />, label: lang === "ru" ? "Видео" : "Video", action: () => openMedia() }
                          ],
                          system: [
                            { icon: <GearIcon size={16} />, label: t.dockSettings, action: () => openSettings("system") },
                            { icon: <GearIcon size={16} />, label: lang === "ru" ? "Рабочий стол" : "Desktop", action: () => openSettings("desktop") },
                            { icon: <FilesIcon />, label: lang === "ru" ? "Компьютер" : "Computer", action: () => openFiles("") }
                          ]
                        };
                        const rows = rowsByGroup[startGroup];
                        return (
                          <>
                            <div className="start-menu-search-empty">{groupLabel[startGroup]}</div>
                            {rows.map((row) => (
                              <div
                                key={row.label}
                                className="start-menu-place"
                                role="menuitem"
                                onClick={() => {
                                  setStartOpen(false);
                                  row.action();
                                }}
                              >
                                <span className="start-menu-place-ico" aria-hidden="true">
                                  {row.icon}
                                </span>
                                <span className="start-menu-place-text">{row.label}</span>
                              </div>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  )}
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

        <div className="taskbar-center">
          <div className="taskbar-apps">
            {runningApps.filter((a) => a.shown).map((app) => (
              <button
                key={app.key}
                type="button"
                onClick={app.onClick}
                className={`taskbar-app ${app.active ? "taskbar-app--active" : ""}`}
                aria-label={app.label}
                title={app.title}
              >
                {app.icon}
              </button>
            ))}
          </div>
        </div>

        <div className="taskbar-right">
          <div className="taskbar-right-icons">
            <button
              type="button"
              className={`taskbar-app taskbar-net-btn ${
                netIsConnected ? "taskbar-net-btn--ok" : netIsConnecting ? "taskbar-net-btn--connecting" : "taskbar-net-btn--bad"
              }`}
              onClick={() => setNetMenuOpen((v) => !v)}
              aria-label={lang === "ru" ? "Интернет" : "Network"}
              title={lang === "ru" ? "Сеть" : "Network"}
            >
              <WifiIcon ok={netIsConnected} />
            </button>

            <button
              type="button"
              className="taskbar-app"
              onClick={() => {
                setNetMenuOpen(false);
                openSettings();
              }}
              aria-label={t.dockSettings}
              title={t.dockSettings}
            >
              <GearIcon size={18} />
            </button>

            {/* Exit/Logout buttons removed (handled via system UI), see Start menu / dialogs. */}
          </div>

          <button
            ref={clockBtnRef}
            type="button"
            className="taskbar-clock"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleClockPopover(e.currentTarget as HTMLButtonElement);
            }}
            aria-label={lang === "ru" ? "Часы" : "Clock"}
            title={lang === "ru" ? "Системное время" : "System time"}
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
                left: Math.max(8, Math.min(clockMenuPos.x, window.innerWidth - 320)),
                top: Math.min(clockMenuPos.y, window.innerHeight - 380)
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
                const first = new Date(year, month, 1);
                const startOffset = (first.getDay() + 6) % 7; // Monday first
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                const today = now;
                const todayDay = today.getDate();
                const todayMonth = today.getMonth();
                const todayYear = today.getFullYear();

                const cells = Array.from({ length: 42 }, (_, idx) => {
                  const dayNum = idx - startOffset + 1;
                  if (dayNum < 1 || dayNum > daysInMonth) return null;
                  const isToday = todayYear === year && todayMonth === month && dayNum === todayDay;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`clock-day ${isToday ? "clock-day--today" : ""}`}
                      onClick={() => {
                        // We don't need persistence, but clicking should feel interactive.
                        setCalendarView((v) => ({ ...v }));
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
                      <span className="clock-time">{clockText}</span>
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

          {netMenuOpen ? (
            <div
              ref={netMenuRef}
              className="taskbar-net-menu"
              role="menu"
              aria-label={lang === "ru" ? "Меню сети" : "Network menu"}
            >
              <div className="taskbar-net-menu-header">
                <span className="taskbar-net-menu-title">{lang === "ru" ? "Сеть" : "Network"}</span>
                <span className={`taskbar-net-menu-pill ${netIsConnected ? "is-ok" : netIsConnecting ? "is-warn" : "is-bad"}`}>
                  {netStatusText}
                </span>
              </div>

              <div className="taskbar-net-menu-url" title={wsUrl}>
                {wsUrl}
              </div>

              <div className="taskbar-net-menu-actions">
                <button
                  type="button"
                  className="taskbar-net-menu-item"
                  onClick={() => addToast(netIsConnected ? (lang === "ru" ? "Соединение активно" : "Connection active") : netStatusText)}
                  role="menuitem"
                >
                  {lang === "ru" ? "Проверить" : "Check"}
                </button>

                <button
                  type="button"
                  className="taskbar-net-menu-item"
                  onClick={() => {
                    setNetMenuOpen(false);
                    addToast(lang === "ru" ? "Переподключение..." : "Reconnecting...");
                    window.setTimeout(() => window.location.reload(), 250);
                  }}
                  role="menuitem"
                >
                  {lang === "ru" ? "Переподключить" : "Reconnect"}
                </button>

                <button
                  type="button"
                  className="taskbar-net-menu-item"
                  onClick={() => {
                    setNetMenuOpen(false);
                    openTerminal();
                  }}
                  role="menuitem"
                >
                  {lang === "ru" ? "Открыть терминал" : "Open terminal"}
                </button>

                <button
                  type="button"
                  className="taskbar-net-menu-item"
                  onClick={() => {
                    setNetMenuOpen(false);
                    openSettings();
                  }}
                  role="menuitem"
                >
                  {lang === "ru" ? "Параметры" : "Settings"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

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
          {desktopMenuTargetRelPath !== null ? (
            <>
              <div
                className="desktop-ctx-item"
                role="menuitem"
                onClick={() => {
                  const rel = desktopMenuTargetRelPath;
                  if (rel === null) return;
                  const entry = desktopItems.find((d) => d.relPath === rel) ?? null;
                  setDesktopMenuOpen(false);
                  setDesktopMenuTargetRelPath(null);

                  if (rel === "") {
                    openFiles("");
                    return;
                  }
                  if (!entry && rel === "Trash") {
                    openFiles("Trash");
                    return;
                  }
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
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true">▶</span>
                <span>{lang === "ru" ? "Открыть" : "Open"}</span>
              </div>
              <div
                className="desktop-ctx-item"
                role="menuitem"
                onClick={() => {
                  const rel = desktopMenuTargetRelPath;
                  if (rel === null) return;
                  const entry = desktopItems.find((d) => d.relPath === rel) ?? null;
                  const parentDir =
                    entry?.kind === "file"
                      ? entry.relPath.split("/").filter(Boolean).slice(0, -1).join("/")
                      : rel;

                  setDesktopMenuOpen(false);
                  setDesktopMenuTargetRelPath(null);
                  void createDesktopFolder(parentDir);
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true"><span style={{ fontSize: 16, opacity: 0.95 }}>＋</span></span>
                <span>{lang === "ru" ? "Создать папку" : "New folder"}</span>
              </div>
              <div
                className="desktop-ctx-item"
                role="menuitem"
                onClick={() => {
                  const rel = desktopMenuTargetRelPath;
                  if (rel === null) return;
                  const entry = desktopItems.find((d) => d.relPath === rel) ?? null;
                  const parentDir =
                    entry?.kind === "file"
                      ? entry.relPath.split("/").filter(Boolean).slice(0, -1).join("/")
                      : rel;

                  setDesktopMenuOpen(false);
                  setDesktopMenuTargetRelPath(null);
                  void createTextFileAt(parentDir, "txt");
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true">●</span>
                <span>{lang === "ru" ? "Создать текстовый файл" : "New text file"}</span>
              </div>
              <div
                className="desktop-ctx-item"
                role="menuitem"
                onClick={() => {
                  const rel = desktopMenuTargetRelPath;
                  if (rel === null) return;
                  const entry = desktopItems.find((d) => d.relPath === rel) ?? null;
                  const parentDir =
                    entry?.kind === "file"
                      ? entry.relPath.split("/").filter(Boolean).slice(0, -1).join("/")
                      : rel;

                  setDesktopMenuOpen(false);
                  setDesktopMenuTargetRelPath(null);
                  void createHackFileAt(parentDir);
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true">⌁</span>
                <span>{lang === "ru" ? "Создать HackScript" : "New HackScript"}</span>
              </div>
              <div
                className="desktop-ctx-item"
                role="menuitem"
                onClick={() => {
                  const rel = desktopMenuTargetRelPath;
                  if (!rel || rel === "Trash") return;
                  setDesktopMenuOpen(false);
                  setDesktopMenuTargetRelPath(null);
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
                    if (!parent) await reloadDesktopDirs();
                  })().catch((e) => {
                    const msg = e instanceof Error ? e.message : String(e);
                    addToast(lang === "ru" ? `Ошибка переименования: ${msg}` : `Rename failed: ${msg}`);
                  });
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true">✎</span>
                <span>{lang === "ru" ? "Переименовать" : "Rename"}</span>
              </div>
              {desktopMenuTargetRelPath === "Trash" ? (
                <div
                  className="desktop-ctx-item"
                  role="menuitem"
                  onClick={() => {
                    setDesktopMenuOpen(false);
                    setDesktopMenuTargetRelPath(null);
                    void (async () => {
                      const ok = await confirmAsync(
                        lang === "ru" ? "Очистить корзину?" : "Empty trash?"
                      );
                      if (!ok) return;
                      await clearTrash();
                    })().catch((e) => {
                      const msg = e instanceof Error ? e.message : String(e);
                      addToast(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
                    });
                  }}
                >
                  <span className="desktop-ctx-ico" aria-hidden="true">🧹</span>
                  <span>{lang === "ru" ? "Очистить корзину" : "Empty Trash"}</span>
                </div>
              ) : (
                <div
                  className="desktop-ctx-item"
                  role="menuitem"
                  onClick={() => {
                    const rel = desktopMenuTargetRelPath;
                    if (!rel) return;
                    setDesktopMenuOpen(false);
                    setDesktopMenuTargetRelPath(null);
                    void (async () => {
                      const ok = await confirmAsync(lang === "ru" ? `Удалить «${rel}»?` : `Delete «${rel}»?`);
                      if (!ok) return;
                      await moveEntryToTrash(rel);
                    })().catch((e) => {
                      const msg = e instanceof Error ? e.message : String(e);
                      addToast(lang === "ru" ? `Ошибка удаления: ${msg}` : `Delete failed: ${msg}`);
                    });
                  }}
                >
                  <span className="desktop-ctx-ico" aria-hidden="true">🗑</span>
                  <span>{lang === "ru" ? "Удалить" : "Delete"}</span>
                </div>
              )}
              <div
                className="desktop-ctx-item"
                role="menuitem"
                onClick={() => {
                  const rel = desktopMenuTargetRelPath;
                  if (rel === null) return;
                  const entry = desktopItems.find((d) => d.relPath === rel) ?? null;
                  const pathText = rel === "" ? "/" : rel;
                  const lines = [
                    lang === "ru" ? `Путь: ${pathText}` : `Path: ${pathText}`
                  ];
                  if (entry) {
                    lines.push(
                      lang === "ru"
                        ? `Тип: ${entry.kind === "dir" ? "Папка" : "Файл"}${entry.ext ? `.${entry.ext}` : ""}`
                        : `Type: ${entry.kind === "dir" ? "Folder" : "File"}${entry.ext ? `.${entry.ext}` : ""}`
                    );
                    lines.push(lang === "ru" ? `Размер: ${entry.size} байт` : `Size: ${entry.size} bytes`);
                  } else if (rel === "Trash") {
                    lines.push(lang === "ru" ? "Тип: Корзина" : "Type: Trash");
                  }

                  setDesktopMenuOpen(false);
                  setDesktopMenuTargetRelPath(null);
                  setDesktopInfo({
                    pos: desktopMenuPos,
                    title: lang === "ru" ? "Свойства" : "Properties",
                    lines
                  });
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true">ℹ</span>
                <span>{lang === "ru" ? "Свойства" : "Properties"}</span>
              </div>
            </>
          ) : (
            <>
              <div
                className="desktop-ctx-item"
                role="menuitem"
                onClick={() => {
                  setDesktopMenuOpen(false);
                  setDesktopMenuTargetRelPath(null);
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
                  setDesktopMenuTargetRelPath(null);
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
                  setDesktopMenuTargetRelPath(null);
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
                  setDesktopMenuTargetRelPath(null);
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
        className="desktop-icons-layer"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if (draggingRelPath) return;
          const target = e.target as HTMLElement | null;
          if (target?.closest(".desktop-folder-icon")) return;

          setDesktopMenuOpen(false);
          setNetMenuOpen(false);
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
          const { computer, trash } = getReservedDesktopCells();
          const computerLeft = DESK_LEFT + computer.col * CELL_W;
          const computerTop = DESK_TOP + computer.row * CELL_H;
          const trashLeft = DESK_LEFT + trash.col * CELL_W;
          const trashTop = DESK_TOP + trash.row * CELL_H;

          return (
            <>
              <div
                className={`desktop-folder-icon ${
                  desktopSelectedRelPaths.has("") ? "desktop-folder-icon--selected" : ""
                }`}
                style={{ left: computerLeft, top: computerTop, zIndex: 10 }}
                onDoubleClick={() => openFiles("")}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDesktopMenuTargetRelPath("");
                  setDesktopMenuPos({ x: e.clientX, y: e.clientY });
                  setDesktopMenuOpen(true);
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setDesktopSelectedRelPaths((prev) => {
                    const next = new Set(prev);
                    if (e.ctrlKey) {
                      if (next.has("")) next.delete("");
                      else next.add("");
                    } else {
                      next.clear();
                      next.add("");
                    }
                    return next;
                  });
                }}
              >
                <span className="desktop-folder-ico" aria-hidden="true">
                  <span style={{ fontSize: 18, opacity: 0.95 }}>💻</span>
                </span>
                <span className="desktop-folder-name">{lang === "ru" ? "Компьютер" : "Computer"}</span>
              </div>
              <div
                className={`desktop-folder-icon ${
                  desktopSelectedRelPaths.has("Trash") ? "desktop-folder-icon--selected" : ""
                }`}
                style={{ left: trashLeft, top: trashTop, zIndex: 10 }}
                onDoubleClick={() => openFiles("Trash")}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDesktopMenuTargetRelPath("Trash");
                  setDesktopMenuPos({ x: e.clientX, y: e.clientY });
                  setDesktopMenuOpen(true);
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setDesktopSelectedRelPaths((prev) => {
                    const next = new Set(prev);
                    if (e.ctrlKey) {
                      if (next.has("Trash")) next.delete("Trash");
                      else next.add("Trash");
                    } else {
                      next.clear();
                      next.add("Trash");
                    }
                    return next;
                  });
                }}
              >
                <span className="desktop-folder-ico" aria-hidden="true">
                  <span style={{ fontSize: 18, opacity: 0.95 }}>🗑</span>
                </span>
                <span className="desktop-folder-name">{lang === "ru" ? "Корзина" : "Trash"}</span>
              </div>
            </>
          );
        })()}
        {desktopItems.map((f) => {
          const cell = desktopIconCells[ f.relPath ];
          if (!cell) return null;
          const isDragging = draggingRelPath === f.relPath && dragPreviewPos;
          const left = isDragging ? dragPreviewPos!.x : DESK_LEFT + cell.col * CELL_W;
          const top = isDragging ? dragPreviewPos!.y : DESK_TOP + cell.row * CELL_H;

          return (
            <div
              key={f.relPath}
              className={`desktop-folder-icon ${
                desktopSelectedRelPaths.has(f.relPath) ? "desktop-folder-icon--selected" : ""
              }`}
              style={{
                left,
                top,
                zIndex: isDragging ? 120 : 10
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDesktopMenuTargetRelPath(f.relPath);
                setDesktopMenuPos({ x: e.clientX, y: e.clientY });
                setDesktopMenuOpen(true);
                setStartOpen(false);
                setNetMenuOpen(false);
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
                } else if (["png", "jpg", "jpeg", "webp", "gif", "mp4", "webm", "ogg"].some((x) => ext.endsWith(x))) {
                  openMedia(f.relPath);
                } else {
                  const parent = f.relPath.split("/").filter(Boolean).slice(0, -1).join("/");
                  openFiles(parent);
                }
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;

                // Selection (Linux-like): click selects; Ctrl toggles.
                setDesktopSelectedRelPaths((prev) => {
                  const next = new Set(prev);
                  if (e.ctrlKey) {
                    if (next.has(f.relPath)) next.delete(f.relPath);
                    else next.add(f.relPath);
                  } else {
                    next.clear();
                    next.add(f.relPath);
                  }
                  return next;
                });

                const c = desktopIconCellsRef.current[f.relPath];
                if (!c) return;
                const startLeft = DESK_LEFT + c.col * CELL_W;
                const startTop = DESK_TOP + c.row * CELL_H;
                dragOffsetRef.current = { dx: e.clientX - startLeft, dy: e.clientY - startTop };
                setDraggingRelPath(f.relPath);
                setDragPreviewPos({ x: startLeft, y: startTop });
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <span className="desktop-folder-ico" aria-hidden="true">
                {f.kind === "dir" ? (
                  <FolderIcon />
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
          onRunInTerminal={(scriptRelPath) => {
            openTerminal();
            window.dispatchEvent(
              new CustomEvent("zeroday:terminal-run", {
                detail: { cmd: `hackrun ${scriptRelPath}` }
              })
            );
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
  );
}
