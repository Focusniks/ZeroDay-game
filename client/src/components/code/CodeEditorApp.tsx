import { useEffect, useMemo, useRef, useState } from "react";
import { FloatingWindow } from "../window/FloatingWindow";
import { initGameFs, listFs, readTextFs, writeTextFs, mkdirFs } from "../../lib/gameFs";
import { TextPromptDialog } from "../dialog/TextPromptDialog";
import type { GameLanguage } from "../../lib/gameConfig";
import type { FsEntry } from "../../lib/gameFs";

type Props = {
  lang: GameLanguage;
  minimized?: boolean;
  initialRelPath?: string;
  onMinimize: () => void;
  onClose: () => void;
  onRunInTerminal: (scriptRelPath: string) => void;
  onFocus?: () => void;
  zIndex?: number;
};

export function CodeEditorApp({
  lang,
  minimized = false,
  initialRelPath,
  onMinimize,
  onClose,
  onRunInTerminal,
  onFocus,
  zIndex
}: Props) {
  const [activeRelPath, setActiveRelPath] = useState<string | null>(initialRelPath ?? null);
  const [source, setSource] = useState("");
  const [savedSource, setSavedSource] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  const [autocompleteCycle, setAutocompleteCycle] = useState<{ prefix: string; idx: number; matches: string[] } | null>(null);

  const title = useMemo(() => (lang === "ru" ? "Редактор HackScript" : "HackScript Editor"), [lang]);

  // File browser state
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [browserPath, setBrowserPath] = useState("Scripts");
  const [browserEntries, setBrowserEntries] = useState<FsEntry[]>([]);
  const [browserMode, setBrowserMode] = useState<"open" | "saveAs">("open");

  // New file dialog
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);

  // Save As dialog
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);

  useEffect(() => {
    void initGameFs();
  }, []);

  useEffect(() => {
    setActiveRelPath(initialRelPath ?? null);
  }, [initialRelPath]);

  useEffect(() => {
    if (!activeRelPath) {
      setSource("");
      setSavedSource("");
      return;
    }
    void (async () => {
      const content = await readTextFs(activeRelPath);
      setSource(content);
      setSavedSource(content);
    })();
  }, [activeRelPath]);

  const dirty = Boolean(activeRelPath) && source !== savedSource;

  const save = async () => {
    if (!activeRelPath) return;
    await writeTextFs(activeRelPath, source);
    setSavedSource(source);
  };

  const saveAs = async (newPath: string) => {
    await writeTextFs(newPath, source);
    setActiveRelPath(newPath);
    setSavedSource(source);
  };

  const reload = async () => {
    if (!activeRelPath) return;
    const content = await readTextFs(activeRelPath);
    setSource(content);
    setSavedSource(content);
  };

  const run = () => {
    if (!activeRelPath) return;
    onRunInTerminal(activeRelPath);
  };

  const createNewFile = async (fileName: string) => {
    const basePath = browserPath || "Scripts";
    const fullPath = `${basePath}/${fileName}`;
    await writeTextFs(fullPath, "");
    setActiveRelPath(fullPath);
    setSource("");
    setSavedSource("");
    setShowNewFileDialog(false);
  };

  const openFileBrowser = (mode: "open" | "saveAs", path?: string) => {
    setBrowserMode(mode);
    setBrowserPath(path || "Scripts");
    setShowFileBrowser(true);
  };

  const loadFileFromBrowser = async (entry: FsEntry) => {
    if (entry.kind === "dir") {
      setBrowserPath(entry.relPath);
    } else if (entry.name.endsWith(".hack")) {
      const content = await readTextFs(entry.relPath);
      setActiveRelPath(entry.relPath);
      setSource(content);
      setSavedSource(content);
      setShowFileBrowser(false);
    }
  };

  useEffect(() => {
    if (!showFileBrowser) return;
    void (async () => {
      try {
        const entries = await listFs(browserPath);
        setBrowserEntries(entries);
      } catch {
        setBrowserEntries([]);
      }
    })();
  }, [showFileBrowser, browserPath]);

  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const ctxRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeRelPath, source, savedSource]);

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const keywords = useMemo(() => new Set(["print", "for", "in", "range"]), []);

  const highlightLine = (line: string): string => {
    let i = 0;
    let out = "";

    while (i < line.length) {
      const c = line[i]!;

      // Comment: everything after # (not inside strings)
      if (c === "#") {
        const rest = line.slice(i);
        out += `<span class="hs-comment">${escapeHtml(rest)}</span>`;
        break;
      }

      // Strings
      if (c === "'" || c === '"') {
        const quote = c;
        let j = i + 1;
        let escaped = false;
        while (j < line.length) {
          const cc = line[j]!;
          if (escaped) {
            escaped = false;
            j++;
            continue;
          }
          if (cc === "\\") {
            escaped = true;
            j++;
            continue;
          }
          if (cc === quote) {
            j++;
            break;
          }
          j++;
        }
        const str = line.slice(i, j);
        out += `<span class="hs-string">${escapeHtml(str)}</span>`;
        i = j;
        continue;
      }

      // Numbers
      if (/[0-9]/.test(c)) {
        let j = i + 1;
        while (j < line.length && /[0-9.]/.test(line[j]!)) j++;
        const num = line.slice(i, j);
        out += `<span class="hs-num">${escapeHtml(num)}</span>`;
        i = j;
        continue;
      }

      // Identifiers / keywords
      if (/[a-zA-Z_]/.test(c)) {
        let j = i + 1;
        while (j < line.length && /[a-zA-Z0-9_]/.test(line[j]!)) j++;
        const ident = line.slice(i, j);
        if (keywords.has(ident)) out += `<span class="hs-kw">${escapeHtml(ident)}</span>`;
        else out += escapeHtml(ident);
        i = j;
        continue;
      }

      out += escapeHtml(c);
      i++;
    }

    return out;
  };

  const highlightedHtml = useMemo(() => {
    const lines = source.split(/\r?\n/);
    return lines.map((l) => highlightLine(l)).join("\n");
  }, [source]);

  const extractVariables = (): string[] => {
    const set = new Set<string>();
    // assignments: name = expr
    for (const m of source.matchAll(/(^|\n)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*/g)) {
      const name = m[2];
      if (name) set.add(name);
    }
    // for loops: for i in range(...)
    for (const m of source.matchAll(/(^|\n)\s*for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+range\(/g)) {
      const v = m[2];
      if (v) set.add(v);
    }
    return Array.from(set);
  };

  const onTabComplete = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (ta.selectionStart !== ta.selectionEnd) return;

    const caret = ta.selectionStart ?? 0;
    if (caret === 0) return;
    const before = source.slice(0, caret);
    const m = before.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (!m) return;
    const prefix = m[1]!;

    const vars = extractVariables();
    const candidates = Array.from(new Set<string>([...keywords, ...vars]));
    const matches = candidates.filter((c) => c.toLowerCase().startsWith(prefix.toLowerCase()));
    if (!matches.length) return;

    const prev = autocompleteCycle;
    const samePrefix = prev && prev.prefix === prefix && prev.matches.length === matches.length;
    const idx = samePrefix ? (prev!.idx + 1) % matches.length : 0;
    const replacement = matches[idx]!;

    setAutocompleteCycle({ prefix, idx, matches });

    const start = caret - prefix.length;
    const nextSource = source.slice(0, start) + replacement + source.slice(caret);
    setSource(nextSource);
    return true;

    requestAnimationFrame(() => {
      const cur = taRef.current;
      if (!cur) return;
      const nextCaret = start + replacement.length;
      cur.setSelectionRange(nextCaret, nextCaret);
      cur.focus();
    });
  };

  const TAB_SPACES = "  ";

  const insertTextAtSelection = (insert: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? start;
    const nextSource = source.slice(0, start) + insert + source.slice(end);
    setSource(nextSource);

    requestAnimationFrame(() => {
      const cur = taRef.current;
      if (!cur) return;
      const caret = start + insert.length;
      cur.setSelectionRange(caret, caret);
      cur.focus();
    });
  };

  const indentSelection = (indent: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? start;
    if (start === end) {
      insertTextAtSelection(indent);
      return;
    }

    // Indent every touched line (simple behavior: prefix each line in selection).
    const selected = source.slice(start, end);
    const indented = selected
      .split("\n")
      .map((l) => `${indent}${l}`)
      .join("\n");
    const nextSource = source.slice(0, start) + indented + source.slice(end);
    setSource(nextSource);

    requestAnimationFrame(() => {
      const cur = taRef.current;
      if (!cur) return;
      cur.setSelectionRange(start, start + indented.length);
      cur.focus();
    });
  };

  const unindentSelection = () => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? start;
    if (start === end) {
      // Remove 1 indent unit from the beginning of the current line (if present).
      const lineStart = source.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const prefix = source.slice(lineStart, start);
      const m = prefix.match(/^(?:\t| {1,2})/);
      if (!m) return;
      const toRemove = m[0]!;
      const nextSource = source.slice(0, lineStart) + source.slice(lineStart + toRemove.length);
      setSource(nextSource);
      requestAnimationFrame(() => {
        const cur = taRef.current;
        if (!cur) return;
        const nextCaret = Math.max(lineStart, start - toRemove.length);
        cur.setSelectionRange(nextCaret, nextCaret);
        cur.focus();
      });
      return;
    }

    const selected = source.slice(start, end);
    const lines = selected.split("\n");
    const outLines = lines.map((l) => {
      if (l.startsWith(TAB_SPACES)) return l.slice(TAB_SPACES.length);
      if (l.startsWith("\t")) return l.slice(1);
      return l;
    });
    const outText = outLines.join("\n");
    const nextSource = source.slice(0, start) + outText + source.slice(end);
    setSource(nextSource);
    requestAnimationFrame(() => {
      const cur = taRef.current;
      if (!cur) return;
      cur.setSelectionRange(start, start + outText.length);
      cur.focus();
    });
  };

  return (
    <FloatingWindow
      title={title}
      onClose={onClose}
      onMinimize={onMinimize}
      minimized={minimized}
      onFocus={onFocus}
      zIndex={zIndex}
    >
      <div className="flex h-full flex-col gap-3 p-4">
        {/* Menu Bar */}
        <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
          <button
            className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            onClick={() => setShowNewFileDialog(true)}
          >
            {lang === "ru" ? "Новый" : "New"}
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            onClick={() => openFileBrowser("open")}
          >
            {lang === "ru" ? "Открыть" : "Open"}
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded transition-colors disabled:opacity-50"
            disabled={!activeRelPath}
            onClick={save}
          >
            {lang === "ru" ? "Сохранить" : "Save"}
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded transition-colors disabled:opacity-50"
            disabled={!activeRelPath}
            onClick={() => openFileBrowser("saveAs")}
          >
            {lang === "ru" ? "Сохранить как..." : "Save As..."}
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium bg-emerald-700 hover:bg-emerald-600 rounded transition-colors disabled:opacity-50 ml-auto"
            disabled={!activeRelPath}
            onClick={run}
          >
            {lang === "ru" ? "▶ Запустить" : "▶ Run"}
          </button>
        </div>

        {/* File path and status */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-300">
              {lang === "ru" ? "Редактор" : "Editor"}{" "}
              {dirty ? <span className="text-[#2dd4bf] ml-2" aria-hidden="true">●</span> : null}
            </div>
            <div className="text-[11px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
              {activeRelPath ? activeRelPath : lang === "ru" ? "Откройте .hack файл или создайте новый" : "Open a .hack file or create new"}
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            {lang === "ru" ? "Ctrl+S: Save, Enter: Run" : "Ctrl+S: Save, Enter: Run"}
          </div>
        </div>

        {/* Editor area */}
        <div
          className="flex-1 overflow-hidden"
          onContextMenu={(e) => {
            if (!activeRelPath) return;
            e.preventDefault();
            e.stopPropagation();
            setCtxOpen(true);
            setCtxPos({
              x: Math.min(e.clientX, window.innerWidth - 240),
              y: Math.min(e.clientY, window.innerHeight - 220)
            });
          }}
        >
          {activeRelPath ? (
            <div className="code-editor-highlight-wrap h-full">
              <pre ref={preRef} className="code-editor-highlight-pre" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
              <textarea
                ref={taRef}
                className="code-editor-textarea"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                spellCheck={false}
                onScroll={() => {
                  if (!preRef.current || !taRef.current) return;
                  preRef.current.scrollTop = taRef.current.scrollTop;
                  preRef.current.scrollLeft = taRef.current.scrollLeft;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const completed = onTabComplete();
                    if (!completed) {
                      if (e.shiftKey) unindentSelection();
                      else indentSelection(TAB_SPACES);
                    }
                    return;
                  }

                  // Keep indentation on Enter (basic editor behavior).
                  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    const ta = taRef.current;
                    if (!ta) return;
                    if (ta.selectionStart !== ta.selectionEnd) return;
                    const caret = ta.selectionStart ?? 0;
                    const lineStart = source.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;
                    const currentIndent = source.slice(lineStart, caret).match(/^[ \t]*/)?.[0] ?? "";
                    e.preventDefault();
                    insertTextAtSelection(`\n${currentIndent}`);
                  }
                }}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {lang === "ru" ? "Нет открытого файла" : "No file open"}
            </div>
          )}
        </div>

        {/* Context menu */}
        {ctxOpen ? (
          <div
            ref={ctxRef}
            className="desktop-ctx-menu"
            style={{ left: ctxPos.x, top: ctxPos.y, width: 240 }}
            role="menu"
            aria-label={lang === "ru" ? "Меню редактора" : "Editor menu"}
          >
            <div
              className="desktop-ctx-item"
              role="menuitem"
              onClick={() => {
                void save();
                setCtxOpen(false);
              }}
            >
              <span>{lang === "ru" ? "Сохранить" : "Save"}</span>
            </div>
            <div
              className="desktop-ctx-item"
              role="menuitem"
              onClick={() => {
                void reload();
                setCtxOpen(false);
              }}
            >
              <span>{lang === "ru" ? "Обновить" : "Reload"}</span>
            </div>
            <div
              className="desktop-ctx-item"
              role="menuitem"
              onClick={() => {
                run();
                setCtxOpen(false);
              }}
            >
              <span>{lang === "ru" ? "Запустить в терминале" : "Run in terminal"}</span>
            </div>
          </div>
        ) : null}

        {/* File Browser Modal */}
        {showFileBrowser && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
            <div className="w-[500px] max-h-[600px] bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-3 border-b border-slate-600">
                <h3 className="text-sm font-bold text-slate-200">
                  {browserMode === "open" ? (lang === "ru" ? "Открыть файл" : "Open File") : (lang === "ru" ? "Сохранить как" : "Save As")}
                </h3>
                <button
                  className="text-slate-400 hover:text-slate-200 text-xl leading-none"
                  onClick={() => setShowFileBrowser(false)}
                >
                  ×
                </button>
              </div>
              <div className="p-3 border-b border-slate-600">
                <div className="text-xs text-slate-400 mb-1">{lang === "ru" ? "Путь:" : "Path:"}</div>
                <div className="text-sm font-mono text-emerald-400">{browserPath}</div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {browserEntries.length === 0 ? (
                  <div className="text-sm text-slate-400 text-center py-8">
                    {lang === "ru" ? "Папка пуста" : "Folder is empty"}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {browserEntries.map((entry) => (
                      <div
                        key={entry.relPath}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          entry.kind === "dir" ? "bg-slate-700/50 hover:bg-slate-600" : entry.name.endsWith(".hack") ? "bg-emerald-900/30 hover:bg-emerald-900/50" : "bg-slate-700/30 opacity-50"
                        }`}
                        onClick={() => loadFileFromBrowser(entry)}
                      >
                        <span className="text-lg">{entry.kind === "dir" ? "📁" : entry.name.endsWith(".hack") ? "📄" : "📝"}</span>
                        <span className="text-sm text-slate-200 flex-1 truncate">{entry.name}</span>
                        {entry.kind === "file" && entry.name.endsWith(".hack") && (
                          <span className="text-xs text-emerald-400">{lang === "ru" ? "HackScript" : "HackScript"}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {browserMode === "saveAs" && (
                <div className="p-3 border-t border-slate-600">
                  <button
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded transition-colors"
                    onClick={() => setShowSaveAsDialog(true)}
                  >
                    {lang === "ru" ? "Сохранить" : "Save"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save As Dialog */}
        {showSaveAsDialog && (
          <TextPromptDialog
            open={showSaveAsDialog}
            title={lang === "ru" ? "Сохранить как" : "Save As"}
            placeholder={lang === "ru" ? "Введите имя файла:" : "Enter file name:"}
            defaultValue={activeRelPath?.split("/").pop() || "script.hack"}
            okLabel={lang === "ru" ? "Сохранить" : "Save"}
            cancelLabel={lang === "ru" ? "Отмена" : "Cancel"}
            onSubmit={(fileName) => {
              if (fileName) {
                const cleanName = fileName.endsWith(".hack") ? fileName : `${fileName}.hack`;
                void saveAs(`${browserPath}/${cleanName}`);
                setShowSaveAsDialog(false);
                setShowFileBrowser(false);
              }
            }}
          />
        )}

        {/* New File Dialog */}
        {showNewFileDialog && (
          <TextPromptDialog
            open={showNewFileDialog}
            title={lang === "ru" ? "Новый файл HackScript" : "New HackScript File"}
            placeholder={lang === "ru" ? "Введите имя файла (например, script.hack):" : "Enter file name (e.g., script.hack):"}
            defaultValue="script.hack"
            okLabel={lang === "ru" ? "Создать" : "Create"}
            cancelLabel={lang === "ru" ? "Отмена" : "Cancel"}
            onSubmit={(fileName) => {
              if (fileName) {
                void createNewFile(fileName.endsWith(".hack") ? fileName : `${fileName}.hack`);
              }
            }}
          />
        )}
      </div>
    </FloatingWindow>
  );
}

