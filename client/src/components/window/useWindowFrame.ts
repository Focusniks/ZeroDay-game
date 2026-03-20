import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { playWindowMoveEnd } from "../../lib/osSounds";

type Rect = { x: number; y: number; w: number; h: number };
type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
} | null;

type ResizeState = {
  pointerId: number;
  dir: ResizeDir;
  startX: number;
  startY: number;
  startRect: Rect;
} | null;

type Options = {
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
};

export function useWindowFrame(options: Options) {
  const minW = options.minSize?.w ?? 320;
  const minH = options.minSize?.h ?? 220;

  const createDefaultRect = useCallback((): Rect => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(options.defaultSize.w, Math.max(minW, Math.floor(vw * 0.9)));
    const h = Math.min(options.defaultSize.h, Math.max(minH, Math.floor(vh * 0.85)));
    return {
      x: Math.floor((vw - w) / 2),
      y: Math.floor((vh - h) / 2),
      w,
      h
    };
  }, [minH, minW, options.defaultSize.h, options.defaultSize.w]);

  const [rect, setRect] = useState<Rect>(createDefaultRect);
  const rectRef = useRef(rect);
  useEffect(() => {
    rectRef.current = rect;
  }, [rect]);

  const [maximized, setMaximized] = useState(false);
  const maximizedRef = useRef(maximized);
  useEffect(() => {
    maximizedRef.current = maximized;
  }, [maximized]);

  const prevRectRef = useRef<Rect | null>(null);
  const dragRef = useRef<DragState>(null);
  const resizeRef = useRef<ResizeState>(null);
  const dragMovedRef = useRef(false);
  const resizeMovedRef = useRef(false);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag) {
        if (e.pointerId !== drag.pointerId) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (dx * dx + dy * dy > 49) dragMovedRef.current = true;
        setRect((prev) => ({ ...prev, x: drag.originX + dx, y: drag.originY + dy }));
        return;
      }

      const resize = resizeRef.current;
      if (!resize || maximizedRef.current) return;
      if (e.pointerId !== resize.pointerId) return;

      const dx = e.clientX - resize.startX;
      const dy = e.clientY - resize.startY;
      const { dir, startRect } = resize;

      let x = startRect.x;
      let y = startRect.y;
      let w = startRect.w;
      let h = startRect.h;

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

      // Keep dragged edge fixed when min-size is reached.
      if (w < minW && (dir === "w" || dir === "nw" || dir === "sw")) {
        x -= minW - w;
      }
      if (h < minH && (dir === "n" || dir === "ne" || dir === "nw")) {
        y -= minH - h;
      }

      const next = { x, y, w: Math.max(minW, w), h: Math.max(minH, h) };
      if (
        Math.abs(next.x - startRect.x) +
          Math.abs(next.y - startRect.y) +
          Math.abs(next.w - startRect.w) +
          Math.abs(next.h - startRect.h) >
        6
      ) {
        resizeMovedRef.current = true;
      }
      setRect(next);
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (dragRef.current && e.pointerId === dragRef.current.pointerId) {
        if (dragMovedRef.current) playWindowMoveEnd();
        dragMovedRef.current = false;
        dragRef.current = null;
      }
      if (resizeRef.current && e.pointerId === resizeRef.current.pointerId) {
        if (resizeMovedRef.current) playWindowMoveEnd();
        resizeMovedRef.current = false;
        resizeRef.current = null;
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [minH, minW]);

  const startDrag = useCallback((e: ReactPointerEvent, titleTarget: HTMLElement | null) => {
    if (maximizedRef.current) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.closest("button") || target.closest("input") || target.closest(".resize-handle"))) return;
    e.preventDefault();
    e.stopPropagation();
    const cur = rectRef.current;
    dragMovedRef.current = false;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: cur.x,
      originY: cur.y
    };
    titleTarget?.focus?.();
  }, []);

  const startResize = useCallback((e: ReactPointerEvent, dir: ResizeDir) => {
    if (maximizedRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    resizeMovedRef.current = false;
    resizeRef.current = {
      pointerId: e.pointerId,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startRect: rectRef.current
    };
  }, []);

  const toggleMaximize = useCallback(() => {
    if (maximizedRef.current) {
      setMaximized(false);
      setRect(prevRectRef.current ?? createDefaultRect());
      prevRectRef.current = null;
      return;
    }
    prevRectRef.current = rectRef.current;
    setMaximized(true);
    setRect({
      x: 8,
      y: 8,
      w: Math.max(minW, window.innerWidth - 16),
      h: Math.max(minH, window.innerHeight - 72)
    });
  }, [createDefaultRect, minH, minW]);

  return {
    rect,
    maximized,
    setMaximized,
    startDrag,
    startResize,
    toggleMaximize
  };
}
