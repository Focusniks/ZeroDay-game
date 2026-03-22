import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import type { GameLanguage } from "../../lib/gameConfig";
import {
  playWindowClose,
  playWindowMaximize,
  playWindowMinimize,
  playWindowRestore
} from "../../lib/osSounds";
import { useWindowFrame, type WindowRect } from "../../desktop/modules/WindowFrameModule";

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
  const { rect, maximized, startDrag, startResize, toggleMaximize } = useWindowFrame({
    defaultSize: { w: 900, h: 700 },
    minSize: { w: 320, h: 220 },
  });

  const maximizedRef = useRef(maximized);
  useEffect(() => {
    maximizedRef.current = maximized;
  }, [maximized]);

  return (
    <div
      className={`terminal-window absolute z-[75] pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl ${
        minimized ? "pointer-events-none opacity-0 scale-95" : ""
      }`}
      onMouseDown={() => onFocus?.()}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        ...(zIndex !== undefined ? { zIndex } : {})
      }}
    >
      <div
        className="flex cursor-grab items-center justify-between border-b border-white/10 bg-[#2d3139] px-4 py-2.5"
        onPointerDown={(e) => startDrag(e, e.currentTarget)}
        role="presentation"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="close"
            className="h-3 w-3 rounded-full bg-[#ff5f57] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              playWindowClose();
              onClose();
            }}
          />
          <button
            type="button"
            aria-label="minimize"
            className="h-3 w-3 rounded-full bg-[#febc2e] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              playWindowMinimize();
              onMinimize();
            }}
          />
          <button
            type="button"
            aria-label="maximize"
            className="h-3 w-3 rounded-full bg-[#28c840] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (maximizedRef.current) playWindowRestore();
              else playWindowMaximize();
              toggleMaximize();
            }}
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
              startResize(e, "n");
            }}
          />
          <div
            className="resize-handle resize-handle--s"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "s");
            }}
          />
          <div
            className="resize-handle resize-handle--e"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "e");
            }}
          />
          <div
            className="resize-handle resize-handle--w"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "w");
            }}
          />

          <div
            className="resize-handle resize-handle--nw"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "nw");
            }}
          />
          <div
            className="resize-handle resize-handle--ne"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "ne");
            }}
          />
          <div
            className="resize-handle resize-handle--sw"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "sw");
            }}
          />
          <div
            className="resize-handle resize-handle--se"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "se");
            }}
          />
        </>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

