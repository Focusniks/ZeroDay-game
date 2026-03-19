import { useEffect, useMemo, useRef, useState } from "react";
import type { GameLanguage } from "../../lib/gameConfig";
import { useGameConfig } from "../../hooks/useGameConfig";
import { INSTALL_TIMEZONES, getDefaultTimezoneId } from "../../data/timezones";

type Props = {
  lang: GameLanguage;
  onClose: () => void;
  onMinimize: () => void;
  minimized?: boolean;
};

export function SettingsApp({ lang, onClose, onMinimize, minimized = false }: Props) {
  const [activeTab, setActiveTab] = useState<"system" | "profile">("system");
  const { config, patchConfig } = useGameConfig();

  const title = useMemo(() => (lang === "ru" ? "Параметры" : "Settings"), [lang]);
  const tabSystem = useMemo(() => (lang === "ru" ? "Система" : "System"), [lang]);
  const tabProfile = useMemo(() => (lang === "ru" ? "Профиль" : "Profile"), [lang]);

  const [termRect, setTermRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [maximized, setMaximized] = useState(false);
  const maximizedRef = useRef(maximized);
  const prevRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [maximizedTick, setMaximizedTick] = useState(0);
  useEffect(() => {
    maximizedRef.current = maximized;
  }, [maximized]);

  const [resizingTick, setResizingTick] = useState(0);
  const resizingRef = useRef<{
    dir: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
    startX: number;
    startY: number;
    startRect: { x: number; y: number; w: number; h: number };
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const taskbarH = 48;
      const pad = 10;

      const getDefaultRect = () => {
        const w = Math.min(560, Math.floor(vw * 0.66));
        const h = Math.min(520, Math.floor((vh - taskbarH) * 0.7));
        const x = Math.max(10, Math.floor((vw - w) / 2));
        const y = Math.max(10, Math.floor((vh - taskbarH - h) / 2));
        return { x, y, w, h };
      };

      const getMaxRect = () => {
        const w = Math.max(320, vw - pad * 2);
        const h = Math.max(220, vh - taskbarH - pad * 2);
        return { x: pad, y: pad, w, h };
      };

      setTermRect(maximizedRef.current ? getMaxRect() : getDefaultRect());
    };

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !termRect) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = termRect.w;
      const h = termRect.h;

      const nextX = Math.min(Math.max(0, dragRef.current.originX + dx), vw - w);
      const nextY = Math.min(Math.max(0, dragRef.current.originY + dy), vh - h);
      setTermRect({ ...termRect, x: nextX, y: nextY });
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [termRect]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      if (maximizedRef.current) return;

      const { dir, startX, startRect } = r;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const taskbarH = 48;
      const minW = 320;
      const minH = 220;

      let x = startRect.x;
      let y = startRect.y;
      let w = startRect.w;
      let h = startRect.h;

      const dx = e.clientX - startX;
      const dy = e.clientY - r.startY;

      // Horizontal
      if (dir === "e" || dir === "ne" || dir === "se") {
        w = startRect.w + dx;
      }
      if (dir === "w" || dir === "nw" || dir === "sw") {
        x = startRect.x + dx;
        w = startRect.w - dx;
      }

      // Vertical
      if (dir === "s" || dir === "se" || dir === "sw") {
        h = startRect.h + dy;
      }
      if (dir === "n" || dir === "ne" || dir === "nw") {
        y = startRect.y + dy;
        h = startRect.h - dy;
      }

      w = Math.max(minW, w);
      h = Math.max(minH, h);

      x = Math.min(Math.max(0, x), vw - w);
      y = Math.min(Math.max(0, y), vh - taskbarH - h);

      h = Math.min(h, vh - taskbarH - y);
      w = Math.min(w, vw - x);

      setTermRect({ x, y, w, h });
    };

    const onUp = () => {
      resizingRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const toggleMaximize = () => {
    if (!termRect) return;
    if (maximizedRef.current) {
      setMaximized(false);
      setTermRect(prevRectRef.current ?? termRect);
      prevRectRef.current = null;
      setMaximizedTick((v) => v + 1);
      return;
    }
    prevRectRef.current = termRect;
    setMaximized(true);
    const taskbarH = 48;
    const pad = 10;
    setTermRect({
      x: pad,
      y: pad,
      w: Math.max(320, window.innerWidth - pad * 2),
      h: Math.max(220, window.innerHeight - taskbarH - pad * 2)
    });
    setMaximizedTick((v) => v + 1);
  };

  return (
    <div
      className={`settings-window fixed z-[75] relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl transition-all duration-180 ease-out ${
        minimized ? "pointer-events-none opacity-0 scale-95" : ""
      }`}
      style={
        termRect
          ? {
              left: termRect.x,
              top: termRect.y,
              width: termRect.w,
              height: termRect.h
            }
          : undefined
      }
      role="dialog"
      aria-label={title}
    >
      <div
        className="flex cursor-grab items-center justify-between border-b border-white/10 bg-[#2d3139] px-4 py-2.5"
        onMouseDown={(e) => {
          const target = e.target as HTMLElement | null;
          if (target && (target.closest("button") || target.closest("input") || target.closest(".resize-handle"))) return;
          if (maximizedRef.current) return;
          if (!termRect) return;
          dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            originX: termRect.x,
            originY: termRect.y
          };
        }}
        role="presentation"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="close"
            className="h-3 w-3 rounded-full bg-[#ff5f57] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
          />
          <button
            type="button"
            aria-label="minimize"
            className="h-3 w-3 rounded-full bg-[#febc2e] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onMinimize}
          />
          <button
            type="button"
            aria-label="maximize"
            className="h-3 w-3 rounded-full bg-[#28c840] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleMaximize}
          />
        </div>
        <div className="flex-1 text-center text-xs text-slate-400">{title}</div>
        <div className="w-16" />
      </div>

      {!maximized && (
        <>
          <div
            className="resize-handle resize-handle--n"
            onPointerDown={(e) => {
              if (!termRect) return;
              e.stopPropagation();
              e.preventDefault();
              resizingRef.current = {
                dir: "n",
                startX: e.clientX,
                startY: e.clientY,
                startRect: termRect,
                pointerId: e.pointerId
              };
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              setResizingTick((v) => v + 1);
            }}
          />
          <div
            className="resize-handle resize-handle--s"
            onPointerDown={(e) => {
              if (!termRect) return;
              e.stopPropagation();
              e.preventDefault();
              resizingRef.current = {
                dir: "s",
                startX: e.clientX,
                startY: e.clientY,
                startRect: termRect,
                pointerId: e.pointerId
              };
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              setResizingTick((v) => v + 1);
            }}
          />
          <div
            className="resize-handle resize-handle--e"
            onPointerDown={(e) => {
              if (!termRect) return;
              e.stopPropagation();
              e.preventDefault();
              resizingRef.current = {
                dir: "e",
                startX: e.clientX,
                startY: e.clientY,
                startRect: termRect,
                pointerId: e.pointerId
              };
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              setResizingTick((v) => v + 1);
            }}
          />
          <div
            className="resize-handle resize-handle--w"
            onPointerDown={(e) => {
              if (!termRect) return;
              e.stopPropagation();
              e.preventDefault();
              resizingRef.current = {
                dir: "w",
                startX: e.clientX,
                startY: e.clientY,
                startRect: termRect,
                pointerId: e.pointerId
              };
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              setResizingTick((v) => v + 1);
            }}
          />

          <div
            className="resize-handle resize-handle--nw"
            onPointerDown={(e) => {
              if (!termRect) return;
              e.stopPropagation();
              e.preventDefault();
              resizingRef.current = { dir: "nw", startX: e.clientX, startY: e.clientY, startRect: termRect, pointerId: e.pointerId };
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              setResizingTick((v) => v + 1);
            }}
          />
          <div
            className="resize-handle resize-handle--ne"
            onPointerDown={(e) => {
              if (!termRect) return;
              e.stopPropagation();
              e.preventDefault();
              resizingRef.current = { dir: "ne", startX: e.clientX, startY: e.clientY, startRect: termRect, pointerId: e.pointerId };
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              setResizingTick((v) => v + 1);
            }}
          />
          <div
            className="resize-handle resize-handle--sw"
            onPointerDown={(e) => {
              if (!termRect) return;
              e.stopPropagation();
              e.preventDefault();
              resizingRef.current = { dir: "sw", startX: e.clientX, startY: e.clientY, startRect: termRect, pointerId: e.pointerId };
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              setResizingTick((v) => v + 1);
            }}
          />
          <div
            className="resize-handle resize-handle--se"
            onPointerDown={(e) => {
              if (!termRect) return;
              e.stopPropagation();
              e.preventDefault();
              resizingRef.current = { dir: "se", startX: e.clientX, startY: e.clientY, startRect: termRect, pointerId: e.pointerId };
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              setResizingTick((v) => v + 1);
            }}
          />
        </>
      )}

      <div className="settings-body flex min-h-0 flex-1">
        <div className="settings-tabs w-52 border-r border-white/10 bg-[#0d1117] p-3">
          <button
            type="button"
            className={`settings-tab-btn w-full rounded-lg px-3 py-2 text-left text-sm ${
              activeTab === "system" ? "bg-white/10" : "hover:bg-white/5"
            }`}
            onClick={() => setActiveTab("system")}
          >
            {tabSystem}
          </button>
          <button
            type="button"
            className={`settings-tab-btn w-full rounded-lg px-3 py-2 text-left text-sm ${
              activeTab === "profile" ? "bg-white/10" : "hover:bg-white/5"
            }`}
            onClick={() => setActiveTab("profile")}
          >
            {tabProfile}
          </button>
        </div>

        <div className="settings-content flex-1 overflow-auto p-4">
          {activeTab === "system" ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-300">
                {lang === "ru" ? "Настройка окружения ZeroDay." : "Configure ZeroDay environment."}
              </div>

              <div className="space-y-2">
                <div className="text-sm text-slate-200">{lang === "ru" ? "Язык интерфейса" : "Interface language"}</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`rounded-md border px-3 py-1 text-xs ${
                      lang === "ru" ? "border-[#2dd4bf] bg-white/5" : "border-white/10 bg-white/0 hover:bg-white/5"
                    }`}
                    onClick={() => void patchConfig({ gameLanguage: "ru" })}
                  >
                    RU
                  </button>
                  <button
                    type="button"
                    className={`rounded-md border px-3 py-1 text-xs ${
                      lang === "en" ? "border-[#2dd4bf] bg-white/5" : "border-white/10 bg-white/0 hover:bg-white/5"
                    }`}
                    onClick={() => void patchConfig({ gameLanguage: "en" })}
                  >
                    EN
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-slate-200">{lang === "ru" ? "Часовой пояс (IANA)" : "Timezone (IANA)"}</div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-2">
                  {INSTALL_TIMEZONES.map((tz) => {
                    const active = (config.timezone ?? getDefaultTimezoneId()) === tz.id;
                    return (
                      <button
                        key={tz.id}
                        type="button"
                        className={`mb-1 w-full rounded-md px-3 py-2 text-left text-xs ${
                          active ? "border border-[#2dd4bf] bg-white/5" : "border border-transparent hover:bg-white/10"
                        }`}
                        onClick={() => void patchConfig({ timezone: tz.id })}
                      >
                        {lang === "ru" ? tz.regionRu : tz.regionEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-slate-300">
                {lang === "ru"
                  ? "Профиль будет управляться после загрузки данных аккаунта."
                  : "Profile controls will be wired after account data loads."}
              </div>
              <div className="settings-row flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-sm text-slate-200">{lang === "ru" ? "Публичное имя" : "Display name"}</div>
                <div className="text-xs text-slate-300">{lang === "ru" ? "пользователь" : "user"}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

