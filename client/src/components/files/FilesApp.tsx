import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { FloatingWindow } from "../window/FloatingWindow";
import { NautilusExplorerLayout } from "./NautilusExplorerLayout";
import { TextPromptDialog } from "../dialog/TextPromptDialog";
import {
  deleteFs,
  getFsDiskUsage,
  initGameFs,
  listFs,
  mkdirFs,
  moveFs,
  type FsEntry,
  writeTextFs,
  writeBytesBase64Fs,
  fileToBase64,
  type FsDiskUsage
} from "../../lib/gameFs";

import type { GameLanguage } from "../../lib/gameConfig";
import { breezePlaceUrl, themeIconUrl } from "../../lib/themeIcons";

const FILES_RECENT_KEY = "zeroday.files.recent";

/** Путь для UI: только логическое положение в игровой ФС, без каталога игрока на ПК. */
function formatVirtualFsPath(
  lang: GameLanguage,
  currentRel: string,
  computerView: string,
  disk0View: string,
  recentView: string
): string {
  if (currentRel === computerView) return lang === "ru" ? "/Компьютер" : "/Computer";
  if (currentRel === disk0View) return lang === "ru" ? "/Дом" : "/Home";
  if (currentRel === recentView) return lang === "ru" ? "/Недавние" : "/Recent";
  const norm = currentRel.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!norm) return "/";
  return `/${norm}`;
}

function loadRecentPaths(): string[] {
  try {
    const raw = sessionStorage.getItem(FILES_RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecentPath(relPath: string): void {
  try {
    const arr = loadRecentPaths();
    const next = [relPath, ...arr.filter((x) => x !== relPath)].slice(0, 16);
    sessionStorage.setItem(FILES_RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function formatFreeSpaceLabel(bytes: number, lang: GameLanguage): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return lang === "ru" ? `${gb.toFixed(1)} ГБ` : `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return lang === "ru" ? `${mb.toFixed(0)} МБ` : `${mb.toFixed(0)} MB`;
}

type Props = {
  lang: GameLanguage;
  startRelPath?: string; // folder inside game filesystem root
  diskCapacityMb?: number;
  minimized?: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onOpenNotes: (relPath: string) => void;
  onOpenScript: (relPath: string) => void;
  onOpenMedia: (relPath: string) => void;
  onFsChanged?: () => void;
  onFocus?: () => void;
  zIndex?: number;
};

function extLower(entry: FsEntry): string {
  return (entry.ext ?? "").toLowerCase();
}

function isDir(e: FsEntry) {
  return e.kind === "dir";
}

function FsEntryIcon({ kind, size }: { kind: "dir" | "file"; size: number }) {
  const src = kind === "dir" ? breezePlaceUrl("folder") : themeIconUrl("document.svg");
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}

function FsSystemDiskIcon({ size }: { size: number }) {
  return (
    <img
      src={breezePlaceUrl("drive-harddisk")}
      alt=""
      width={size}
      height={size}
      draggable={false}
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}

const PROTECTED_ROOT_DIRS = new Set([
  "Notes",
  "Scripts",
  "Photos",
  "Videos",
  "Wallpapers",
  "Trash",
  "Desktop",
  "Documents",
  "Music",
  "Downloads"
]);

function isProtectedRootDir(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) return false;
  return !normalized.includes("/") && PROTECTED_ROOT_DIRS.has(normalized);
}

export function FilesApp({
  lang,
  startRelPath = "",
  diskCapacityMb,
  minimized,
  onMinimize,
  onClose,
  onOpenNotes,
  onOpenScript,
  onOpenMedia,
  onFsChanged,
  onFocus,
  zIndex
}: Props) {
  const COMPUTER_VIEW = "__computer__";
  const DISK0_VIEW = "__disk0__";
  const RECENT_VIEW = "__recent__";

  const [currentRel, setCurrentRel] = useState(startRelPath ? startRelPath : COMPUTER_VIEW);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const selectionAnchorRef = useRef<number | null>(null);

  const [draggingRelPath, setDraggingRelPath] = useState<string | null>(null);
  const [dragOverDirRelPath, setDragOverDirRelPath] = useState<string | null>(null);
  const [dragOverListArea, setDragOverListArea] = useState(false);
  const [pointerDrag, setPointerDrag] = useState<{
    relPaths: string[];
    active: boolean;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const [windowMsg, setWindowMsg] = useState<string | null>(null);

  const [diskUsage, setDiskUsage] = useState<FsDiskUsage | null>(null);
  const [diskUsageState, setDiskUsageState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [navPast, setNavPast] = useState<string[]>([]);
  const [navFuture, setNavFuture] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [iconZoom, setIconZoom] = useState(1);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentRelRef = useRef(currentRel);
  currentRelRef.current = currentRel;
  const selectedPathsRef = useRef<string[]>([]);
  selectedPathsRef.current = selectedPaths;

  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [ctxRel, setCtxRel] = useState<string | null>(null);
  const [ctxIsDir, setCtxIsDir] = useState(false);
  const ctxRef = useRef<HTMLDivElement | null>(null);

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
  const notifyFsChanged = () => {
    onFsChanged?.();
  };
  const getInternalDragRel = (dt: DataTransfer | null) => {
    if (!dt) return null;
    const direct = dt.getData("application/x-zeroday-fs-relpath");
    if (direct) return direct;
    const plain = dt.getData("text/plain");
    if (plain.startsWith("zd-fs:")) return plain.slice(6);
    if (plain && !plain.includes("\n")) return plain;
    return null;
  };
  const hasInternalDragData = (dt: DataTransfer | null) => {
    if (!dt) return false;
    if (dt.types.includes("application/x-zeroday-fs-relpath")) return true;
    if (dt.types.includes("text/plain")) return true;
    return false;
  };

  const visibleTitle = useMemo(() => {
    if (currentRel === COMPUTER_VIEW) return lang === "ru" ? "Компьютер" : "Computer";
    if (currentRel === RECENT_VIEW) return lang === "ru" ? "Недавние" : "Recent";
    if (currentRel === DISK0_VIEW) return lang === "ru" ? "Домашняя папка" : "Home";
    const leaf = currentRel.split("/").filter(Boolean).pop() ?? currentRel;
    return leaf;
  }, [currentRel, lang, COMPUTER_VIEW, DISK0_VIEW, RECENT_VIEW]);

  const virtualLocationPath = useMemo(
    () => formatVirtualFsPath(lang, currentRel, COMPUTER_VIEW, DISK0_VIEW, RECENT_VIEW),
    [lang, currentRel, COMPUTER_VIEW, DISK0_VIEW, RECENT_VIEW]
  );

  const resolveFsRel = (rel: string) => {
    if (rel === DISK0_VIEW) return "";
    return rel;
  };

  const computeUsedBytesFallback = async () => {
    const queue: string[] = [""];
    let total = 0;
    let visitedDirs = 0;
    while (queue.length > 0) {
      const dir = queue.shift() ?? "";
      visitedDirs += 1;
      if (visitedDirs > 3000) throw new Error("Too many directories");
      const items = await listFs(dir);
      for (const it of items) {
        if (it.kind === "dir") queue.push(it.relPath);
        else total += it.size;
      }
    }
    return total;
  };

  const loadRecentEntries = async () => {
    await initGameFs();
    const paths = loadRecentPaths();
    const out: FsEntry[] = [];
    for (const relPath of paths) {
      const parent = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
      try {
        const parentItems = await listFs(parent);
        const found = parentItems.find((e) => e.relPath === relPath);
        if (found) out.push(found);
      } catch {
        /* removed from disk */
      }
    }
    setEntries(out);
  };

  const refresh = async (rel = currentRel) => {
    if (rel === COMPUTER_VIEW) {
      setEntries([]);
      return;
    }
    if (rel === RECENT_VIEW) {
      await loadRecentEntries();
      return;
    }
    await initGameFs();
    const fsRel = resolveFsRel(rel);
    const items = await listFs(fsRel);
    setEntries(items);
  };

  useEffect(() => {
    const next = startRelPath ? startRelPath : COMPUTER_VIEW;
    setCurrentRel(next);
    setNavPast([]);
    setNavFuture([]);
    void refresh(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh(currentRel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRel]);

  useEffect(() => {
    void (async () => {
      setDiskUsageState("loading");
      try {
        await initGameFs();
        const result = await Promise.race([
          getFsDiskUsage(),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error("Disk usage timeout")), 5000)
          )
        ]);
        const capFromProfile = diskCapacityMb ? Math.max(64 * 1024 * 1024, diskCapacityMb * 1024 * 1024) : null;
        const capacityBytes = capFromProfile ?? result.capacityBytes;
        const freeBytes = Math.max(0, capacityBytes - result.usedBytes);
        setDiskUsage({
          capacityBytes,
          usedBytes: result.usedBytes,
          freeBytes
        });
        setDiskUsageState("ready");
      } catch {
        try {
          await initGameFs();
          const usedBytes = await computeUsedBytesFallback();
          const capacityBytes = Math.max(
            64 * 1024 * 1024,
            (diskCapacityMb ?? 512) * 1024 * 1024
          );
          const freeBytes = Math.max(0, capacityBytes - usedBytes);
          setDiskUsage({
            capacityBytes,
            usedBytes,
            freeBytes
          });
          setDiskUsageState("ready");
        } catch {
          setDiskUsage(null);
          setDiskUsageState("error");
        }
      }
    })();
  }, [diskCapacityMb]);

  const navigateTo = (next: string) => {
    const cur = currentRelRef.current;
    if (next === cur) {
      setSelectedPaths([]);
      return;
    }
    setNavPast((p) => [...p, cur]);
    setNavFuture([]);
    setCurrentRel(next);
    setSelectedPaths([]);
  };

  const goBack = () => {
    if (navPast.length === 0) return;
    const prev = navPast[navPast.length - 1]!;
    const cur = currentRelRef.current;
    setNavFuture((f) => [cur, ...f]);
    setNavPast((p) => p.slice(0, -1));
    setCurrentRel(prev);
    setSelectedPaths([]);
  };

  const goForward = () => {
    if (navFuture.length === 0) return;
    const next = navFuture[0]!;
    const cur = currentRelRef.current;
    setNavPast((p) => [...p, cur]);
    setNavFuture((f) => f.slice(1));
    setCurrentRel(next);
    setSelectedPaths([]);
  };

  const goUp = () => {
    const cur = currentRelRef.current;
    if (cur === DISK0_VIEW) {
      navigateTo(COMPUTER_VIEW);
      return;
    }
    if (cur === RECENT_VIEW) {
      navigateTo(DISK0_VIEW);
      return;
    }
    if (!cur || cur === COMPUTER_VIEW) return;
    const parts = cur.split("/").filter(Boolean);
    parts.pop();
    navigateTo(parts.join("/") || DISK0_VIEW);
  };

  const selectedEntries = useMemo(() => {
    const map = new Map(entries.map((e) => [e.relPath, e]));
    return selectedPaths.map((p) => map.get(p)).filter(Boolean) as FsEntry[];
  }, [entries, selectedPaths]);

  const selectedEntry = selectedEntries.length === 1 ? selectedEntries[0]! : null;

  const displayedEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, searchQuery]);

  const isNautilusSidebarActive = (rel: string) => {
    if (rel === COMPUTER_VIEW) return currentRel === COMPUTER_VIEW;
    if (rel === RECENT_VIEW) return currentRel === RECENT_VIEW;
    if (rel === DISK0_VIEW) return currentRel === DISK0_VIEW;
    return currentRel === rel || currentRel.startsWith(`${rel}/`);
  };

  const sidebarComputerItems = useMemo(() => {
    const t = (ru: string, en: string) => (lang === "ru" ? ru : en);
    return [
      { rel: DISK0_VIEW, label: t("Домашняя папка", "Home") },
      { rel: "Desktop", label: t("Рабочий стол", "Desktop") },
      { rel: "Documents", label: t("Документы", "Documents") },
      { rel: "Music", label: t("Музыка", "Music") },
      { rel: "Photos", label: t("Изображения", "Pictures") },
      { rel: "Videos", label: t("Видео", "Videos") },
      { rel: "Downloads", label: t("Загрузки", "Downloads") },
      { rel: RECENT_VIEW, label: t("Недавние", "Recent") },
      { rel: COMPUTER_VIEW, label: t("Файловая система", "File System") },
      { rel: "Trash", label: t("Корзина", "Trash") },
      { rel: "Notes", label: t("Заметки", "Notes") },
      { rel: "Scripts", label: t("Скрипты", "Scripts") },
      { rel: "Wallpapers", label: t("Обои", "Wallpapers") }
    ];
  }, [lang, COMPUTER_VIEW, DISK0_VIEW, RECENT_VIEW]);

  const nautilusStatusText = useMemo(() => {
    const t = (ru: string, en: string) => (lang === "ru" ? ru : en);
    const free =
      diskUsage && diskUsageState === "ready"
        ? formatFreeSpaceLabel(diskUsage.freeBytes, lang)
        : diskUsageState === "loading"
          ? t("…", "…")
          : "—";
    if (windowMsg) return `${windowMsg}  ·  ${t("Свободно", "Free space")}: ${free}`;
    if (selectedPaths.length > 1) {
      return `${selectedPaths.length} ${t("объектов выбрано", "items selected")}  ·  ${t("Свободно", "Free space")}: ${free}`;
    }
    if (selectedEntry) {
      const n = selectedEntry.name;
      const isDir = selectedEntry.kind === "dir";
      const cntHint =
        isDir && !searchQuery.trim()
          ? t(` (${entries.length} эл.)`, ` (${entries.length} items)`)
          : "";
      return `"${n}" ${t("выбрано", "selected")}${cntHint}  ·  ${t("Свободно", "Free space")}: ${free}`;
    }
    const n = displayedEntries.length;
    return `${n} ${t("объектов", "items")}  ·  ${t("Свободно", "Free space")}: ${free}`;
  }, [
    windowMsg,
    diskUsage,
    diskUsageState,
    currentRel,
    selectedEntry,
    selectedPaths.length,
    entries.length,
    displayedEntries.length,
    searchQuery,
    lang
  ]);

  const newFolderTargetRel = (): string | null => {
    if (currentRel === DISK0_VIEW || currentRel === RECENT_VIEW) return "";
    if (currentRel === COMPUTER_VIEW) return null;
    return currentRel || null;
  };

  const safeChildRel = (dirRel: string | null, nameRaw: string) => {
    const safe = nameRaw.trim().replace(/[<>:"/\\|?*]+/g, "_").replace(/\.+$/g, "").trim();
    if (!safe) return null;
    const prefix = dirRel ? `${dirRel}/` : "";
    return `${prefix}${safe}`;
  };

  const createFolderAt = async (dirRel: string | null) => {
    const name = await promptAsync(lang === "ru" ? "Имя папки:" : "Folder name:");
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const rel = safeChildRel(dirRel, trimmed);
    if (!rel) return;
    try {
      await mkdirFs(rel);
      setWindowMsg(lang === "ru" ? "Папка создана" : "Folder created");
      await refresh();
      notifyFsChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWindowMsg(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
    }
  };

  const createTextFileAt = async (dirRel: string | null, ext: "txt" | "md") => {
    const name = await promptAsync(lang === "ru" ? `Имя файла (*.${ext}):` : `File name (*.${ext}):`);
    if (name === null) return;
    const base = name.trim().replace(/[<>:"/\\|?*]+/g, "_").replace(/\.+$/g, "").trim();
    if (!base) return;
    const fileName = base.endsWith(`.${ext}`) ? base : `${base}.${ext}`;
    const rel = safeChildRel(dirRel, fileName);
    if (!rel) return;
    try {
      const initial = ext === "md" ? "# Title\n\n" : "";
      await writeTextFs(rel, initial);
      setWindowMsg(lang === "ru" ? "Файл создан" : "File created");
      await refresh();
      notifyFsChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWindowMsg(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
    }
  };

  const createHackFileAt = async (dirRel: string | null) => {
    const name = await promptAsync(
      lang === "ru" ? "Имя HackScript файла (*.hack):" : "HackScript file name (*.hack):"
    );
    if (name === null) return;
    if (!name.trim()) return;
    const base = name.trim().replace(/[<>:"/\\|?*]+/g, "_").replace(/\.+$/g, "").trim();
    if (!base) return;
    const fileName = base.endsWith(".hack") ? base : `${base}.hack`;
    const rel = safeChildRel(dirRel, fileName);
    if (!rel) return;
    try {
      const initial = `# HackScript example\nprint("Hello from HackScript")\n`;
      await writeTextFs(rel, initial);
      setWindowMsg(lang === "ru" ? "Скрипт создан" : "Script created");
      await refresh();
      notifyFsChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWindowMsg(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
    }
  };

  const deletePathsRel = async (paths: string[]) => {
    const unique = [...new Set(paths)].filter((p) => p !== DISK0_VIEW && p !== COMPUTER_VIEW);
    if (!unique.length) return;
    try {
      await initGameFs();
      let i = 0;
      for (const relPath of unique) {
        if (relPath.startsWith("Trash/") || relPath === "Trash") {
          await deleteFs(relPath);
        } else {
          const base = relPath.split("/").filter(Boolean).pop() ?? relPath;
          const dst = `Trash/${base}__${Date.now()}_${i}`;
          await moveFs(relPath, dst);
        }
        i += 1;
      }
      setSelectedPaths([]);
      setWindowMsg(
        lang === "ru"
          ? unique.length > 1
            ? `Удалено объектов: ${unique.length}`
            : unique[0]!.startsWith("Trash/")
              ? "Удалено"
              : "В корзину"
          : unique.length > 1
            ? `Removed ${unique.length} items`
            : unique[0]!.startsWith("Trash/")
              ? "Deleted"
              : "Moved to Trash"
      );
      await refresh();
      notifyFsChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWindowMsg(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
    }
  };

  const deleteEntryAt = async (relPath: string) => {
    await deletePathsRel([relPath]);
  };

  const renameEntryAt = async (relPath: string) => {
    const entry = entries.find((e) => e.relPath === relPath);
    if (!entry) return;
    const currentParent = relPath.includes("/") ? relPath.split("/").slice(0, -1).join("/") : "";
    const currentBase = relPath.split("/").filter(Boolean).pop() ?? entry.name;
    const name = await promptAsync(
      lang === "ru" ? `Новое имя для (${currentBase}):` : `New name for (${currentBase}):`,
      currentBase
    );
    if (name === null) return;
    const dstBase = name.trim().replace(/[<>:"/\\|?*]+/g, "_").replace(/\.+$/g, "").trim();
    if (!dstBase) return;
    const dstRel = currentParent ? `${currentParent}/${dstBase}` : dstBase;
    try {
      await moveFs(relPath, dstRel);
      setSelectedPaths([dstRel]);
      setWindowMsg(lang === "ru" ? "Переименовано" : "Renamed");
      await refresh();
      notifyFsChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWindowMsg(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
    }
  };

  const parentDirOf = (rel: string) =>
    rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";

  const moveMultipleToDir = async (srcRels: string[], dstDirRel: string) => {
    const unique = [...new Set(srcRels)].filter(Boolean);
    if (!unique.length) return;
    let blocked = false;
    for (const src of unique) {
      if (isProtectedRootDir(src)) {
        blocked = true;
        continue;
      }
      if (src === dstDirRel || (dstDirRel && dstDirRel.startsWith(`${src}/`))) continue;
      const baseName = src.split("/").filter(Boolean).pop();
      if (!baseName) continue;
      const dst = dstDirRel ? `${dstDirRel}/${baseName}` : baseName;
      if (src === dst) continue;
      try {
        await moveFs(src, dst);
      } catch {
        /* skip conflict, continue others */
      }
    }
    if (blocked) {
      setWindowMsg(
        lang === "ru"
          ? "Системные папки нельзя перемещать"
          : "System folders cannot be moved"
      );
    }
    setDraggingRelPath(null);
    setDragOverDirRelPath(null);
    setSelectedPaths([]);
    await refresh();
    notifyFsChanged();
  };

  const moveDraggedIntoDir = async (srcRel: string, dstDirRel: string) => {
    await moveMultipleToDir([srcRel], dstDirRel);
  };

  const onExternalFilesDrop = async (files: FileList) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setWindowMsg(lang === "ru" ? "Загрузка..." : "Uploading...");
    try {
      const dirBase =
        currentRel === DISK0_VIEW || currentRel === RECENT_VIEW
          ? ""
          : currentRel === COMPUTER_VIEW
            ? null
            : currentRel || "";
      if (dirBase === null) return;
      for (const f of arr) {
        if (!f) continue;
        const safe = f.name.replace(/[<>:"/\\|?*]+/g, "_");
        const rel = dirBase ? `${dirBase}/${safe}` : safe;
        const b64 = await fileToBase64(f);
        await writeBytesBase64Fs(rel, b64);
      }
      setWindowMsg(null);
      await refresh();
      notifyFsChanged();
    } catch {
      setWindowMsg(lang === "ru" ? "Ошибка загрузки файла" : "File upload failed");
    }
  };

  const openEntry = (entry: FsEntry) => {
    if (entry.kind === "dir") {
      navigateTo(entry.relPath);
      return;
    }

    pushRecentPath(entry.relPath);
    const entryExt = extLower(entry);
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(entryExt)) onOpenMedia(entry.relPath);
    else if (["mp4", "webm", "ogg"].includes(entryExt)) onOpenMedia(entry.relPath);
    else if (entryExt === "txt" || entryExt === "md") onOpenNotes(entry.relPath);
    else if (entryExt === "hack") onOpenScript(entry.relPath);
  };

  const openSelected = () => {
    if (selectedEntries.length === 1) {
      openEntry(selectedEntries[0]!);
      return;
    }
    for (const ent of selectedEntries) {
      if (ent.kind === "file") openEntry(ent);
    }
  };

  const handleEntryClick = (ev: ReactMouseEvent, entry: FsEntry, index: number) => {
    if (ev.ctrlKey || ev.metaKey) {
      ev.stopPropagation();
      setSelectedPaths((prev) => {
        const s = new Set(prev);
        if (s.has(entry.relPath)) s.delete(entry.relPath);
        else s.add(entry.relPath);
        return [...s];
      });
      selectionAnchorRef.current = index;
      return;
    }
    if (ev.shiftKey && selectionAnchorRef.current !== null) {
      ev.stopPropagation();
      const a = Math.min(selectionAnchorRef.current, index);
      const b = Math.max(selectionAnchorRef.current, index);
      setSelectedPaths(displayedEntries.slice(a, b + 1).map((x) => x.relPath));
    }
  };

  const handleEntryPointerDown = (ev: ReactPointerEvent, entry: FsEntry, index: number) => {
    if (ev.button !== 0) return;
    const curSel = selectedPathsRef.current;
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
      const dragPaths = curSel.includes(entry.relPath) ? [...curSel] : [...curSel, entry.relPath];
      setDraggingRelPath(entry.relPath);
      setPointerDrag({
        relPaths: dragPaths,
        active: false,
        startX: ev.clientX,
        startY: ev.clientY,
        x: ev.clientX,
        y: ev.clientY
      });
      return;
    }
    if (!curSel.includes(entry.relPath)) {
      setSelectedPaths([entry.relPath]);
      selectionAnchorRef.current = index;
      setDraggingRelPath(entry.relPath);
      setPointerDrag({
        relPaths: [entry.relPath],
        active: false,
        startX: ev.clientX,
        startY: ev.clientY,
        x: ev.clientX,
        y: ev.clientY
      });
      return;
    }
    setDraggingRelPath(entry.relPath);
    setPointerDrag({
      relPaths: [...curSel],
      active: false,
      startX: ev.clientX,
      startY: ev.clientY,
      x: ev.clientX,
      y: ev.clientY
    });
  };

  useEffect(() => {
    if (!ctxOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = ctxRef.current;
      if (!el) return;
      const target = e.target as HTMLElement | null;
      if (target && target instanceof Node && el.contains(target)) return;
      setCtxOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ctxOpen]);

  const ctxEntry = useMemo(() => {
    if (!ctxRel) return null;
    return entries.find((e) => e.relPath === ctxRel) ?? null;
  }, [ctxRel, entries]);

  useEffect(() => {
    if (!pointerDrag) return;
    const onMove = (e: PointerEvent) => {
      setPointerDrag((prev) => {
        if (!prev) return prev;
        const moved = Math.hypot(e.clientX - prev.startX, e.clientY - prev.startY) > 6;
        return { ...prev, active: prev.active || moved, x: e.clientX, y: e.clientY };
      });
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const dirDropEl = target?.closest("[data-files-dir-drop='1']") as HTMLElement | null;
      const dirRel = dirDropEl?.dataset.dirRel ?? null;
      if (dirRel) {
        setDragOverDirRelPath(dirRel);
        setDragOverListArea(false);
      } else if (currentRel !== COMPUTER_VIEW && currentRel !== RECENT_VIEW) {
        setDragOverDirRelPath(null);
        setDragOverListArea(true);
      }
    };
    const onUp = () => {
      setPointerDrag((prev) => {
        if (!prev) return prev;
        if (prev.active) {
          const target = document.elementFromPoint(prev.x, prev.y) as HTMLElement | null;
          const dirDropEl = target?.closest("[data-files-dir-drop='1']") as HTMLElement | null;
          const dirRel = dirDropEl?.dataset.dirRel ?? null;
          const sources = prev.relPaths.filter(
            (s) => s !== dirRel && (!dirRel || !dirRel.startsWith(`${s}/`))
          );
          if (dirRel && sources.length) {
            void moveMultipleToDir(sources, dirRel);
          } else if (currentRel !== COMPUTER_VIEW && currentRel !== RECENT_VIEW) {
            if (!currentRel || currentRel === DISK0_VIEW) {
              void moveMultipleToDir(
                prev.relPaths.filter((s) => parentDirOf(s) !== ""),
                ""
              );
            } else {
              void moveMultipleToDir(
                prev.relPaths.filter((s) => parentDirOf(s) !== currentRel),
                currentRel
              );
            }
          }
        }
        return null;
      });
      setDraggingRelPath(null);
      setDragOverDirRelPath(null);
      setDragOverListArea(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [pointerDrag, currentRel]);

  useEffect(() => {
    if (pointerDrag?.active) {
      document.body.classList.add("zd-dragging-cursor");
    } else {
      document.body.classList.remove("zd-dragging-cursor");
    }
    return () => {
      document.body.classList.remove("zd-dragging-cursor");
    };
  }, [pointerDrag]);

  const ctxMenuNode = ctxOpen ? (
    <div
      ref={ctxRef}
      className="desktop-ctx-menu"
      style={{
        left: ctxPos.x,
        top: ctxPos.y,
        zIndex: 2600
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      role="menu"
      aria-label={lang === "ru" ? "Меню файлов" : "Files menu"}
    >
      {(() => {
        const curDirRel =
          currentRel === COMPUTER_VIEW
            ? null
            : currentRel === DISK0_VIEW || currentRel === RECENT_VIEW
              ? ""
              : currentRel;
        const targetDirRel = ctxIsDir && ctxRel ? ctxRel : curDirRel;
        const targetEntry = ctxEntry;
        const canMakeNotes = Boolean(targetDirRel?.startsWith("Notes"));
        const canMakeScripts = Boolean(targetDirRel?.startsWith("Scripts"));

        return (
          <>
            {selectedEntries.length > 0 ? (
              <button
                type="button"
                className="desktop-ctx-item w-full text-left"
                role="menuitem"
                onClick={() => {
                  setCtxOpen(false);
                  openSelected();
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true">
                  {selectedEntries.length === 1 && selectedEntries[0]?.kind === "dir" ? "▶" : "⟐"}
                </span>
                <span>
                  {lang === "ru"
                    ? selectedEntries.length > 1
                      ? `Открыть (${selectedEntries.length})`
                      : "Открыть"
                    : selectedEntries.length > 1
                      ? `Open (${selectedEntries.length})`
                      : "Open"}
                </span>
              </button>
            ) : null}

            <button
              type="button"
              className="desktop-ctx-item w-full text-left"
              role="menuitem"
              onClick={() => {
                setCtxOpen(false);
                void createFolderAt(targetDirRel);
              }}
            >
              <span className="desktop-ctx-ico" aria-hidden="true">
                <span style={{ fontSize: 16, opacity: 0.95 }}>＋</span>
              </span>
              <span>{lang === "ru" ? "Создать папку" : "New folder"}</span>
            </button>

            <button
              type="button"
              className="desktop-ctx-item w-full text-left"
              role="menuitem"
              onClick={() => {
                setCtxOpen(false);
                fileInputRef.current?.click();
              }}
            >
              <span className="desktop-ctx-ico" aria-hidden="true">
                <span style={{ fontSize: 16, opacity: 0.95 }}>⬆</span>
              </span>
              <span>{lang === "ru" ? "Загрузить файлы" : "Upload files"}</span>
            </button>

            {canMakeNotes ? (
              <>
                <button
                  type="button"
                  className="desktop-ctx-item w-full text-left"
                  role="menuitem"
                  onClick={() => {
                    setCtxOpen(false);
                    void createTextFileAt(targetDirRel, "txt");
                  }}
                >
                  <span className="desktop-ctx-ico" aria-hidden="true">
                    .txt
                  </span>
                  <span>{lang === "ru" ? "Текстовый файл" : "Text file"}</span>
                </button>
                <button
                  type="button"
                  className="desktop-ctx-item w-full text-left"
                  role="menuitem"
                  onClick={() => {
                    setCtxOpen(false);
                    void createTextFileAt(targetDirRel, "md");
                  }}
                >
                  <span className="desktop-ctx-ico" aria-hidden="true">
                    .md
                  </span>
                  <span>{lang === "ru" ? "Markdown файл" : "Markdown file"}</span>
                </button>
              </>
            ) : null}

            {canMakeScripts ? (
              <button
                type="button"
                className="desktop-ctx-item w-full text-left"
                role="menuitem"
                onClick={() => {
                  setCtxOpen(false);
                  void createHackFileAt(targetDirRel);
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true">
                  .hack
                </span>
                <span>{lang === "ru" ? "HackScript файл" : "HackScript file"}</span>
              </button>
            ) : null}

            {selectedPaths.length === 1 && targetEntry ? (
              <button
                type="button"
                className="desktop-ctx-item w-full text-left"
                role="menuitem"
                onClick={() => {
                  setCtxOpen(false);
                  void renameEntryAt(targetEntry.relPath);
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true">
                  ✎
                </span>
                <span>{lang === "ru" ? "Переименовать" : "Rename"}</span>
              </button>
            ) : null}

            {selectedPaths.length > 0 ? (
              <button
                type="button"
                className="desktop-ctx-item w-full text-left"
                role="menuitem"
                onClick={() => {
                  setCtxOpen(false);
                  void deletePathsRel([...selectedPaths]);
                }}
              >
                <span className="desktop-ctx-ico" aria-hidden="true">
                  <img src={breezePlaceUrl("user-trash")} alt="" className="desktop-ctx-theme-icon" draggable={false} />
                </span>
                <span>
                  {lang === "ru"
                    ? selectedPaths.length > 1
                      ? `Удалить (${selectedPaths.length})`
                      : "Удалить"
                    : selectedPaths.length > 1
                      ? `Delete (${selectedPaths.length})`
                      : "Delete"}
                </span>
              </button>
            ) : null}
          </>
        );
      })()}
    </div>
  ) : null;

  return (
    <>
      <FloatingWindow
      title={visibleTitle}
      onClose={onClose}
      onMinimize={onMinimize}
      minimized={minimized}
      onFocus={onFocus}
      zIndex={zIndex}
    >
      <NautilusExplorerLayout
        lang={lang}
        COMPUTER_VIEW={COMPUTER_VIEW}
        DISK0_VIEW={DISK0_VIEW}
        RECENT_VIEW={RECENT_VIEW}
        currentRel={currentRel}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        navPastLen={navPast.length}
        navFutureLen={navFuture.length}
        goBack={goBack}
        goForward={goForward}
        goUp={goUp}
        navigateTo={navigateTo}
        viewMode={viewMode}
        setViewMode={setViewMode}
        iconZoom={iconZoom}
        setIconZoom={setIconZoom}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        sidebarComputerItems={sidebarComputerItems}
        isNautilusSidebarActive={isNautilusSidebarActive}
        newFolderTargetRel={newFolderTargetRel}
        onNewFolder={() => {
          const b = newFolderTargetRel();
          if (b === null) return;
          void createFolderAt(b);
        }}
        onUploadClick={() => fileInputRef.current?.click()}
        onRefresh={() => void refresh()}
        onCloseWindow={onClose}
        virtualLocationPath={virtualLocationPath}
        nautilusStatusText={nautilusStatusText}
        fileInput={
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) void onExternalFilesDrop(files);
              e.currentTarget.value = "";
            }}
          />
        }
      >
        <div
          className="min-h-full"
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCtxRel(null);
            setCtxIsDir(false);
            setCtxPos({
              x: Math.min(e.clientX, window.innerWidth - 260),
              y: Math.min(e.clientY, window.innerHeight - 220)
            });
            setCtxOpen(true);
          }}
          onDragOver={(e) => {
            if (currentRel === COMPUTER_VIEW || currentRel === RECENT_VIEW) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (hasInternalDragData(e.dataTransfer) || e.dataTransfer.files?.length) setDragOverListArea(true);
          }}
          onDragLeave={(e) => {
            const nextTarget = e.relatedTarget as Node | null;
            if (!nextTarget || !e.currentTarget.contains(nextTarget)) {
              setDragOverListArea(false);
            }
          }}
          onDrop={(e) => {
            if (currentRel === COMPUTER_VIEW || currentRel === RECENT_VIEW) return;
            e.preventDefault();
            setDragOverListArea(false);
            const internal = getInternalDragRel(e.dataTransfer);
            if (internal) {
              // Drop into currentRel (if current item is dir or root)
              if (!currentRel || currentRel === DISK0_VIEW) {
                void (async () => {
                  const baseName = internal.split("/").filter(Boolean).pop();
                  if (!baseName) return;
                  await moveFs(internal, baseName);
                  setDraggingRelPath(null);
                  setDragOverDirRelPath(null);
                  await refresh();
                  notifyFsChanged();
                })();
              } else {
                void moveDraggedIntoDir(internal, currentRel);
              }
              return;
            }
            if (e.dataTransfer.files?.length) {
              void onExternalFilesDrop(e.dataTransfer.files);
            }
          }}
        >
          {currentRel === COMPUTER_VIEW ? (
            <div className="nautilus-computer-wrap flex flex-wrap gap-6 p-8">
              <button
                type="button"
                className={`nautilus-disk-tile flex w-[200px] flex-col items-center gap-2 rounded-lg border border-black/30 bg-[#333] p-5 text-center shadow-md transition hover:bg-[#3a3a3a] ${
                  selectedPaths.includes(DISK0_VIEW) ? "ring-2 ring-[#3584e4]/80" : ""
                }`}
                onDoubleClick={() => navigateTo(DISK0_VIEW)}
                onClick={() => setSelectedPaths([DISK0_VIEW])}
              >
                <FsSystemDiskIcon size={72} />
                <div className="text-sm font-semibold text-white/95">
                  {lang === "ru" ? "Системный диск" : "System disk"}
                </div>
                <div className="text-[11px] text-white/55">
                  {diskUsage && diskUsageState === "ready"
                    ? formatFreeSpaceLabel(diskUsage.freeBytes, lang)
                    : diskUsageState === "loading"
                      ? lang === "ru"
                        ? "…"
                        : "…"
                      : "—"}
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-[#3584e4]"
                    style={{
                      width:
                        diskUsage && diskUsageState === "ready"
                          ? `${Math.min(100, (diskUsage.usedBytes / Math.max(1, diskUsage.capacityBytes)) * 100)}%`
                          : "0%"
                    }}
                  />
                </div>
              </button>
            </div>
          ) : (
            <div
              className={`p-2 ${dragOverListArea ? "nautilus-drop-target m-1 rounded-lg border-2 border-dashed border-[#3584e4]/70 bg-[#3584e4]/10" : ""}`}
            >
              {viewMode === "grid" ? (
                <div
                  className="nautilus-icon-grid grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(72, Math.round(88 * iconZoom))}px, 1fr))`
                  }}
                >
                  {displayedEntries.map((e, index) => {
                    const selected = selectedPaths.includes(e.relPath);
                    const isDragOver = dragOverDirRelPath === e.relPath && e.kind === "dir";
                    const isz = Math.round(44 * iconZoom);
                    return (
                      <div
                        key={e.relPath}
                        role="button"
                        tabIndex={0}
                        className={`nautilus-icon-cell flex cursor-default flex-col items-center gap-1 rounded-md p-2 outline-none transition ${
                          selected ? "nautilus-icon-cell--selected" : "hover:bg-white/6"
                        } ${isDragOver ? "ring-2 ring-[#3584e4]/80" : ""}`}
                        onClick={(ev) => handleEntryClick(ev, e, index)}
                        onPointerDown={(ev) => handleEntryPointerDown(ev, e, index)}
                        onContextMenu={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          if (!selectedPathsRef.current.includes(e.relPath)) {
                            setSelectedPaths([e.relPath]);
                            selectionAnchorRef.current = index;
                          }
                          setCtxRel(e.relPath);
                          setCtxIsDir(e.kind === "dir");
                          setCtxPos({
                            x: Math.min(ev.clientX, window.innerWidth - 260),
                            y: Math.min(ev.clientY, window.innerHeight - 220)
                          });
                          setCtxOpen(true);
                        }}
                        onDoubleClick={() => openEntry(e)}
                        onDragOver={(ev) => {
                          if (e.kind !== "dir") return;
                          ev.preventDefault();
                          ev.dataTransfer.dropEffect = "move";
                          if (hasInternalDragData(ev.dataTransfer)) {
                            setDragOverListArea(false);
                            setDragOverDirRelPath(e.relPath);
                          }
                        }}
                        onDragEnter={(ev) => {
                          if (e.kind !== "dir") return;
                          ev.preventDefault();
                          ev.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(ev) => {
                          if (e.kind !== "dir") return;
                          ev.preventDefault();
                          const internal = getInternalDragRel(ev.dataTransfer);
                          if (!internal) return;
                          if (internal === e.relPath) return;
                          void moveDraggedIntoDir(internal, e.relPath);
                        }}
                        data-files-dir-drop={e.kind === "dir" ? "1" : undefined}
                        data-dir-rel={e.kind === "dir" ? e.relPath : undefined}
                      >
                        {e.kind === "dir" ? (
                          <FsEntryIcon kind="dir" size={isz} />
                        ) : (
                          <FsEntryIcon kind="file" size={Math.max(32, isz - 6)} />
                        )}
                        <span className="max-w-full truncate px-0.5 text-center text-[11px] leading-tight text-white/90">
                          {e.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {displayedEntries.map((e, index) => {
                    const selected = selectedPaths.includes(e.relPath);
                    const isDragOver = dragOverDirRelPath === e.relPath && e.kind === "dir";
                    return (
                      <div
                        key={e.relPath}
                        role="button"
                        tabIndex={0}
                        className={`nautilus-list-row flex cursor-default items-center gap-3 rounded px-2 py-1.5 text-[13px] ${
                          selected ? "nautilus-list-row--selected" : "hover:bg-white/6"
                        } ${isDragOver ? "ring-1 ring-[#3584e4]/80" : ""}`}
                        onClick={(ev) => handleEntryClick(ev, e, index)}
                        onPointerDown={(ev) => handleEntryPointerDown(ev, e, index)}
                        onContextMenu={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          if (!selectedPathsRef.current.includes(e.relPath)) {
                            setSelectedPaths([e.relPath]);
                            selectionAnchorRef.current = index;
                          }
                          setCtxRel(e.relPath);
                          setCtxIsDir(e.kind === "dir");
                          setCtxPos({
                            x: Math.min(ev.clientX, window.innerWidth - 260),
                            y: Math.min(ev.clientY, window.innerHeight - 220)
                          });
                          setCtxOpen(true);
                        }}
                        onDoubleClick={() => openEntry(e)}
                        onDragOver={(ev) => {
                          if (e.kind !== "dir") return;
                          ev.preventDefault();
                          ev.dataTransfer.dropEffect = "move";
                          if (hasInternalDragData(ev.dataTransfer)) {
                            setDragOverListArea(false);
                            setDragOverDirRelPath(e.relPath);
                          }
                        }}
                        onDragEnter={(ev) => {
                          if (e.kind !== "dir") return;
                          ev.preventDefault();
                          ev.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(ev) => {
                          if (e.kind !== "dir") return;
                          ev.preventDefault();
                          const internal = getInternalDragRel(ev.dataTransfer);
                          if (!internal) return;
                          if (internal === e.relPath) return;
                          void moveDraggedIntoDir(internal, e.relPath);
                        }}
                        data-files-dir-drop={e.kind === "dir" ? "1" : undefined}
                        data-dir-rel={e.kind === "dir" ? e.relPath : undefined}
                      >
                        <span className="inline-flex w-7 shrink-0 justify-center files-dnd-handle" aria-hidden="true">
                          {e.kind === "dir" ? <FsEntryIcon kind="dir" size={22} /> : <FsEntryIcon kind="file" size={20} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{e.name}</span>
                        <span className="w-24 shrink-0 text-right text-[11px] text-white/45">
                          {e.kind === "dir" ? "" : e.ext ? `.${e.ext}` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {!displayedEntries.length ? (
                <div className="py-16 text-center text-[13px] text-white/45">
                  {lang === "ru" ? "Пусто" : "Empty"}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </NautilusExplorerLayout>
    </FloatingWindow>

      {typeof document !== "undefined" && ctxMenuNode ? createPortal(ctxMenuNode, document.body) : null}

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
    </>
  );
}

