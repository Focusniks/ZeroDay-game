import { useEffect, useMemo, useRef, useState } from "react";
import { FloatingWindow } from "../window/FloatingWindow";
import {
  deleteFs,
  getGameFilesRootPath,
  initGameFs,
  listFs,
  mkdirFs,
  moveFs,
  type FsEntry,
  writeTextFs,
  writeBytesBase64Fs,
  fileToBase64,
} from "../../lib/gameFs";

import type { GameLanguage } from "../../lib/gameConfig";

type Props = {
  lang: GameLanguage;
  startRelPath?: string; // folder inside game filesystem root
  minimized?: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onOpenNotes: (relPath: string) => void;
  onOpenScript: (relPath: string) => void;
  onOpenMedia: (relPath: string) => void;
};

function extLower(entry: FsEntry): string {
  return (entry.ext ?? "").toLowerCase();
}

function isDir(e: FsEntry) {
  return e.kind === "dir";
}

export function FilesApp({
  lang,
  startRelPath = "",
  minimized,
  onMinimize,
  onClose,
  onOpenNotes,
  onOpenScript,
  onOpenMedia
}: Props) {
  const [currentRel, setCurrentRel] = useState(startRelPath);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [selectedRel, setSelectedRel] = useState<string | null>(null);

  const [draggingRelPath, setDraggingRelPath] = useState<string | null>(null);
  const [dragOverDirRelPath, setDragOverDirRelPath] = useState<string | null>(null);
  const [windowMsg, setWindowMsg] = useState<string | null>(null);

  const [rootFsPath, setRootFsPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [ctxRel, setCtxRel] = useState<string | null>(null);
  const [ctxIsDir, setCtxIsDir] = useState(false);
  const ctxRef = useRef<HTMLDivElement | null>(null);

  const visibleTitle = useMemo(() => {
    if (!currentRel) return lang === "ru" ? "Файлы — Корень" : "Files — Root";
    return lang === "ru" ? `Файлы — ${currentRel}` : `Files — ${currentRel}`;
  }, [currentRel, lang]);

  const refresh = async (rel = currentRel) => {
    await initGameFs();
    const items = await listFs(rel);
    setEntries(items);
  };

  useEffect(() => {
    void (async () => {
      try {
        const p = await getGameFilesRootPath();
        setRootFsPath(p);
      } catch {
        // Best-effort: filesystem root path is only for display.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh(startRelPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh(currentRel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRel]);

  const goUp = () => {
    if (!currentRel) return;
    const parts = currentRel.split("/").filter(Boolean);
    parts.pop();
    setCurrentRel(parts.join("/"));
    setSelectedRel(null);
  };

  const selectedEntry = useMemo(() => entries.find((e) => e.relPath === selectedRel) ?? null, [entries, selectedRel]);

  const displayedEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, searchQuery]);

  const safeChildRel = (dirRel: string | null, nameRaw: string) => {
    const safe = nameRaw.trim().replace(/[<>:"/\\|?*]+/g, "_").replace(/\.+$/g, "").trim();
    if (!safe) return null;
    const prefix = dirRel ? `${dirRel}/` : "";
    return `${prefix}${safe}`;
  };

  const createFolderAt = async (dirRel: string | null) => {
    const name = window.prompt(lang === "ru" ? "Имя папки:" : "Folder name:");
    if (!name) return;
    const rel = safeChildRel(dirRel, name);
    if (!rel) return;
    try {
      await mkdirFs(rel);
      setWindowMsg(lang === "ru" ? "Папка создана" : "Folder created");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWindowMsg(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
    }
  };

  const createTextFileAt = async (dirRel: string | null, ext: "txt" | "md") => {
    const name = window.prompt(lang === "ru" ? `Имя файла (*.${ext}):` : `File name (*.${ext}):`);
    if (!name) return;
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWindowMsg(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
    }
  };

  const createHackFileAt = async (dirRel: string | null) => {
    const name = window.prompt(lang === "ru" ? "Имя HackScript файла (*.hack):" : "HackScript file name (*.hack):");
    if (!name) return;
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWindowMsg(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
    }
  };

  const deleteEntryAt = async (relPath: string) => {
    try {
      await deleteFs(relPath);
      setSelectedRel(null);
      setWindowMsg(lang === "ru" ? "Удалено" : "Deleted");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWindowMsg(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
    }
  };

  const renameEntryAt = async (relPath: string) => {
    const entry = entries.find((e) => e.relPath === relPath);
    if (!entry) return;
    const currentParent = relPath.includes("/") ? relPath.split("/").slice(0, -1).join("/") : "";
    const currentBase = relPath.split("/").filter(Boolean).pop() ?? entry.name;
    const name = window.prompt(
      lang === "ru" ? `Новое имя для (${currentBase}):` : `New name for (${currentBase}):`,
      currentBase
    );
    if (!name) return;
    const dstBase = name.trim().replace(/[<>:"/\\|?*]+/g, "_").replace(/\.+$/g, "").trim();
    if (!dstBase) return;
    const dstRel = currentParent ? `${currentParent}/${dstBase}` : dstBase;
    try {
      await moveFs(relPath, dstRel);
      setSelectedRel(dstRel);
      setWindowMsg(lang === "ru" ? "Переименовано" : "Renamed");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWindowMsg(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
    }
  };

  const moveDraggedIntoDir = async (srcRel: string, dstDirRel: string) => {
    const src = srcRel;
    const baseName = src.split("/").filter(Boolean).pop();
    if (!baseName) return;
    const dst = dstDirRel ? `${dstDirRel}/${baseName}` : baseName;
    await moveFs(src, dst);
    setDraggingRelPath(null);
    setDragOverDirRelPath(null);
    setSelectedRel(dst);
    await refresh();
  };

  const onExternalFilesDrop = async (files: FileList) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setWindowMsg(lang === "ru" ? "Загрузка..." : "Uploading...");
    try {
      for (const f of arr) {
        if (!f) continue;
        const safe = f.name.replace(/[<>:"/\\|?*]+/g, "_");
        const rel = currentRel ? `${currentRel}/${safe}` : safe;
        const b64 = await fileToBase64(f);
        await writeBytesBase64Fs(rel, b64);
      }
      setWindowMsg(null);
      await refresh();
    } catch {
      setWindowMsg(lang === "ru" ? "Ошибка загрузки файла" : "File upload failed");
    }
  };

  const openEntry = (entry: FsEntry) => {
    if (entry.kind === "dir") {
      setCurrentRel(entry.relPath);
      setSelectedRel(null);
      return;
    }

    const entryExt = extLower(entry);
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(entryExt)) onOpenMedia(entry.relPath);
    else if (["mp4", "webm", "ogg"].includes(entryExt)) onOpenMedia(entry.relPath);
    else if (entryExt === "txt" || entryExt === "md") onOpenNotes(entry.relPath);
    else if (entryExt === "hack") onOpenScript(entry.relPath);
  };

  const openSelected = () => {
    if (!selectedEntry) return;
    openEntry(selectedEntry);
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

  return (
    <FloatingWindow title={visibleTitle} onClose={onClose} onMinimize={onMinimize} minimized={minimized}>
      <div className="flex h-full flex-col bg-transparent p-4">
        <div className="flex items-center gap-3 pb-3">
          <button type="button" className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10" onClick={goUp}>
            {lang === "ru" ? "Вверх" : "Up"}
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
              {rootFsPath ? `${rootFsPath}${currentRel ? `/${currentRel}` : ""}` : currentRel || (lang === "ru" ? "Корень" : "Root")}
            </div>
            <div className="mt-1">
              <input
                className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === "ru" ? "Поиск в этой папке..." : "Search in this folder..."}
                autoComplete="off"
              />
            </div>
          </div>

          <button
            type="button"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10"
            onClick={() => void refresh()}
            title={lang === "ru" ? "Обновить список" : "Refresh list"}
          >
            {lang === "ru" ? "Обновить" : "Refresh"}
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto"
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
            const internal = e.dataTransfer.getData("application/x-zeroday-fs-relpath");
            if (internal || e.dataTransfer.files?.length) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const internal = e.dataTransfer.getData("application/x-zeroday-fs-relpath");
            if (internal) {
              // Drop into currentRel (if current item is dir or root)
              if (!currentRel) {
                void (async () => {
                  const baseName = internal.split("/").filter(Boolean).pop();
                  if (!baseName) return;
                  await moveFs(internal, baseName);
                  setDraggingRelPath(null);
                  setDragOverDirRelPath(null);
                  await refresh();
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
          <div className="space-y-2">
            {displayedEntries.map((e) => {
              const selected = e.relPath === selectedRel;
              const isDragOver = dragOverDirRelPath === e.relPath && e.kind === "dir";
              return (
                <div
                  key={e.relPath}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                    selected
                      ? "border-[#2dd4bf] bg-white/5"
                      : isDragOver
                        ? "border-[#2dd4bf] bg-white/10"
                        : "border-white/10 bg-white/0"
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRel(e.relPath)}
                  onContextMenu={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    setSelectedRel(e.relPath);
                    setCtxRel(e.relPath);
                    setCtxIsDir(e.kind === "dir");
                    setCtxPos({
                      x: Math.min(ev.clientX, window.innerWidth - 260),
                      y: Math.min(ev.clientY, window.innerHeight - 220)
                    });
                    setCtxOpen(true);
                  }}
                  onDoubleClick={() => openSelected()}
                  draggable
                  onDragStart={(ev) => {
                    if (ev.dataTransfer) {
                      ev.dataTransfer.effectAllowed = "move";
                      ev.dataTransfer.setData("application/x-zeroday-fs-relpath", e.relPath);
                    }
                    setDraggingRelPath(e.relPath);
                    setDragOverDirRelPath(null);
                  }}
                  onDragEnd={() => {
                    setDraggingRelPath(null);
                    setDragOverDirRelPath(null);
                  }}
                  onDragOver={(ev) => {
                    if (e.kind !== "dir") return;
                    if (ev.dataTransfer.getData("application/x-zeroday-fs-relpath")) {
                      ev.preventDefault();
                      setDragOverDirRelPath(e.relPath);
                    }
                  }}
                  onDrop={(ev) => {
                    if (e.kind !== "dir") return;
                    ev.preventDefault();
                    const internal = ev.dataTransfer.getData("application/x-zeroday-fs-relpath");
                    if (!internal) return;
                    if (internal === e.relPath) return;
                    void moveDraggedIntoDir(internal, e.relPath);
                  }}
                >
                  <span className="inline-flex w-6 justify-center" aria-hidden="true">
                    {e.kind === "dir" ? "▦" : "▣"}
                  </span>
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{e.name}</span>
                  <span className="text-xs text-slate-400">{e.kind === "dir" ? "" : e.ext ? `.${e.ext}` : ""}</span>
                </div>
              );
            })}
            {!displayedEntries.length ? (
              <div className="py-10 text-center text-sm text-slate-400">{lang === "ru" ? "Пусто" : "Empty"}</div>
            ) : null}
          </div>
        </div>

        {/* RMB context menu */}
        {ctxOpen ? (
          <div
            ref={ctxRef}
            className="desktop-ctx-menu"
            style={{
              left: ctxPos.x,
              top: ctxPos.y
            }}
            role="menu"
            aria-label={lang === "ru" ? "Меню файлов" : "Files menu"}
          >
            {(() => {
              const targetDirRel = ctxIsDir && ctxRel ? ctxRel : currentRel;
              const targetEntry = ctxEntry;
              const canMakeNotes = Boolean(targetDirRel?.startsWith("Notes"));
              const canMakeScripts = Boolean(targetDirRel?.startsWith("Scripts"));

              return (
                <>
                  {targetEntry ? (
                    <div
                      className="desktop-ctx-item"
                      role="menuitem"
                      onClick={() => {
                        setCtxOpen(false);
                        openEntry(targetEntry);
                      }}
                    >
                      <span className="desktop-ctx-ico" aria-hidden="true">
                        {targetEntry.kind === "dir" ? "▶" : "⟐"}
                      </span>
                      <span>{lang === "ru" ? "Открыть" : "Open"}</span>
                    </div>
                  ) : null}

                  <div
                    className="desktop-ctx-item"
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
                  </div>

                  <div
                    className="desktop-ctx-item"
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
                  </div>

                  {canMakeNotes ? (
                    <>
                      <div
                        className="desktop-ctx-item"
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
                      </div>
                      <div
                        className="desktop-ctx-item"
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
                      </div>
                    </>
                  ) : null}

                  {canMakeScripts ? (
                    <div
                      className="desktop-ctx-item"
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
                    </div>
                  ) : null}

                  {targetEntry ? (
                    <div
                      className="desktop-ctx-item"
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
                    </div>
                  ) : null}

                  {targetEntry ? (
                    <div
                      className="desktop-ctx-item"
                      role="menuitem"
                      onClick={() => {
                        setCtxOpen(false);
                        void deleteEntryAt(targetEntry.relPath);
                      }}
                    >
                      <span className="desktop-ctx-ico" aria-hidden="true">
                        🗑
                      </span>
                      <span>{lang === "ru" ? "Удалить" : "Delete"}</span>
                    </div>
                  ) : null}

                  {targetEntry ? (
                    <div
                      className="desktop-ctx-item"
                      role="menuitem"
                      onClick={() => {
                        setCtxOpen(false);
                        setWindowMsg(
                          lang === "ru"
                            ? `Свойства: ${targetEntry.relPath} (${targetEntry.kind}${targetEntry.ext ? `.${targetEntry.ext}` : ""}, ${targetEntry.size} bytes)`
                            : `Properties: ${targetEntry.relPath} (${targetEntry.kind}${targetEntry.ext ? `.${targetEntry.ext}` : ""}, ${targetEntry.size} bytes)`
                        );
                      }}
                    >
                      <span className="desktop-ctx-ico" aria-hidden="true">
                        ℹ
                      </span>
                      <span>{lang === "ru" ? "Свойства" : "Properties"}</span>
                    </div>
                  ) : (
                    <div
                      className="desktop-ctx-item"
                      role="menuitem"
                      onClick={() => {
                        setCtxOpen(false);
                        setWindowMsg(
                          lang === "ru"
                            ? `Папка: ${currentRel || "root"}`
                            : `Folder: ${currentRel || "root"}`
                        );
                      }}
                    >
                      <span className="desktop-ctx-ico" aria-hidden="true">
                        ℹ
                      </span>
                      <span>{lang === "ru" ? "О папке" : "Folder info"}</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const files = e.target.files;
            if (files?.length) void onExternalFilesDrop(files);
            e.currentTarget.value = "";
          }}
        />

        <div className="pt-3 text-xs text-slate-400">
          {windowMsg
            ? windowMsg
            : lang === "ru"
              ? draggingRelPath
                ? `Перетащи в папку, чтобы переместить: ${draggingRelPath}`
                : "Перетаскивай файлы между папками. Можно также перетащить файлы из проводника."
              : draggingRelPath
                ? `Drag into a folder to move: ${draggingRelPath}`
                : "Drag files into folders to move. You can also drop files from Explorer."}
        </div>
      </div>
    </FloatingWindow>
  );
}

