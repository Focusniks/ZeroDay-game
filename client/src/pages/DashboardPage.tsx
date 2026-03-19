import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../hooks/useI18n";
import { TerminalApp } from "../components/terminal/TerminalApp";
import { useNavigate } from "react-router-dom";
import { SettingsApp } from "../components/settings/SettingsApp";
import { initGameFs, listFs, mkdirFs, type FsEntry } from "../lib/gameFs";
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

  const [terminalInjectKey, setTerminalInjectKey] = useState(0);
  const [terminalInjectLines, setTerminalInjectLines] = useState<string[]>([]);

  const injectTerminalLines = (lines: string[]) => {
    setTerminalInjectLines(lines);
    setTerminalInjectKey((k) => k + 1);
  };

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMinimized, setSettingsMinimized] = useState(false);

  const closeSettings = () => {
    setSettingsOpen(false);
    setSettingsMinimized(false);
  };
  const openSettings = () => {
    setSettingsOpen(true);
    setSettingsMinimized(false);
  };
  const minimizeSettings = () => {
    setSettingsMinimized(true);
    setSettingsOpen(false);
  };

  const [filesOpen, setFilesOpen] = useState(false);
  const [filesMinimized, setFilesMinimized] = useState(false);
  const closeFiles = () => {
    setFilesOpen(false);
    setFilesMinimized(false);
  };
  const openFiles = (startRelPath = "") => {
    setFilesOpen(true);
    setFilesMinimized(false);
    setFilesStartRelPath(startRelPath);
  };
  const [filesStartRelPath, setFilesStartRelPath] = useState("");
  const minimizeFiles = () => {
    setFilesMinimized(true);
    setFilesOpen(false);
  };

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesMinimized, setNotesMinimized] = useState(false);
  const [notesInitialRelPath, setNotesInitialRelPath] = useState<string | undefined>(undefined);
  const closeNotes = () => {
    setNotesOpen(false);
    setNotesMinimized(false);
  };
  const openNotes = (relPath?: string) => {
    setNotesInitialRelPath(relPath);
    setNotesOpen(true);
    setNotesMinimized(false);
  };
  const minimizeNotes = () => {
    setNotesMinimized(true);
    setNotesOpen(false);
  };

  const [scriptsOpen, setScriptsOpen] = useState(false);
  const [scriptsMinimized, setScriptsMinimized] = useState(false);
  const [scriptsInitialRelPath, setScriptsInitialRelPath] = useState<string | undefined>(undefined);
  const closeScripts = () => {
    setScriptsOpen(false);
    setScriptsMinimized(false);
  };
  const openScripts = (relPath?: string) => {
    setScriptsInitialRelPath(relPath);
    setScriptsOpen(true);
    setScriptsMinimized(false);
  };
  const minimizeScripts = () => {
    setScriptsMinimized(true);
    setScriptsOpen(false);
  };

  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaMinimized, setMediaMinimized] = useState(false);
  const [mediaInitialRelPath, setMediaInitialRelPath] = useState<string | undefined>(undefined);
  const closeMedia = () => {
    setMediaOpen(false);
    setMediaMinimized(false);
  };
  const openMedia = (relPath?: string) => {
    setMediaInitialRelPath(relPath);
    setMediaOpen(true);
    setMediaMinimized(false);
  };
  const minimizeMedia = () => {
    setMediaMinimized(true);
    setMediaOpen(false);
  };

  const [desktopDirs, setDesktopDirs] = useState<FsEntry[]>([]);

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

  const reloadDesktopDirs = async () => {
    try {
      await initGameFs();
      const items = await listFs("");
      // Hide internal system folders from desktop.
      const hidden = new Set(["Photos", "Videos", "Notes", "Scripts"]);
      setDesktopDirs(items.filter((i) => i.kind === "dir" && !hidden.has(i.name)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addToast(lang === "ru" ? `FS ошибка: ${msg}` : `FS error: ${msg}`);
      setDesktopDirs([]);
    }
  };

  useEffect(() => {
    void reloadDesktopDirs();
    // We don't want to block rendering on language changes;
    // directory names are mostly user-created and don't depend on `lang`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createDesktopFolder = async () => {
    try {
      const n = desktopDirs.length + 1;
      const name = lang === "ru" ? `Папка ${n}` : `Folder ${n}`;
      // Direct child of filesystem root.
      await mkdirFs(name);
      await reloadDesktopDirs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addToast(lang === "ru" ? `Не удалось создать папку: ${msg}` : `Failed to create folder: ${msg}`);
    }
  };

  useEffect(() => {
    if (!desktopDirs) return;

    const current = new Set(desktopDirs.map((d) => d.relPath));
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
    const occupied = new Map<string, string>();
    for (const [rel, cell] of Object.entries(next)) {
      occupied.set(cellKey(cell.col, cell.row), rel);
    }

    let overflowCount = 0;
    for (const d of desktopDirs) {
      if (next[d.relPath]) continue;
      let placed = false;
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
  }, [desktopDirs, lang]);

  const [startSearch, setStartSearch] = useState("");
  const [otherFolderOpen, setOtherFolderOpen] = useState(false);

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
      const target = e.target;
      const clickedOutsideStart = el ? !(target instanceof Node && el.contains(target)) : true;
      const clickedOutsideMenu = menuEl ? !(target instanceof Node && menuEl.contains(target)) : true;
      const clickedOutsideNet = netEl ? !(target instanceof Node && netEl.contains(target)) : true;
      if (clickedOutsideStart) setStartOpen(false);
      if (clickedOutsideMenu) setDesktopMenuOpen(false);
      if (clickedOutsideNet) setNetMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, []);

  const exitGame = () => {
    setStartOpen(false);
    navigate("/login");
  };

  const exitAccount = () => {
    setStartOpen(false);
    logout();
    navigate("/login");
  };

  const openTerminal = () => {
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
    setDesktopMenuOpen(true);
  };

  const terminalTaskClick = () => {
    if (terminalOpen && !terminalMinimized) {
      minimizeTerminal();
      return;
    }
    openTerminal();
  };

  const settingsTaskClick = () => {
    if (settingsOpen && !settingsMinimized) {
      minimizeSettings();
      return;
    }
    openSettings();
  };

  const filesTaskClick = () => {
    if (filesOpen && !filesMinimized) {
      minimizeFiles();
      return;
    }
    openFiles(filesStartRelPath);
  };

  const notesTaskClick = () => {
    if (notesOpen && !notesMinimized) {
      minimizeNotes();
      return;
    }
    openNotes(notesInitialRelPath);
  };

  const scriptsTaskClick = () => {
    if (scriptsOpen && !scriptsMinimized) {
      minimizeScripts();
      return;
    }
    openScripts(scriptsInitialRelPath);
  };

  const mediaTaskClick = () => {
    if (mediaOpen && !mediaMinimized) {
      minimizeMedia();
      return;
    }
    openMedia(mediaInitialRelPath);
  };

  return (
    <div
      className="game-ui relative min-h-screen text-slate-100"
      onContextMenu={openDesktopContextMenu}
      style={{
        background: `
          radial-gradient(ellipse 120% 80% at 20% 0%, rgba(45, 212, 191, 0.12), transparent 50%),
          radial-gradient(ellipse 100% 60% at 100% 100%, rgba(99, 102, 241, 0.15), transparent 45%),
          linear-gradient(165deg, #0c1018 0%, #141a24 40%, #0d1117 100%)
        `
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
                    <div className="start-menu-left-item">
                      <span className="start-menu-left-item-ico" aria-hidden="true">＋</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Игры" : "Games"}</span>
                    </div>
                    <div className="start-menu-left-item">
                      <span className="start-menu-left-item-ico" aria-hidden="true">⬚</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Графика" : "Graphics"}</span>
                    </div>
                    <div className="start-menu-left-item">
                      <span className="start-menu-left-item-ico" aria-hidden="true">⟐</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Интернет" : "Internet"}</span>
                    </div>
                    <div className="start-menu-left-item">
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

                    <div className="start-menu-left-item">
                      <span className="start-menu-left-item-ico" aria-hidden="true">{lang === "ru" ? "⌘" : "⌘"}</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Программирование" : "Programming"}</span>
                    </div>
                    <div className="start-menu-left-item">
                      <span className="start-menu-left-item-ico" aria-hidden="true">⚗</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Наука" : "Science"}</span>
                    </div>
                    <div className="start-menu-left-item">
                      <span className="start-menu-left-item-ico" aria-hidden="true">▶</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Звук и видео" : "Sound & Video"}</span>
                    </div>
                    <div className="start-menu-left-item">
                      <span className="start-menu-left-item-ico" aria-hidden="true">◷</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Другое" : "Other"}</span>
                    </div>
                    <div className="start-menu-left-item">
                      <span className="start-menu-left-item-ico" aria-hidden="true">⚙</span>
                      <span className="start-menu-left-item-text">{lang === "ru" ? "Системные утилиты" : "System Tools"}</span>
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
                      {[
                        { icon: <HomeIcon />, label: lang === "ru" ? "Домой" : "Home" },
                        { icon: <FolderIcon />, label: lang === "ru" ? "Документы" : "Documents" },
                        { icon: <DownloadIcon />, label: lang === "ru" ? "Загрузки" : "Downloads" },
                        { icon: <MusicIcon />, label: lang === "ru" ? "Музыка" : "Music" },
                        { icon: <ImageIcon />, label: lang === "ru" ? "Картинки" : "Pictures" },
                        { icon: <VideoIcon />, label: lang === "ru" ? "Видео" : "Videos" }
                      ].map((row) => (
                        <div key={row.label} className="start-menu-place">
                          <span className="start-menu-place-ico" aria-hidden="true">
                            {row.icon}
                          </span>
                          <span className="start-menu-place-text">{row.label}</span>
                        </div>
                      ))}
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

          {/* Running apps */}
          <div className="taskbar-apps">
            {(terminalOpen || terminalMinimized) && (
              <button
                type="button"
                onClick={terminalTaskClick}
                className={`taskbar-app ${terminalOpen && !terminalMinimized ? "taskbar-app--active" : ""}`}
                aria-label="Terminal"
                title={t.dockTerminal}
              >
                <TerminalIcon />
              </button>
            )}

            {(settingsOpen || settingsMinimized) && (
              <button
                type="button"
                onClick={settingsTaskClick}
                className={`taskbar-app ${settingsOpen && !settingsMinimized ? "taskbar-app--active" : ""}`}
                aria-label={t.dockSettings}
                title={t.dockSettings}
              >
                <GearIcon size={18} />
              </button>
            )}

            {(filesOpen || filesMinimized) && (
              <button
                type="button"
                onClick={filesTaskClick}
                className={`taskbar-app ${filesOpen && !filesMinimized ? "taskbar-app--active" : ""}`}
                aria-label={lang === "ru" ? "Файлы" : "Files"}
                title={lang === "ru" ? "Файлы" : "Files"}
              >
                <FilesIcon />
              </button>
            )}

            {(notesOpen || notesMinimized) && (
              <button
                type="button"
                onClick={notesTaskClick}
                className={`taskbar-app ${notesOpen && !notesMinimized ? "taskbar-app--active" : ""}`}
                aria-label={lang === "ru" ? "Заметки" : "Notes"}
                title={lang === "ru" ? "Заметки" : "Notes"}
              >
                <NoteIcon />
              </button>
            )}

            {(scriptsOpen || scriptsMinimized) && (
              <button
                type="button"
                onClick={scriptsTaskClick}
                className={`taskbar-app ${scriptsOpen && !scriptsMinimized ? "taskbar-app--active" : ""}`}
                aria-label={lang === "ru" ? "Скрипты" : "Scripts"}
                title={lang === "ru" ? "Скрипты" : "Scripts"}
              >
                <CodeIcon />
              </button>
            )}

            {(mediaOpen || mediaMinimized) && (
              <button
                type="button"
                onClick={mediaTaskClick}
                className={`taskbar-app ${mediaOpen && !mediaMinimized ? "taskbar-app--active" : ""}`}
                aria-label={lang === "ru" ? "Медиа" : "Media"}
                title={lang === "ru" ? "Медиа" : "Media"}
              >
                <MediaIcon />
              </button>
            )}
          </div>
        </div>

        <div className="taskbar-right">
          <button
            type="button"
            className="taskbar-clock"
            onClick={() => addToast(lang === "ru" ? `Время: ${clockText}` : `Time: ${clockText}`)}
            aria-label={lang === "ru" ? "Часы" : "Clock"}
            title={lang === "ru" ? "Системное время" : "System time"}
          >
            {clockText}
          </button>

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

            <button
              type="button"
              className="taskbar-app"
              onClick={() => {
                setNetMenuOpen(false);
                exitAccount();
              }}
              aria-label={lang === "ru" ? "Выйти" : "Log out"}
              title={lang === "ru" ? "Выйти" : "Log out"}
            >
              <DoorIcon />
            </button>

            <button
              type="button"
              className="taskbar-app"
              onClick={() => {
                setNetMenuOpen(false);
                exitGame();
              }}
              aria-label={lang === "ru" ? "Выход" : "Exit"}
              title={lang === "ru" ? "Выход" : "Exit"}
            >
              <PowerIcon />
            </button>
          </div>

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
          <div
            className="desktop-ctx-item"
            role="menuitem"
            onClick={() => {
              setDesktopMenuOpen(false);
              void createDesktopFolder();
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
              openSettings();
            }}
          >
            <span className="desktop-ctx-ico" aria-hidden="true"><span style={{ fontSize: 16, opacity: 0.95 }}>⚙</span></span>
            <span>{lang === "ru" ? "Свойства" : "Properties"}</span>
          </div>
        </div>
      ) : null}

      {/* Desktop icons */}
      <div className="desktop-icons-layer">
        {desktopDirs.map((f) => {
          const cell = desktopIconCells[ f.relPath ];
          if (!cell) return null;
          const isDragging = draggingRelPath === f.relPath && dragPreviewPos;
          const left = isDragging ? dragPreviewPos!.x : DESK_LEFT + cell.col * CELL_W;
          const top = isDragging ? dragPreviewPos!.y : DESK_TOP + cell.row * CELL_H;

          return (
            <div
              key={f.relPath}
              className="desktop-folder-icon"
              style={{
                left,
                top,
                zIndex: isDragging ? 120 : 10
              }}
              onDoubleClick={() => {
                if (draggingRelPath) return;
                openFiles(f.relPath);
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
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
                <FolderIcon />
              </span>
              <span className="desktop-folder-name">{f.name}</span>
            </div>
          );
        })}
      </div>

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

      {/* Settings app */}
      {settingsOpen || settingsMinimized ? (
        <SettingsApp
          lang={lang}
          onClose={closeSettings}
          onMinimize={minimizeSettings}
          minimized={settingsMinimized && !settingsOpen}
        />
      ) : null}

      {/* Files app */}
      {filesOpen || filesMinimized ? (
        <FilesApp
          lang={lang}
          startRelPath={filesStartRelPath}
          onMinimize={minimizeFiles}
          onClose={closeFiles}
          minimized={filesMinimized && !filesOpen}
          onOpenNotes={(relPath) => openNotes(relPath)}
          onOpenScript={(relPath) => openScripts(relPath)}
          onOpenMedia={(relPath) => openMedia(relPath)}
        />
      ) : null}

      {/* Notes app */}
      {notesOpen || notesMinimized ? (
        <NotesApp
          lang={lang}
          initialRelPath={notesInitialRelPath}
          onMinimize={minimizeNotes}
          onClose={closeNotes}
          minimized={notesMinimized && !notesOpen}
        />
      ) : null}

      {/* Code editor app */}
      {scriptsOpen || scriptsMinimized ? (
        <CodeEditorApp
          lang={lang}
          initialRelPath={scriptsInitialRelPath}
          onMinimize={minimizeScripts}
          onClose={closeScripts}
          minimized={scriptsMinimized && !scriptsOpen}
          onRunInTerminal={(scriptRelPath) => {
            openTerminal();
            window.dispatchEvent(
              new CustomEvent("zeroday:terminal-run", {
                detail: { cmd: `hackrun ${scriptRelPath}` }
              })
            );
          }}
        />
      ) : null}

      {/* Media app */}
      {mediaOpen || mediaMinimized ? (
        <MediaApp
          lang={lang}
          initialRelPath={mediaInitialRelPath}
          onMinimize={minimizeMedia}
          onClose={closeMedia}
          minimized={mediaMinimized && !mediaOpen}
        />
      ) : null}

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
        />
      ) : null}
    </div>
  );
}
