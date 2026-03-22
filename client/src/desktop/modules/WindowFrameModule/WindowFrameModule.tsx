/**
 * WindowFrameModule — модуль оконной рамки
 * 
 * Предоставляет:
 * - Перетаскивание окна за title bar
 * - Изменение размера через resize handles
 * - Кнопки управления (close, minimize, maximize)
 * - Состояния maximized/minimized
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createBaseModule, type DesktopModule, type ModuleAPI, type ModulePosition } from '../DesktopModule';
import { eventBus, DesktopEvents } from '../EventBus';
import {
  playWindowClose,
  playWindowMaximize,
  playWindowMinimize,
  playWindowRestore,
  playWindowMoveEnd,
} from '../../../lib/osSounds';

// ============================================================================
// Типы
// ============================================================================

export type WindowRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface WindowFrameProps {
  windowId: string;
  title: React.ReactNode;
  children: React.ReactNode;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  position?: { x: number; y: number };
  zIndex?: number;
  minimized?: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize?: () => void;
  onFocus?: () => void;
}

// ============================================================================
// WindowFrame Hook
// ============================================================================

interface UseWindowFrameOptions {
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  initialPosition?: { x: number; y: number };
}

interface UseWindowFrameResult {
  rect: WindowRect;
  maximized: boolean;
  startDrag: (e: React.PointerEvent, handle: HTMLElement) => void;
  startResize: (e: React.PointerEvent, dir: ResizeDir) => void;
  toggleMaximize: () => void;
  setRect: (rect: WindowRect) => void;
}

export function useWindowFrame(options: UseWindowFrameOptions): UseWindowFrameResult {
  const minW = options.minSize?.w ?? 320;
  const minH = options.minSize?.h ?? 220;

  const createDefaultRect = useCallback((): WindowRect => {
    if (options.initialPosition) {
      return {
        x: options.initialPosition.x,
        y: options.initialPosition.y,
        w: options.defaultSize.w,
        h: options.defaultSize.h,
      };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(options.defaultSize.w, Math.max(minW, Math.floor(vw * 0.9)));
    const h = Math.min(options.defaultSize.h, Math.max(minH, Math.floor(vh * 0.85)));
    return {
      x: Math.floor((vw - w) / 2),
      y: Math.floor((vh - h) / 2),
      w,
      h,
    };
  }, [minH, minW, options.defaultSize.h, options.defaultSize.w, options.initialPosition]);

  const [rect, setRect] = useState<WindowRect>(createDefaultRect);
  const rectRef = useRef(rect);
  useEffect(() => {
    rectRef.current = rect;
  }, [rect]);

  const [maximized, setMaximized] = useState(false);
  const maximizedRef = useRef(maximized);
  useEffect(() => {
    maximizedRef.current = maximized;
  }, [maximized]);

  const prevRectRef = useRef<WindowRect | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resizeRef = useRef<{ pointerId: number; dir: ResizeDir; startX: number; startY: number; startRect: WindowRect } | null>(null);
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

      if (dir === 'e' || dir === 'ne' || dir === 'se') w = startRect.w + dx;
      if (dir === 'w' || dir === 'nw' || dir === 'sw') {
        x = startRect.x + dx;
        w = startRect.w - dx;
      }
      if (dir === 's' || dir === 'se' || dir === 'sw') h = startRect.h + dy;
      if (dir === 'n' || dir === 'ne' || dir === 'nw') {
        y = startRect.y + dy;
        h = startRect.h - dy;
      }

      // Keep dragged edge fixed when min-size is reached.
      if (w < minW && (dir === 'w' || dir === 'nw' || dir === 'sw')) {
        x = startRect.x + startRect.w - minW;
        w = minW;
      }
      if (w < minW && (dir === 'e' || dir === 'ne' || dir === 'se')) {
        w = minW;
      }
      if (h < minH && (dir === 'n' || dir === 'ne' || dir === 'nw')) {
        y = startRect.y + startRect.h - minH;
        h = minH;
      }
      if (h < minH && (dir === 's' || dir === 'se' || dir === 'sw')) {
        h = minH;
      }

      // Clamp to viewport
      if (y < 0) { h += y; y = 0; }
      if (x + w > window.innerWidth) { x = window.innerWidth - w; }
      if (y + h > window.innerHeight) { y = window.innerHeight - h; }

      if (dx * dx + dy * dy > 49) resizeMovedRef.current = true;
      setRect({ x, y, w, h });
    };

    const onPointerUp = () => {
      if (dragRef.current && dragMovedRef.current) {
        playWindowMoveEnd();
      }
      dragRef.current = null;
      resizeRef.current = null;
      dragMovedRef.current = false;
      resizeMovedRef.current = false;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [minH, minW]);

  const startDrag = useCallback((e: React.PointerEvent, _handle: HTMLElement) => {
    if (maximizedRef.current) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: rectRef.current.x,
      originY: rectRef.current.y,
    };
    dragMovedRef.current = false;
  }, []);

  const startResize = useCallback((e: React.PointerEvent, dir: ResizeDir) => {
    if (maximizedRef.current) return;
    resizeRef.current = {
      pointerId: e.pointerId,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...rectRef.current },
    };
    resizeMovedRef.current = false;
  }, []);

  const toggleMaximize = useCallback(() => {
    const isMaximized = maximizedRef.current;
    if (!isMaximized) {
      // Развернуть на весь экран
      prevRectRef.current = rectRef.current;
      setRect({
        x: 0,
        y: 0,
        w: window.innerWidth,
        h: window.innerHeight,
      });
      setMaximized(true);
    } else {
      // Восстановить предыдущий размер
      if (prevRectRef.current) {
        setRect(prevRectRef.current);
      }
      prevRectRef.current = null;
      setMaximized(false);
    }
  }, []);

  return { rect, maximized, startDrag, startResize, toggleMaximize, setRect };
}

// ============================================================================
// WindowFrame Component
// ============================================================================

export function WindowFrame({
  windowId,
  title,
  children,
  defaultSize,
  minSize,
  position,
  zIndex = 100,
  minimized = false,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
}: WindowFrameProps) {
  const { rect, maximized, startDrag, startResize, toggleMaximize, setRect } = useWindowFrame({
    defaultSize,
    minSize,
    initialPosition: position,
  });

  const maximizedRef = useRef(maximized);
  useEffect(() => {
    maximizedRef.current = maximized;
  }, [maximized]);

  const handleClose = () => {
    playWindowClose();
    onClose();
  };

  const handleMinimize = () => {
    playWindowMinimize();
    onMinimize();
  };

  const handleMaximize = () => {
    if (maximizedRef.current) playWindowRestore();
    else playWindowMaximize();
    toggleMaximize();
    onMaximize?.();
  };

  return (
    <div
      className={`terminal-window absolute z-[75] pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl ${
        minimized ? 'pointer-events-none opacity-0 scale-95' : ''
      }`}
      onMouseDown={() => onFocus?.()}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        zIndex,
      }}
    >
      {/* Title Bar */}
      <div
        className="flex cursor-grab items-center justify-between border-b border-white/10 bg-[#2d3139] px-4 py-2.5"
        onPointerDown={(e) => startDrag(e, e.currentTarget)}
        role="presentation"
      >
        {/* Window controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="close"
            className="h-3 w-3 rounded-full bg-[#ff5f57] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleClose}
          />
          <button
            type="button"
            aria-label="minimize"
            className="h-3 w-3 rounded-full bg-[#febc2e] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleMinimize}
          />
          <button
            type="button"
            aria-label="maximize"
            className="h-3 w-3 rounded-full bg-[#28c840] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleMaximize}
          />
        </div>
        <div className="flex-1 text-center text-xs text-slate-400">{title}</div>
        <div className="w-16" />
      </div>

      {/* Resize Handles */}
      {!maximized && (
        <>
          <div
            className="resize-handle resize-handle--n"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, 'n');
            }}
          />
          <div
            className="resize-handle resize-handle--s"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, 's');
            }}
          />
          <div
            className="resize-handle resize-handle--e"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, 'e');
            }}
          />
          <div
            className="resize-handle resize-handle--w"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, 'w');
            }}
          />
          <div
            className="resize-handle resize-handle--ne"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, 'ne');
            }}
          />
          <div
            className="resize-handle resize-handle--nw"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, 'nw');
            }}
          />
          <div
            className="resize-handle resize-handle--se"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, 'se');
            }}
          />
          <div
            className="resize-handle resize-handle--sw"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, 'sw');
            }}
          />
        </>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// WindowFrameModule Factory
// ============================================================================

export interface WindowFrameModuleConfig {
  windowId: string;
  title: string;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  position?: { x: number; y: number };
  zIndex?: number;
}

/**
 * Создаёт модуль WindowFrameModule
 * 
 * @example
 * ```tsx
 * const windowModule = createWindowFrameModule({
 *   windowId: 'my-app',
 *   title: 'My Application',
 *   defaultSize: { w: 800, h: 600 },
 * });
 * ```
 */
export function createWindowFrameModule(config: WindowFrameModuleConfig): DesktopModule {
  let isMinimized = false;
  let isMounted = true;

  const module: DesktopModule = createBaseModule(
    `window:${config.windowId}`,
    `Window: ${config.title}`,
    () => null, // Controlled component - rendering handled externally
    {
      category: 'widget',
      position: {
        x: config.position?.x ?? 100,
        y: config.position?.y ?? 100,
        width: config.defaultSize.w,
        height: config.defaultSize.h,
        zIndex: config.zIndex ?? 100,
      },
      state: { visible: true, active: false, minimized: false },
      onInit: (moduleApi: ModuleAPI) => {
        // Emit window open event
        eventBus.emit(DesktopEvents.WINDOW_OPEN, {
          windowId: config.windowId,
          title: config.title,
          rect: {
            x: config.position?.x ?? 100,
            y: config.position?.y ?? 100,
            w: config.defaultSize.w,
            h: config.defaultSize.h,
          },
        });

        // Listen for window commands
        eventBus.on(DesktopEvents.WINDOW_MINIMIZE, ({ windowId }: { windowId: string }) => {
          if (windowId === config.windowId) {
            isMinimized = true;
            eventBus.emit('window:state-change', { windowId: config.windowId, minimized: true });
          }
        });

        eventBus.on(DesktopEvents.WINDOW_RESTORE, ({ windowId }: { windowId: string }) => {
          if (windowId === config.windowId) {
            isMinimized = false;
            eventBus.emit('window:state-change', { windowId: config.windowId, minimized: false });
          }
        });

        eventBus.on(DesktopEvents.WINDOW_CLOSE, ({ windowId }: { windowId: string }) => {
          if (windowId === config.windowId) {
            isMounted = false;
            eventBus.emit('window:state-change', { windowId: config.windowId, mounted: false });
          }
        });
      },
      onDestroy: () => {
        isMounted = false;
      },
    }
  );

  return module;
}

// ============================================================================
// Window Manager (управление множеством окон)
// ============================================================================

export interface WindowEntry {
  windowId: string;
  title: string;
  component: React.ReactNode;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  position?: { x: number; y: number };
  zIndex: number;
  minimized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onFocus?: () => void;
}

interface WindowManagerState {
  windows: Map<string, WindowEntry>;
  activeWindowId: string | null;
  nextZIndex: number;
}

class WindowManager {
  private state: WindowManagerState = {
    windows: new Map(),
    activeWindowId: null,
    nextZIndex: 100,
  };

  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  registerWindow(entry: Omit<WindowEntry, 'zIndex'>): string {
    const zIndex = this.state.nextZIndex++;
    const fullEntry: WindowEntry = { ...entry, zIndex };
    this.state.windows.set(entry.windowId, fullEntry);
    
    if (!this.state.activeWindowId) {
      this.state.activeWindowId = entry.windowId;
    }
    
    eventBus.emit('window-manager:change', { state: this.getState() });
    this.notify();
    return entry.windowId;
  }

  unregisterWindow(windowId: string): void {
    this.state.windows.delete(windowId);
    
    if (this.state.activeWindowId === windowId) {
      // Activate another window
      const remaining = Array.from(this.state.windows.keys());
      this.state.activeWindowId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    }
    
    eventBus.emit('window-manager:change', { state: this.getState() });
    this.notify();
  }

  focusWindow(windowId: string): void {
    if (!this.state.windows.has(windowId)) return;
    
    this.state.activeWindowId = windowId;
    
    // Bring to front
    const entry = this.state.windows.get(windowId)!;
    entry.zIndex = this.state.nextZIndex++;
    
    eventBus.emit('window-manager:change', { state: this.getState() });
    this.notify();
  }

  minimizeWindow(windowId: string): void {
    const entry = this.state.windows.get(windowId);
    if (!entry) return;
    
    entry.minimized = true;
    
    if (this.state.activeWindowId === windowId) {
      const remaining = Array.from(this.state.windows.values()).filter((w) => !w.minimized);
      this.state.activeWindowId = remaining.length > 0 ? remaining[remaining.length - 1].windowId : null;
    }
    
    eventBus.emit('window-manager:change', { state: this.getState() });
    this.notify();
  }

  restoreWindow(windowId: string): void {
    const entry = this.state.windows.get(windowId);
    if (!entry) return;
    
    entry.minimized = false;
    this.state.activeWindowId = windowId;
    
    eventBus.emit('window-manager:change', { state: this.getState() });
    this.notify();
  }

  getState(): WindowManagerState {
    return { ...this.state, windows: new Map(this.state.windows) };
  }

  getActiveWindow(): WindowEntry | null {
    if (!this.state.activeWindowId) return null;
    return this.state.windows.get(this.state.activeWindowId) ?? null;
  }

  getWindows(): WindowEntry[] {
    return Array.from(this.state.windows.values());
  }
}

export const windowManager = new WindowManager();

// ============================================================================
// React Hook для использования WindowManager
// ============================================================================

export function useWindowManager() {
  const [state, setState] = useState(windowManager.getState());

  React.useEffect(() => {
    return windowManager.subscribe(() => {
      setState(windowManager.getState());
    });
  }, []);

  return {
    windows: state.windows,
    activeWindowId: state.activeWindowId,
    registerWindow: windowManager.registerWindow.bind(windowManager),
    unregisterWindow: windowManager.unregisterWindow.bind(windowManager),
    focusWindow: windowManager.focusWindow.bind(windowManager),
    minimizeWindow: windowManager.minimizeWindow.bind(windowManager),
    restoreWindow: windowManager.restoreWindow.bind(windowManager),
  };
}

// ============================================================================
// WindowFrameRenderer Component
// ============================================================================

interface WindowFrameRendererProps {
  windowId: string;
  title: string;
  children: React.ReactNode;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  position?: { x: number; y: number };
  zIndex: number;
  minimized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onFocus?: () => void;
}

export function WindowFrameRenderer(props: WindowFrameRendererProps) {
  return (
    <WindowFrame
      windowId={props.windowId}
      title={props.title}
      children={props.children}
      defaultSize={props.defaultSize}
      minSize={props.minSize}
      position={props.position}
      zIndex={props.zIndex}
      minimized={props.minimized}
      onClose={props.onClose}
      onMinimize={props.onMinimize}
      onFocus={props.onFocus}
    />
  );
}

// ============================================================================
// Exports
// ============================================================================

export default WindowFrame;
