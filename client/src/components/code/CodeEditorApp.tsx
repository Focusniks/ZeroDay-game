import { useEffect, useMemo, useRef, useState } from "react";
import { FloatingWindow } from "../window/FloatingWindow";
import { initGameFs, readTextFs, writeTextFs } from "../../lib/gameFs";
import type { GameLanguage } from "../../lib/gameConfig";

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

    requestAnimationFrame(() => {
      const cur = taRef.current;
      if (!cur) return;
      const nextCaret = start + replacement.length;
      cur.setSelectionRange(nextCaret, nextCaret);
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
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-300">
              {lang === "ru" ? "Редактор" : "Editor"}{" "}
              {dirty ? <span className="text-[#2dd4bf] ml-2" aria-hidden="true">●</span> : null}
            </div>
            <div className="text-[11px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
              {activeRelPath ? activeRelPath : lang === "ru" ? "Откройте .hack файл из папки" : "Open a .hack file from the folder"}
            </div>
          </div>
          <div className="text-[11px] text-slate-500">{lang === "ru" ? "ПКМ: Save / Run" : "RMB: Save / Run"}</div>
        </div>

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
                    onTabComplete();
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
      </div>
    </FloatingWindow>
  );
}

