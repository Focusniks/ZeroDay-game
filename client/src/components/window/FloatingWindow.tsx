import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { GameLanguage } from "../../lib/gameConfig";

const TASKBAR_SAFE_HEIGHT = 72;
let floatingSpawnSeq = 0;

type Props = {
  lang?: GameLanguage;
  title: ReactNode;
  onClose: () => void;
  onMinimize: () => void;
  minimized?: boolean;
  children: ReactNode;
  /** Bring this window to front when user interacts with it. */
  onFocus?: () => void;
  zIndex?: number;
};

export function FloatingWindow({
  title,
  onClose,
  onMinimize,
  minimized = false,
  children,
  onFocus,
  zIndex
}: Props) {
  const spawnOffsetRef = useRef((floatingSpawnSeq++ % 8) * 22);
  const [termRect, setTermRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const termRectRef = useRef(termRect);
  const [maximized, setMaximized] = useState(false);
  const maximizedRef = useRef(maximized);
  const prevRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    pointerId: number;
  } | null>(null);

  const resizingRef = useRef<{
    dir: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
    startX: number;
    startY: number;
    startRect: { x: number; y: number; w: number; h: number };
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    maximizedRef.current = maximized;
  }, [maximized]);

  useEffect(() => {
    termRectRef.current = termRect;
  }, [termRect]);

  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const taskbarH = TASKBAR_SAFE_HEIGHT;
      const pad = 10;

      const getDefaultRect = () => {
        const w = Math.min(900, Math.floor(vw * 0.78));
        const h = Math.min(700, Math.floor((vh - taskbarH) * 0.76));
        const off = spawnOffsetRef.current;
        const x = Math.min(Math.max(10, Math.floor((vw - w) / 2) + off), vw - w - 10);
        const y = Math.min(Math.max(10, Math.floor((vh - taskbarH - h) / 2) + off), vh - taskbarH - h - 10);
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
    const onMove = (e: PointerEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      if (maximizedRef.current) return;

      const { dir, startX, startRect } = r;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const taskbarH = TASKBAR_SAFE_HEIGHT;
      const minW = 320;
      const minH = 220;

      let x = startRect.x;
      let y = startRect.y;
      let w = startRect.w;
      let h = startRect.h;

      const dx = e.clientX - startX;
      const dy = e.clientY - r.startY;

      if (dir === "e" || dir === "ne" || dir === "se") w = startRect.w + dx;
      if (dir === "w" || dir === "nw" || dir === "sw") {
        x = startRect.x + dx;
        w = startRect.w - dx;
      }
      if (dir === "s" || dir === "se" || dir === "sw") h = startRect.h + dy;
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

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = dragRef.current;
      const cur = termRectRef.current;
      if (!r || !cur) return;
      if (e.pointerId !== r.pointerId) return;
      if (maximizedRef.current) return;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const taskbarH = TASKBAR_SAFE_HEIGHT;
      const nextX = Math.min(Math.max(0, r.originX + dx), vw - cur.w);
      const nextY = Math.min(Math.max(0, r.originY + dy), vh - taskbarH - cur.h);
      setTermRect((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev));
    };

    const onUp = () => {
      dragRef.current = null;
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
      return;
    }
    prevRectRef.current = termRect;
    setMaximized(true);
    const taskbarH = TASKBAR_SAFE_HEIGHT;
    const pad = 10;
    setTermRect({
      x: pad,
      y: pad,
      w: Math.max(320, window.innerWidth - pad * 2),
      h: Math.max(220, window.innerHeight - taskbarH - pad * 2)
    });
  };

  return (
    <div
      className={`terminal-window fixed z-[75] relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl transition-all duration-180 ease-out ${
        minimized ? "pointer-events-none opacity-0 scale-95" : ""
      }`}
      onMouseDown={() => onFocus?.()}
      style={
        termRect
          ? {
              left: termRect.x,
              top: termRect.y,
              width: termRect.w,
              height: termRect.h,
              ...(zIndex !== undefined ? { zIndex } : {})
            }
          : zIndex !== undefined
            ? { zIndex }
            : undefined
      }
    >
      <div
        className="flex cursor-grab items-center justify-between border-b border-white/10 bg-[#2d3139] px-4 py-2.5"
        onPointerDown={(e) => {
          const target = e.target as HTMLElement | null;
          if (target && (target.closest("button") || target.closest("input") || target.closest(".resize-handle"))) return;
          if (maximizedRef.current) return;
          if (!termRect) return;
          e.preventDefault();
          e.stopPropagation();
          dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            originX: termRect.x,
            originY: termRect.y,
            pointerId: e.pointerId
          };
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
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

      {!maximized ? (
        <>
          <div
            className="resize-handle resize-handle--n"
            onPointerDown={(e) => {
              onFocus?.();
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
            }}
          />
          <div
            className="resize-handle resize-handle--s"
            onPointerDown={(e) => {
              onFocus?.();
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
            }}
          />
          <div
            className="resize-handle resize-handle--e"
            onPointerDown={(e) => {
              onFocus?.();
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
            }}
          />
          <div
            className="resize-handle resize-handle--w"
            onPointerDown={(e) => {
              onFocus?.();
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
            }}
          />

          <div
            className="resize-handle resize-handle--nw"
            onPointerDown={(e) => {
              onFocus?.();
              if (!termRect) return;
              e.stopPropagation();
              e.preventDefault();
              resizingRef.current = {
                dir: "nw",
                startX: e.clientX,
                startY: e.clientY,
                startRect: termRect,
                pointerId: e.pointerId
              };
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            }}
          />
          <div
            className="resize-handle resize-handle--ne"
            onPointerDown={(e) => {
              onFocus?.();
              if (!termRect) return;
              e.stopPropagation();
              e.preventDefault();
              resizingRef.current = {
                dir: "ne",
                startX: e.clientX,
                startY: e.clientY,
                startRect: termRect,
                pointerId: e.pointerId
              };
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            }}
          />
          <div
            className="resize-handle resize-handle--sw"
            onPointerDown={(e) => {
              onFocus?.();
              if (!termRect) return;
              e.stopPropagation();
              e.preventDefault();
              resizingRef.current = {
                dir: "sw",
                startX: e.clientX,
                startY: e.clientY,
                startRect: termRect,
                pointerId: e.pointerId
              };
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            }}
          />
          <div
            className="resize-handle resize-handle--se"
            onPointerDown={(e) => {
              onFocus?.();
              if (!termRect) return;
              e.stopPropagation();
              e.preventDefault();
              resizingRef.current = {
                dir: "se",
                startX: e.clientX,
                startY: e.clientY,
                startRect: termRect,
                pointerId: e.pointerId
              };
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            }}
          />
        </>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

