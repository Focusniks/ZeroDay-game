import { useEffect, useMemo, useRef, useState } from "react";
import { FloatingWindow } from "../window/FloatingWindow";
import { initGameFs, readTextFs, writeTextFs } from "../../lib/gameFs";
import type { GameLanguage } from "../../lib/gameConfig";

type Props = {
  lang: GameLanguage;
  minimized?: boolean;
  initialRelPath?: string; // file inside Notes/...
  onMinimize: () => void;
  onClose: () => void;
};

export function NotesApp({ lang, minimized = false, initialRelPath, onMinimize, onClose }: Props) {
  const [activeRelPath, setActiveRelPath] = useState<string | null>(initialRelPath ?? null);
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");

  const title = useMemo(() => (lang === "ru" ? "Редактор заметок" : "Notes editor"), [lang]);

  useEffect(() => {
    void initGameFs();
  }, []);

  useEffect(() => {
    setActiveRelPath(initialRelPath ?? null);
  }, [initialRelPath]);

  useEffect(() => {
    if (!activeRelPath) {
      setText("");
      setSavedText("");
      return;
    }
    void (async () => {
      const content = await readTextFs(activeRelPath);
      setText(content);
      setSavedText(content);
    })();
  }, [activeRelPath]);

  const dirty = Boolean(activeRelPath) && text !== savedText;

  const save = async () => {
    if (!activeRelPath) return;
    await writeTextFs(activeRelPath, text);
    setSavedText(text);
  };

  const reload = async () => {
    if (!activeRelPath) return;
    const content = await readTextFs(activeRelPath);
    setText(content);
    setSavedText(content);
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

  return (
    <FloatingWindow title={title} onClose={onClose} onMinimize={onMinimize} minimized={minimized}>
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-300">
              {lang === "ru" ? "Заметки" : "Notes"}{" "}
              {dirty ? <span className="text-[#2dd4bf] ml-2" aria-hidden="true">●</span> : null}
            </div>
            <div className="text-[11px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
              {activeRelPath ? activeRelPath : lang === "ru" ? "Откройте заметку из папки" : "Open a note from the folder"}
            </div>
          </div>
          <div className="text-[11px] text-slate-500">{lang === "ru" ? "ПКМ: Save / Reload" : "RMB: Save / Reload"}</div>
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
            <textarea
              className="h-full w-full resize-none rounded-lg border border-white/10 bg-white/5 p-3 font-mono text-xs outline-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
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
            aria-label={lang === "ru" ? "Меню заметок" : "Notes menu"}
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
          </div>
        ) : null}
      </div>
    </FloatingWindow>
  );
}

