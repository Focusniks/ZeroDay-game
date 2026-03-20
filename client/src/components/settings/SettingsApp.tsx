import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameLanguage } from "../../lib/gameConfig";
import { useGameConfig } from "../../hooks/useGameConfig";
import { INSTALL_TIMEZONES, getDefaultTimezoneId } from "../../data/timezones";
import {
  DEFAULT_WALLPAPER,
  CUSTOM_WALLPAPER_PREFIX,
  getWallpapers,
  isCustomWallpaper,
  parseCustomWallpaperRelPath,
  type WallpaperId
} from "../../lib/wallpapers";
import { useAuth } from "../../hooks/useAuth";
import { fileToBase64, initGameFs, listFs, writeBytesBase64Fs, type FsEntry } from "../../lib/gameFs";
import {
  playWindowClose,
  playWindowMaximize,
  playWindowMinimize,
  playWindowRestore
} from "../../lib/osSounds";
import { useWindowFrame } from "../window/useWindowFrame";

type Props = {
  lang: GameLanguage;
  onClose: () => void;
  onMinimize: () => void;
  minimized?: boolean;
  initialTab?: "system" | "desktop" | "network" | "profile";
  onFocus?: () => void;
  zIndex?: number;
};

export function SettingsApp({
  lang,
  onClose,
  onMinimize,
  minimized = false,
  initialTab = "system",
  onFocus,
  zIndex
}: Props) {
  const [activeTab, setActiveTab] = useState<"system" | "desktop" | "network" | "profile">(initialTab);
  const { config, patchConfig } = useGameConfig();
  const { user } = useAuth();

  const DEFAULT_WS_URL = "ws://127.0.0.1:8080";
  const [wsUrlDraft, setWsUrlDraft] = useState<string>(config.wsUrl ?? DEFAULT_WS_URL);
  useEffect(() => {
    setWsUrlDraft(config.wsUrl ?? DEFAULT_WS_URL);
  }, [config.wsUrl]);

  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const addToast = (message: string) => {
    setFlashMsg(message);
    window.setTimeout(() => setFlashMsg(null), 3000);
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const title = useMemo(() => (lang === "ru" ? "Параметры" : "Settings"), [lang]);
  const tabSystem = useMemo(() => (lang === "ru" ? "Система" : "System"), [lang]);
  const tabDesktop = useMemo(() => (lang === "ru" ? "Рабочий стол" : "Desktop"), [lang]);
  const tabNetwork = useMemo(() => (lang === "ru" ? "Сеть" : "Network"), [lang]);
  const tabProfile = useMemo(() => (lang === "ru" ? "Профиль" : "Profile"), [lang]);

  const wallpapers = useMemo(() => getWallpapers(), []);
  const customActiveRelPath = useMemo(() => parseCustomWallpaperRelPath(config.wallpaper ?? null), [config.wallpaper]);
  const isCustomActive = Boolean(customActiveRelPath);
  const activeWallpaperId = useMemo(() => {
    if (isCustomActive) return DEFAULT_WALLPAPER;
    const id = config.wallpaper ?? DEFAULT_WALLPAPER;
    return wallpapers.some((w) => w.id === id) ? (id as WallpaperId) : DEFAULT_WALLPAPER;
  }, [config.wallpaper, wallpapers, isCustomActive]);

  const [customWallpapers, setCustomWallpapers] = useState<FsEntry[]>([]);
  const customUploadInputRef = useRef<HTMLInputElement | null>(null);

  const refreshCustomWallpapers = useCallback(async () => {
    try {
      await initGameFs();
      const items = await listFs("Wallpapers");
      const allowed = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
      setCustomWallpapers(
        items
          .filter((i) => i.kind === "file")
          .filter((i) => allowed.has((i.ext ?? "").toLowerCase()))
          .slice(0, 30)
      );
    } catch {
      setCustomWallpapers([]);
    }
  }, []);

  useEffect(() => {
    void refreshCustomWallpapers();
  }, [refreshCustomWallpapers]);

  const sanitizeBaseName = (nameRaw: string) =>
    nameRaw
      .trim()
      .replace(/[<>:"/\\|?*]+/g, "_")
      .replace(/\.+$/g, "")
      .trim();

  const { rect, maximized, startDrag, startResize, toggleMaximize } = useWindowFrame({
    defaultSize: { w: 920, h: 720 },
    minSize: { w: 320, h: 220 }
  });

  const [maximizedTick, setMaximizedTick] = useState(0);

  const [resizingTick, setResizingTick] = useState(0);
  const onToggleMaximize = () => {
    if (maximized) playWindowRestore();
    else playWindowMaximize();
    toggleMaximize();
    setMaximizedTick((v) => v + 1);
  };

  return (
    <div
      className={`settings-window absolute z-[75] pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl ${
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
      role="dialog"
      aria-label={title}
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
            onClick={onToggleMaximize}
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
              onFocus?.();
              startResize(e, "n");
              setResizingTick((v) => v + 1);
            }}
          />
          <div
            className="resize-handle resize-handle--s"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "s");
              setResizingTick((v) => v + 1);
            }}
          />
          <div
            className="resize-handle resize-handle--e"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "e");
              setResizingTick((v) => v + 1);
            }}
          />
          <div
            className="resize-handle resize-handle--w"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "w");
              setResizingTick((v) => v + 1);
            }}
          />

          <div
            className="resize-handle resize-handle--nw"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "nw");
              setResizingTick((v) => v + 1);
            }}
          />
          <div
            className="resize-handle resize-handle--ne"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "ne");
              setResizingTick((v) => v + 1);
            }}
          />
          <div
            className="resize-handle resize-handle--sw"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "sw");
              setResizingTick((v) => v + 1);
            }}
          />
          <div
            className="resize-handle resize-handle--se"
            onPointerDown={(e) => {
              onFocus?.();
              startResize(e, "se");
              setResizingTick((v) => v + 1);
            }}
          />
        </>
      )}

      <div className="settings-body flex min-h-0 flex-1">
        <div className="settings-tabs w-60 border-r border-white/10 bg-[#0d1117] p-3">
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
              activeTab === "desktop" ? "bg-white/10" : "hover:bg-white/5"
            }`}
            onClick={() => setActiveTab("desktop")}
          >
            {tabDesktop}
          </button>
          <button
            type="button"
            className={`settings-tab-btn w-full rounded-lg px-3 py-2 text-left text-sm ${
              activeTab === "network" ? "bg-white/10" : "hover:bg-white/5"
            }`}
            onClick={() => setActiveTab("network")}
          >
            {tabNetwork}
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

              {flashMsg ? (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                  {flashMsg}
                </div>
              ) : null}

              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
                  {lang === "ru" ? "Система" : "System"}
                </div>
                <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                  <span>{lang === "ru" ? "Ядро" : "Kernel"}</span>
                  <span className="text-xs text-slate-300">zeroday-linux 0.1</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                  <span>{lang === "ru" ? "Стол" : "Desktop"}</span>
                  <span className="text-xs text-slate-300">ZeroDay Desktop</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                  <span>Firewall</span>
                  <span className="text-xs text-slate-300">{lang === "ru" ? "вкл." : "on"}</span>
                </div>
                {user ? (
                  <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                    <span>{lang === "ru" ? "IP сессии" : "Session IP"}</span>
                    <span className="text-xs text-slate-300">{user.ip_address}</span>
                  </div>
                ) : null}
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
          ) : activeTab === "network" ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-300">{lang === "ru" ? "Настройка сети ZeroDay." : "Configure ZeroDay network."}</div>

              {flashMsg ? (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">{flashMsg}</div>
              ) : null}

              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-sm text-slate-200">{lang === "ru" ? "Сеть (WebSocket)" : "Network (WebSocket)"}</div>
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">{lang === "ru" ? "URL сервера" : "Server URL"}</div>
                  <div className="flex items-center gap-2">
                    <input
                      className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100 outline-none focus:border-cyan-400"
                      value={wsUrlDraft}
                      onChange={(e) => setWsUrlDraft(e.target.value)}
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10"
                      onClick={() => {
                        const v = wsUrlDraft.trim();
                        void patchConfig({ wsUrl: v.length ? v : undefined });
                      }}
                    >
                      {lang === "ru" ? "Применить" : "Apply"}
                    </button>
                  </div>
                  <div className="text-xs text-slate-500">
                    {lang === "ru" ? "После применения соединение переподключится автоматически." : "After apply, reconnect happens automatically."}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "desktop" ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-300">{lang === "ru" ? "Настройка рабочего стола." : "Desktop settings."}</div>

              {flashMsg ? (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">{flashMsg}</div>
              ) : null}

              <div className="space-y-2">
                <div className="text-sm text-slate-200">{lang === "ru" ? "Обои рабочего стола" : "Desktop wallpaper"}</div>
                <div className="grid grid-cols-2 gap-2">
                  {wallpapers.map((w) => {
                    const active = !isCustomActive && w.id === activeWallpaperId;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        className={`rounded-lg border px-2 py-2 text-left transition ${
                          active ? "border-[#2dd4bf] bg-white/5" : "border-white/10 bg-white/0 hover:bg-white/5"
                        }`}
                        onClick={() => void patchConfig({ wallpaper: w.id })}
                      >
                        <div
                          className="mb-2 h-12 w-full rounded-md border border-white/10 overflow-hidden"
                          style={{ background: w.background }}
                        />
                        <div className="text-xs text-slate-200">{lang === "ru" ? w.labelRu : w.labelEn}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-slate-200">{lang === "ru" ? "Свои обои" : "Custom wallpapers"}</div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10"
                    onClick={() => customUploadInputRef.current?.click()}
                  >
                    {lang === "ru" ? "Загрузить" : "Upload"}
                  </button>
                  <input
                    ref={customUploadInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      void (async () => {
                        if (!file) return;
                        try {
                          await initGameFs();
                          const relDir = "Wallpapers";
                          const extRaw = file.name.split(".").pop() ?? "";
                          const ext = `.${extRaw}`.replace(/\.+/g, ".").toLowerCase();
                          const allowed = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
                          if (!allowed.has(ext)) {
                            addToast(lang === "ru" ? "Неподдерживаемый формат файла." : "Unsupported image format.");
                            return;
                          }
                          const base = sanitizeBaseName(file.name.replace(new RegExp(`${extRaw}$`, "i"), ""));
                          const safeBase = base || "wallpaper";
                          const relPath = `${relDir}/${safeBase}${ext}`;
                          const base64 = await fileToBase64(file);
                          await writeBytesBase64Fs(relPath, base64);
                          await refreshCustomWallpapers();
                          await patchConfig({ wallpaper: `${CUSTOM_WALLPAPER_PREFIX}${relPath}` });
                          addToast(lang === "ru" ? "Обои применены" : "Wallpaper applied");
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : String(err);
                          addToast(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
                        }
                      })();
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {customWallpapers.length ? (
                    customWallpapers.map((f) => {
                      const rel = f.relPath;
                      const active = isCustomActive && parseCustomWallpaperRelPath(config.wallpaper ?? null) === rel;
                      return (
                        <button
                          key={rel}
                          type="button"
                          className={`rounded-lg border px-2 py-2 text-left transition ${
                            active ? "border-[#2dd4bf] bg-white/5" : "border-white/10 bg-white/0 hover:bg-white/5"
                          }`}
                          onClick={() => void patchConfig({ wallpaper: `${CUSTOM_WALLPAPER_PREFIX}${rel}` })}
                        >
                          <div
                            className="mb-2 h-12 w-full rounded-md border border-white/10 overflow-hidden bg-black/20"
                            style={{ background: "linear-gradient(180deg,#0b1220,#0d1117)" }}
                          />
                          <div className="text-xs text-slate-200 truncate">{f.name}</div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="col-span-2 text-xs text-slate-400">
                      {lang === "ru" ? "Загрузите изображение, чтобы использовать свои обои." : "Upload an image to use custom wallpapers."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {user ? (
                <div className="space-y-2">
                  <div className="text-sm text-slate-300">
                    {lang === "ru" ? "Профиль аккаунта" : "Account profile"}
                  </div>
                  <div className="settings-row flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-sm text-slate-200">{lang === "ru" ? "Ник" : "Username"}</div>
                    <div className="text-xs text-slate-300">{user.username}</div>
                  </div>
                  <div className="settings-row flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-sm text-slate-200">Email</div>
                    <div className="text-xs text-slate-300">{user.email}</div>
                  </div>
                  <div className="settings-row flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-sm text-slate-200">IP</div>
                    <div className="text-xs text-slate-300">{user.ip_address}</div>
                  </div>
                  <div className="settings-row flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-sm text-slate-200">{lang === "ru" ? "Уровень" : "Level"}</div>
                    <div className="text-xs text-slate-300">{user.level}</div>
                  </div>
                  <div className="settings-row flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-sm text-slate-200">XP</div>
                    <div className="text-xs text-slate-300">{user.xp}</div>
                  </div>
                  <div className="settings-row flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-sm text-slate-200">{lang === "ru" ? "Репутация" : "Reputation"}</div>
                    <div className="text-xs text-slate-300">{user.reputation}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-300">{lang === "ru" ? "Нет данных профиля" : "No profile data"}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

