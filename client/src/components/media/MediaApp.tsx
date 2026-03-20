import { useEffect, useMemo, useRef, useState } from "react";
import { FloatingWindow } from "../window/FloatingWindow";
import {
  fileToBase64,
  initGameFs,
  readBytesBase64Fs,
  writeBytesBase64Fs
} from "../../lib/gameFs";
import type { GameLanguage } from "../../lib/gameConfig";

type Props = {
  lang: GameLanguage;
  minimized?: boolean;
  initialRelPath?: string; // file inside Photos/ or Videos/
  onMinimize: () => void;
  onClose: () => void;
  onFocus?: () => void;
  zIndex?: number;
};

function mimeFromRelPath(relPath: string): string {
  const lower = relPath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".ogg")) return "video/ogg";
  // fallback
  return "application/octet-stream";
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 4h4v16H6z" />
      <path d="M14 4h4v16h-4z" />
    </svg>
  );
}

function SeekBackIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6v12" />
      <path d="M4 6l8 6-8 6z" />
      <path d="M12 6l8 6-8 6z" opacity="0.35" />
    </svg>
  );
}

function SeekFwdIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6v12" />
      <path d="M20 6l-8 6 8 6z" />
      <path d="M12 6L4 12l8 6z" opacity="0.35" />
    </svg>
  );
}

function CinemaIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h6" />
      <path d="M7 13h10" />
    </svg>
  );
}

function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function CustomVideoPlayer({
  src,
  lang,
  onRequestUpload
}: {
  src: string;
  lang: GameLanguage;
  onRequestUpload: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [cinemaMode, setCinemaMode] = useState(false);

  const t = useMemo(() => {
    return {
      play: lang === "ru" ? "Воспроизвести" : "Play",
      pause: lang === "ru" ? "Пауза" : "Pause",
      cinema: lang === "ru" ? "Кино" : "Cinema",
      exitCinema: lang === "ru" ? "Выход из кино" : "Exit cinema",
      upload: lang === "ru" ? "Загрузить файл" : "Upload file",
      seekBack: lang === "ru" ? "-10с" : "-10s",
      seekFwd: lang === "ru" ? "+10с" : "+10s",
      hint: lang === "ru" ? "ПКМ: меню" : "RMB: menu"
    };
  }, [lang]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoaded = () => {
      setDuration(v.duration || 0);
    };
    const onTime = () => setCurrentTime(v.currentTime || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);

    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    // ESC выходит из кино-режима.
    const onKeyDown = (e: KeyboardEvent) => {
      if (!cinemaMode) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setCinemaMode(false);
        return;
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) void v.play();
        else v.pause();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = Math.max(0, v.currentTime - 10);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = Math.min(duration || v.duration || 0, v.currentTime + 10);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cinemaMode, duration]);

  useEffect(() => {
    if (cinemaMode) {
      document.body.classList.add("zd-cinema-mode");
    } else {
      document.body.classList.remove("zd-cinema-mode");
    }
    return () => {
      document.body.classList.remove("zd-cinema-mode");
    };
  }, [cinemaMode]);

  const onTogglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
    } else {
      v.pause();
    }
  };

  const onSeek = (nextTime: number) => {
    const v = videoRef.current;
    if (!v) return;
    const d = duration || v.duration || 0;
    const clamped = Math.min(Math.max(0, nextTime), d || nextTime);
    v.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = menuRef.current;
      if (!el) return;
      const target = e.target as HTMLElement | null;
      if (target && target instanceof Node && el.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const progressRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const seekByClientX = (clientX: number) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const d = duration || v.duration || 0;
    const clampedRatio = Math.min(1, Math.max(0, ratio));
    const nextTime = (d || 0) * clampedRatio;
    onSeek(nextTime);
  };

  const onProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    seekByClientX(e.clientX);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      seekByClientX(ev.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const playerContent = (
    <div
      className="relative h-full w-full overflow-hidden rounded-lg border border-white/10 bg-black"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(true);
        setMenuPos({
          x: Math.min(e.clientX, window.innerWidth - 240),
          y: Math.min(e.clientY, window.innerHeight - 200)
        });
      }}
      role="application"
      aria-label={lang === "ru" ? "Плеер видео" : "Video player"}
    >
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          src={src}
          playsInline
          // Без нативных controls: всё через RMB-меню и таймлайн
          controls={false}
        />

        <div className="absolute left-0 right-0 bottom-0 p-3">
          <div className="rounded-lg border border-white/10 bg-black/55 backdrop-blur px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/90 transition hover:bg-white/10"
                  onClick={onTogglePlay}
                  aria-label={playing ? t.pause : t.play}
                  title={playing ? t.pause : t.play}
                >
                  {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/90 transition hover:bg-white/10"
                  onClick={() => onSeek(currentTime - 10)}
                  aria-label={t.seekBack}
                  title={t.seekBack}
                >
                  <SeekBackIcon size={16} />
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/90 transition hover:bg-white/10"
                  onClick={() => onSeek(currentTime + 10)}
                  aria-label={t.seekFwd}
                  title={t.seekFwd}
                >
                  <SeekFwdIcon size={16} />
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/90 transition hover:bg-white/10"
                  onClick={() => setCinemaMode((v) => !v)}
                  aria-label={cinemaMode ? t.exitCinema : t.cinema}
                  title={cinemaMode ? t.exitCinema : t.cinema}
                >
                  {cinemaMode ? <CloseIcon size={16} /> : <CinemaIcon size={16} />}
                </button>
              </div>

              <div className="min-w-[92px] text-xs font-bold text-white/90 whitespace-nowrap">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>

              <div className="ml-auto text-[11px] font-bold text-white/60 whitespace-nowrap">{t.hint}</div>
            </div>

            <div
              ref={progressRef}
              className="mt-2 h-2 w-full cursor-ew-resize rounded-full bg-white/10 overflow-hidden"
              onPointerDown={onProgressPointerDown}
              role="slider"
              aria-label={lang === "ru" ? "Прогресс" : "Progress"}
              aria-valuemin={0}
              aria-valuemax={duration || 0}
              aria-valuenow={currentTime}
            >
              <div
                className="h-full bg-[#2dd4bf]"
                style={{
                  width: duration > 0 ? `${(Math.min(currentTime, duration) / duration) * 100}%` : "0%"
                }}
              />
            </div>
          </div>
        </div>

        {menuOpen ? (
          <div
            ref={menuRef}
            className="desktop-ctx-menu"
            style={{
              left: menuPos.x,
              top: menuPos.y
            }}
            role="menu"
            aria-label={lang === "ru" ? "Меню видео" : "Video menu"}
          >
            <div
              className="desktop-ctx-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onTogglePlay();
              }}
            >
              <span className="desktop-ctx-ico" aria-hidden="true">
                {playing ? <PauseIcon /> : <PlayIcon />}
              </span>
              <span>{playing ? t.pause : t.play}</span>
            </div>

            <div
              className="desktop-ctx-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onSeek(currentTime - 10);
              }}
            >
              <span className="desktop-ctx-ico" aria-hidden="true">
                <SeekBackIcon />
              </span>
              <span>{t.seekBack}</span>
            </div>

            <div
              className="desktop-ctx-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onSeek(currentTime + 10);
              }}
            >
              <span className="desktop-ctx-ico" aria-hidden="true">
                <SeekFwdIcon />
              </span>
              <span>{t.seekFwd}</span>
            </div>

            <div
              className="desktop-ctx-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setCinemaMode(!cinemaMode);
              }}
            >
              <span className="desktop-ctx-ico" aria-hidden="true">
                {cinemaMode ? <CloseIcon /> : <CinemaIcon />}
              </span>
              <span>{cinemaMode ? t.exitCinema : t.cinema}</span>
            </div>

            <div
              className="desktop-ctx-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onRequestUpload();
              }}
            >
              <span className="desktop-ctx-ico" aria-hidden="true">
                <span style={{ fontSize: 16, opacity: 0.95 }}>⬆</span>
              </span>
              <span>{t.upload}</span>
            </div>
          </div>
        ) : null}
    </div>
  );

  return (
    <div
      className={cinemaMode ? "fixed inset-0 z-[5000] bg-black/80 p-3" : "h-full w-full"}
      role={cinemaMode ? "dialog" : undefined}
      aria-label={cinemaMode ? t.cinema : undefined}
    >
      {playerContent}
    </div>
  );
}

function PhotoViewer({
  src,
  lang,
  onRequestUpload
}: {
  src: string;
  lang: GameLanguage;
  onRequestUpload: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [fitCover, setFitCover] = useState(false);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = menuRef.current;
      if (!el) return;
      const target = e.target as HTMLElement | null;
      if (target && target instanceof Node && el.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const menuLabels = useMemo(() => {
    return {
      zoomIn: lang === "ru" ? "Увеличить" : "Zoom in",
      zoomOut: lang === "ru" ? "Уменьшить" : "Zoom out",
      reset: lang === "ru" ? "Сбросить" : "Reset",
      fit: fitCover ? (lang === "ru" ? "Режим: Fit" : "Mode: Fit") : lang === "ru" ? "Режим: Cover" : "Mode: Cover",
      upload: lang === "ru" ? "Загрузить файл" : "Upload file",
      hint: lang === "ru" ? "ПКМ: меню" : "RMB: menu"
    };
  }, [fitCover, lang]);

  const draggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-lg border border-white/10 bg-black/30"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(true);
        setMenuPos({
          x: Math.min(e.clientX, window.innerWidth - 240),
          y: Math.min(e.clientY, window.innerHeight - 200)
        });
      }}
      onWheel={(e) => {
        e.preventDefault();
        const delta = e.deltaY;
        const next = delta > 0 ? zoom / 1.1 : zoom * 1.1;
        const clamped = Math.min(6, Math.max(1, next));
        setZoom(clamped);
        setPan({ x: 0, y: 0 });
      }}
      onPointerDown={(e) => {
        // Panning when zoomed
        if (zoom <= 1.001) return;
        if (e.button !== 0) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest(".photo-controls") || target?.closest(".desktop-ctx-menu")) return;
        e.preventDefault();
        e.stopPropagation();
        draggingRef.current = true;
        dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current || !dragStartRef.current) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy });
      }}
      onPointerUp={() => {
        draggingRef.current = false;
        dragStartRef.current = null;
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
        dragStartRef.current = null;
      }}
      role="application"
      aria-label={lang === "ru" ? "Просмотр фото" : "Photo viewer"}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Keep object-fit behavior while still allowing pan/zoom */}
        <img
          src={src}
          className="w-full h-full select-none pointer-events-none"
          style={{
            objectFit: fitCover ? "cover" : "contain",
            transformOrigin: "center",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
          }}
        />
      </div>

      <div className="absolute left-3 top-3 text-[11px] font-bold text-white/50">{menuLabels.hint}</div>

      <div className="photo-controls absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-black/45 px-2 py-1.5 backdrop-blur">
        <button
          type="button"
          className="h-8 w-8 rounded-md border border-white/15 bg-white/5 text-white/90 hover:bg-white/10"
          onClick={() => {
            const next = Math.min(6, zoom * 1.2);
            setZoom(next);
            setPan({ x: 0, y: 0 });
          }}
          aria-label={menuLabels.zoomIn}
          title={menuLabels.zoomIn}
        >
          +
        </button>
        <button
          type="button"
          className="h-8 w-8 rounded-md border border-white/15 bg-white/5 text-white/90 hover:bg-white/10"
          onClick={() => {
            const next = Math.max(1, zoom / 1.2);
            setZoom(next);
            setPan({ x: 0, y: 0 });
          }}
          aria-label={menuLabels.zoomOut}
          title={menuLabels.zoomOut}
        >
          -
        </button>
        <button
          type="button"
          className="h-8 rounded-md border border-white/15 bg-white/5 px-2 text-xs text-white/90 hover:bg-white/10"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
            setFitCover(false);
          }}
          aria-label={menuLabels.reset}
          title={menuLabels.reset}
        >
          {lang === "ru" ? "Сброс" : "Reset"}
        </button>
        <button
          type="button"
          className="h-8 rounded-md border border-white/15 bg-white/5 px-2 text-xs text-white/90 hover:bg-white/10"
          onClick={() => {
            setFitCover((v) => !v);
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          aria-label={menuLabels.fit}
          title={menuLabels.fit}
        >
          {fitCover ? "Fit" : "Cover"}
        </button>
        <button
          type="button"
          className="h-8 rounded-md border border-white/15 bg-white/5 px-2 text-xs text-white/90 hover:bg-white/10"
          onClick={onRequestUpload}
          aria-label={menuLabels.upload}
          title={menuLabels.upload}
        >
          {lang === "ru" ? "Файл" : "Upload"}
        </button>
      </div>

      <div className="absolute left-3 bottom-3 z-10 rounded-md border border-white/10 bg-black/45 px-2 py-1 text-[11px] font-bold text-white/80 backdrop-blur">
        {zoomPercent}%
      </div>

      {menuOpen ? (
        <div
          ref={menuRef}
          className="desktop-ctx-menu"
          style={{ left: menuPos.x, top: menuPos.y, width: 220 }}
          role="menu"
          aria-label={lang === "ru" ? "Меню фото" : "Photo menu"}
        >
          <div
            className="desktop-ctx-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              const next = Math.min(6, zoom * 1.2);
              setZoom(next);
              setPan({ x: 0, y: 0 });
            }}
          >
            <span>{menuLabels.zoomIn}</span>
          </div>
          <div
            className="desktop-ctx-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              const next = Math.max(1, zoom / 1.2);
              setZoom(next);
              setPan({ x: 0, y: 0 });
            }}
          >
            <span>{menuLabels.zoomOut}</span>
          </div>
          <div
            className="desktop-ctx-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setZoom(1);
              setPan({ x: 0, y: 0 });
              setFitCover(false);
            }}
          >
            <span>{menuLabels.reset}</span>
          </div>
          <div
            className="desktop-ctx-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setFitCover((v) => !v);
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <span>{menuLabels.fit}</span>
          </div>
          <div
            className="desktop-ctx-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onRequestUpload();
            }}
          >
            <span>{menuLabels.upload}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MediaApp({
  lang,
  minimized = false,
  initialRelPath,
  onMinimize,
  onClose,
  onFocus,
  zIndex
}: Props) {
  const [activeRelPath, setActiveRelPath] = useState<string | null>(initialRelPath ?? null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const title = useMemo(() => (lang === "ru" ? "Просмотр фото и видео" : "Media viewer"), [lang]);

  useEffect(() => {
    // Ensure filesystem is ready for read/write.
    void initGameFs();
  }, []);

  useEffect(() => {
    setActiveRelPath(initialRelPath ?? null);
    setDataUrl(null);
  }, [initialRelPath]);

  const isVideoRelPath = (rel: string) => {
    const lower = rel.toLowerCase();
    return (
      lower.startsWith("videos/") ||
      lower.endsWith(".mp4") ||
      lower.endsWith(".webm") ||
      lower.endsWith(".ogg")
    );
  };

  useEffect(() => {
    if (!activeRelPath) return;
    void (async () => {
      const b64 = await readBytesBase64Fs(activeRelPath);
      const mime = mimeFromRelPath(activeRelPath);
      setDataUrl(`data:${mime};base64,${b64}`);
    })();
  }, [activeRelPath]);

  const uploadAny = async (file: File) => {
    if (!file) return;
    const safeName = file.name.replace(/[/\\]/g, "_");
    const lowerName = file.name.toLowerCase();
    const lowerType = file.type.toLowerCase();

    const isImage =
      lowerType.startsWith("image/") ||
      [".png", ".jpg", ".jpeg", ".webp", ".gif"].some((ext) => lowerName.endsWith(ext));

    const isVideo =
      lowerType.startsWith("video/") ||
      [".mp4", ".webm", ".ogg"].some((ext) => lowerName.endsWith(ext));

    const folder = isImage && !isVideo ? "Photos" : "Videos";
    const rel = `${folder}/${safeName}`;

    const b64 = await fileToBase64(file);
    await writeBytesBase64Fs(rel, b64);
    setActiveRelPath(rel);
  };

  const onRequestUpload = () => fileInputRef.current?.click();

  const isVideo = activeRelPath ? isVideoRelPath(activeRelPath) : false;

  return (
    <FloatingWindow
      title={title}
      onClose={onClose}
      onMinimize={onMinimize}
      minimized={minimized}
      onFocus={onFocus}
      zIndex={zIndex}
    >
      <div
        className="flex h-full flex-col gap-3 p-4"
        onContextMenu={(e) => {
          // Важно: сам video/photo покажут RMB-меню (и внутри есть Upload).
          // Здесь ничего не открываем, чтобы не конфликтовать.
          e.preventDefault();
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
            {activeRelPath ? activeRelPath : lang === "ru" ? "Откройте файл из папки" : "Open a file from the folder"}
          </div>
          <div className="text-[11px] text-slate-500">{lang === "ru" ? "ПКМ: управление" : "RMB: controls"}</div>
        </div>

        <div className="flex-1 overflow-hidden">
          {dataUrl && activeRelPath && isVideo ? (
            <CustomVideoPlayer src={dataUrl} lang={lang} onRequestUpload={onRequestUpload} />
          ) : dataUrl && activeRelPath ? (
            <PhotoViewer src={dataUrl} lang={lang} onRequestUpload={onRequestUpload} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {lang === "ru" ? "Нет файла для просмотра" : "No file to preview"}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void uploadAny(file);
            // Allow picking the same file again.
            e.currentTarget.value = "";
          }}
        />
      </div>
    </FloatingWindow>
  );
}

