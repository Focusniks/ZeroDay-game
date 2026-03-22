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
import { useWindowFrame } from "../../desktop/modules/WindowFrameModule";
import { themeIconUrl } from "../../lib/themeIcons";
import { resolveGameTimeZone, formatZonedTime } from "../../lib/zonedClock";

type Props = {
  lang: GameLanguage;
  onClose: () => void;
  onMinimize: () => void;
  minimized?: boolean;
  initialTab?: "system" | "desktop" | "network" | "profile";
  onFocus?: () => void;
  zIndex?: number;
};

type SettingsCategory = "personal" | "hardware" | "system";

type SettingsItem = {
  id: string;
  icon: string;
  labelRu: string;
  labelEn: string;
  category: SettingsCategory;
  action?: () => void;
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
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { config, patchConfig } = useGameConfig();
  const { user } = useAuth();

  // WebSocket URL из .env или значение по умолчанию
  const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8080";
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
    if (initialTab) {
      setActivePanel(initialTab);
    }
  }, [initialTab]);

  const title = useMemo(() => (lang === "ru" ? "Параметры системы" : "System Settings"), [lang]);

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
    defaultSize: { w: 850, h: 650 },
    minSize: { w: 320, h: 220 }
  });

  const maximizedRef = useRef(maximized);
  useEffect(() => {
    maximizedRef.current = maximized;
  }, [maximized]);

  const [maximizedTick, setMaximizedTick] = useState(0);
  const [resizingTick, setResizingTick] = useState(0);

  const onToggleMaximize = () => {
    if (maximizedRef.current) playWindowRestore();
    else playWindowMaximize();
    toggleMaximize();
    setMaximizedTick((v) => v + 1);
  };

  // Current time for system panel
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const gameTimeZone = useMemo(() => resolveGameTimeZone(config.timezone), [config.timezone]);
  const currentTime = useMemo(
    () => formatZonedTime(now.getTime(), gameTimeZone, lang),
    [now, gameTimeZone, lang]
  );

  // Settings items
  const settingsItems: SettingsItem[] = useMemo(() => [
    // Personal
    { id: "desktop", icon: "desktop.svg", labelRu: "Рабочий стол", labelEn: "Desktop", category: "personal" },
    { id: "appearance", icon: "appearance.svg", labelRu: "Внешний вид", labelEn: "Appearance", category: "personal" },
    { id: "language", icon: "language.svg", labelRu: "Язык системы", labelEn: "System Language", category: "personal" },
    { id: "profile", icon: "profile.svg", labelRu: "Профиль", labelEn: "Profile", category: "personal" },
    
    // Hardware
    { id: "displays", icon: "displays.svg", labelRu: "Экраны", labelEn: "Displays", category: "hardware" },
    { id: "power", icon: "power.svg", labelRu: "Питание", labelEn: "Power", category: "hardware" },
    { id: "keyboard", icon: "keyboard.svg", labelRu: "Клавиатура", labelEn: "Keyboard", category: "hardware" },
    { id: "mouse", icon: "mouse.svg", labelRu: "Мышь", labelEn: "Mouse", category: "hardware" },
    { id: "network", icon: "network.svg", labelRu: "Сеть", labelEn: "Network", category: "hardware" },
    { id: "sound", icon: "sound.svg", labelRu: "Звук", labelEn: "Sound", category: "hardware" },
    
    // System
    { id: "system", icon: "info.svg", labelRu: "О системе", labelEn: "About", category: "system" },
    { id: "datetime", icon: "time.svg", labelRu: "Дата и время", labelEn: "Date & Time", category: "system" },
    { id: "timezone", icon: "globe.svg", labelRu: "Часовой пояс", labelEn: "Timezone", category: "system" },
    { id: "updates", icon: "updates.svg", labelRu: "Обновления", labelEn: "Updates", category: "system" },
  ], []);

  const personalItems = settingsItems.filter(i => i.category === "personal");
  const hardwareItems = settingsItems.filter(i => i.category === "hardware");
  const systemItems = settingsItems.filter(i => i.category === "system");

  const handleItemClick = (item: SettingsItem) => {
    if (item.id === "desktop") {
      setActivePanel("desktop");
    } else if (item.id === "language") {
      setActivePanel("language");
    } else if (item.id === "profile") {
      setActivePanel("profile");
    } else if (item.id === "network") {
      setActivePanel("network");
    } else if (item.id === "system") {
      setActivePanel("system");
    } else if (item.id === "datetime") {
      setActivePanel("datetime");
    } else if (item.id === "timezone") {
      setActivePanel("timezone");
    } else if (item.id === "appearance") {
      setActivePanel("appearance");
    } else {
      addToast(lang === "ru" ? "В разработке" : "Coming soon");
    }
  };

  const goBack = () => {
    setActivePanel(null);
    setSearchQuery("");
  };

  // Фильтрация элементов по поиску
  const filterItems = (items: SettingsItem[]) => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      item.labelRu.toLowerCase().includes(query) || 
      item.labelEn.toLowerCase().includes(query)
    );
  };

  const filteredPersonalItems = filterItems(personalItems);
  const filteredHardwareItems = filterItems(hardwareItems);
  const filteredSystemItems = filterItems(systemItems);

  const SettingsTile = ({ item }: { item: SettingsItem }) => (
    <button
      type="button"
      className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-white/5 transition"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        handleItemClick(item);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
    >
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/30 flex items-center justify-center">
        <img src={themeIconUrl(item.icon)} alt="" className="w-7 h-7" />
      </div>
      <span className="text-xs text-slate-300 text-center">{lang === "ru" ? item.labelRu : item.labelEn}</span>
    </button>
  );

  const SectionHeader = ({ titleRu, titleEn }: { titleRu: string; titleEn: string }) => (
    <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 mb-3">
      {lang === "ru" ? titleRu : titleEn}
    </div>
  );

  return (
    <div
      className={`settings-window absolute z-[75] pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl ${
        minimized ? "pointer-events-none opacity-0 scale-95" : ""
      }`}
      onMouseDown={(e) => {
        // Don't focus if clicking on buttons or interactive elements
        if (e.target instanceof HTMLElement && e.target.closest('button')) {
          return;
        }
        onFocus?.();
      }}
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
      {/* Title bar */}
      <div
        className="flex cursor-grab items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#0f766e]/40 via-[#1e1b4b]/30 to-[#0c0a09] px-4 py-2.5"
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
            onClick={onToggleMaximize}
          />
        </div>
        <div className="flex items-center gap-3 flex-1 justify-center">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-teal-500 to-cyan-600 text-xs font-black text-white">
            Z
          </div>
          <div className="text-center text-xs text-slate-300 font-medium">{title}</div>
        </div>
        <div className="w-16" />
      </div>

      {!maximized && (
        <>
          <div className="resize-handle resize-handle--n" onPointerDown={(e) => { onFocus?.(); startResize(e, "n"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--s" onPointerDown={(e) => { onFocus?.(); startResize(e, "s"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--e" onPointerDown={(e) => { onFocus?.(); startResize(e, "e"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--w" onPointerDown={(e) => { onFocus?.(); startResize(e, "w"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--nw" onPointerDown={(e) => { onFocus?.(); startResize(e, "nw"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--ne" onPointerDown={(e) => { onFocus?.(); startResize(e, "ne"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--sw" onPointerDown={(e) => { onFocus?.(); startResize(e, "sw"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--se" onPointerDown={(e) => { onFocus?.(); startResize(e, "se"); setResizingTick((v) => v + 1); }} />
        </>
      )}

      {/* Content */}
      <div className="settings-body flex min-h-0 flex-1 bg-[#0d1117]">
        {!activePanel ? (
          // Main grid view
          <div className="flex-1 overflow-auto p-6">
            {/* Search bar */}
            <div className="mb-6 flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={lang === "ru" ? "Поиск параметров" : "Search settings"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#0f766e]/20 px-4 py-2 pl-9 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-teal-500/50"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-2 rounded-lg hover:bg-white/10 transition"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Personal section */}
            {filteredPersonalItems.length > 0 && (
              <>
                <SectionHeader titleRu="Персональные" titleEn="Personal" />
                <div className="grid grid-cols-7 gap-1 mb-6">
                  {filteredPersonalItems.map(item => (
                    <SettingsTile key={item.id} item={item} />
                  ))}
                </div>
              </>
            )}

            {/* Hardware section */}
            {filteredHardwareItems.length > 0 && (
              <>
                <SectionHeader titleRu="Оборудование" titleEn="Hardware" />
                <div className="grid grid-cols-7 gap-1 mb-6">
                  {filteredHardwareItems.map(item => (
                    <SettingsTile key={item.id} item={item} />
                  ))}
                </div>
              </>
            )}

            {/* System section */}
            {filteredSystemItems.length > 0 && (
              <>
                <SectionHeader titleRu="Система" titleEn="System" />
                <div className="grid grid-cols-7 gap-1">
                  {filteredSystemItems.map(item => (
                    <SettingsTile key={item.id} item={item} />
                  ))}
                </div>
              </>
            )}

            {searchQuery && filteredPersonalItems.length === 0 && filteredHardwareItems.length === 0 && filteredSystemItems.length === 0 && (
              <div className="text-center text-sm text-slate-400 py-8">
                {lang === "ru" ? "Ничего не найдено" : "No results found"}
              </div>
            )}
          </div>
        ) : (
          // Detail panel
          <div className="flex-1 flex flex-col min-h-0">
            {/* Panel header with back button */}
            <div className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-[#0f766e]/30 to-[#1e1b4b]/20 px-4 py-3">
              <button
                type="button"
                onClick={goBack}
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
                aria-label={lang === "ru" ? "Назад" : "Back"}
              >
                <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-sm font-semibold text-slate-200">
                {activePanel === "desktop" && (lang === "ru" ? "Рабочий стол" : "Desktop")}
                {activePanel === "language" && (lang === "ru" ? "Язык системы" : "System Language")}
                {activePanel === "profile" && (lang === "ru" ? "Профиль" : "Profile")}
                {activePanel === "network" && (lang === "ru" ? "Сеть" : "Network")}
                {activePanel === "system" && (lang === "ru" ? "О системе" : "About System")}
                {activePanel === "datetime" && (lang === "ru" ? "Дата и время" : "Date & Time")}
                {activePanel === "timezone" && (lang === "ru" ? "Часовой пояс" : "Timezone")}
                {activePanel === "appearance" && (lang === "ru" ? "Внешний вид" : "Appearance")}
              </h2>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-auto p-6">
              {activePanel === "system" && (
                <div className="space-y-4 max-w-2xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">Z</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">ZeroDay OS</h3>
                      <p className="text-sm text-slate-400">Version 0.1.0</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b border-white/10">
                      <span className="text-sm text-slate-400">{lang === "ru" ? "Ядро" : "Kernel"}</span>
                      <span className="text-sm text-slate-200 font-mono">zeroday-linux 6.6.18</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/10">
                      <span className="text-sm text-slate-400">{lang === "ru" ? "Десктоп" : "Desktop"}</span>
                      <span className="text-sm text-slate-200">ZeroDay Desktop</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/10">
                      <span className="text-sm text-slate-400">Firewall</span>
                      <span className="text-sm text-emerald-400">{lang === "ru" ? "Включен" : "Enabled"}</span>
                    </div>
                    {user && (
                      <>
                        <div className="flex justify-between py-2 border-b border-white/10">
                          <span className="text-sm text-slate-400">{lang === "ru" ? "IP сессии" : "Session IP"}</span>
                          <span className="text-sm text-slate-200 font-mono">{user.ip_address}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/10">
                          <span className="text-sm text-slate-400">{lang === "ru" ? "Пользователь" : "User"}</span>
                          <span className="text-sm text-slate-200">{user.username}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {activePanel === "datetime" && (
                <div className="space-y-4 max-w-2xl">
                  <div className="text-center py-8">
                    <div className="text-5xl font-mono text-white mb-2">{currentTime}</div>
                    <div className="text-sm text-slate-400">
                      {now.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { 
                        weekday: "long", 
                        year: "numeric", 
                        month: "long", 
                        day: "numeric" 
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activePanel === "timezone" && (
                <div className="space-y-4 max-w-2xl">
                  <div className="text-sm text-slate-300 mb-4">
                    {lang === "ru" ? "Выберите часовой пояс:" : "Select timezone:"}
                  </div>
                  <div className="max-h-96 overflow-y-auto rounded-lg border border-white/10 bg-[#0f766e]/20 p-2">
                    {INSTALL_TIMEZONES.map((tz) => {
                      const active = (config.timezone ?? getDefaultTimezoneId()) === tz.id;
                      return (
                        <button
                          key={tz.id}
                          type="button"
                          className={`mb-1 w-full rounded-md px-3 py-2.5 text-left text-sm transition ${
                            active 
                              ? "bg-teal-500/20 border border-teal-500/40" 
                              : "border border-transparent hover:bg-white/5"
                          }`}
                          onClick={() => void patchConfig({ timezone: tz.id })}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-slate-200">{lang === "ru" ? tz.regionRu : tz.regionEn}</span>
                            <span className="text-xs text-slate-500 font-mono">{tz.id}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {activePanel === "language" && (
                <div className="space-y-4 max-w-2xl">
                  <div className="text-sm text-slate-300 mb-4">
                    {lang === "ru" ? "Выберите язык интерфейса:" : "Select interface language:"}
                  </div>
                  <div className="grid gap-3">
                    <button
                      type="button"
                      className={`p-4 rounded-lg border text-left transition ${
                        lang === "ru" 
                          ? "bg-teal-500/20 border-teal-500/40" 
                          : "border-white/10 bg-[#0f766e]/20 hover:bg-white/5"
                      }`}
                      onClick={() => void patchConfig({ gameLanguage: "ru" })}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">Русский</div>
                          <div className="text-xs text-slate-400 mt-1">Russian</div>
                        </div>
                        {lang === "ru" && (
                          <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`p-4 rounded-lg border text-left transition ${
                        lang === "en" 
                          ? "bg-teal-500/20 border-teal-500/40" 
                          : "border-white/10 bg-[#0f766e]/20 hover:bg-white/5"
                      }`}
                      onClick={() => void patchConfig({ gameLanguage: "en" })}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">English</div>
                          <div className="text-xs text-slate-400 mt-1">Английский</div>
                        </div>
                        {lang === "en" && (
                          <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {activePanel === "desktop" && (
                <div className="space-y-4 max-w-2xl">
                  <div className="text-sm text-slate-300 mb-4">
                    {lang === "ru" ? "Обои рабочего стола" : "Desktop wallpaper"}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {wallpapers.map((w) => {
                      const active = !isCustomActive && w.id === activeWallpaperId;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          className={`rounded-lg border overflow-hidden transition ${
                            active ? "border-cyan-500/60 ring-2 ring-cyan-500/30" : "border-white/10 hover:border-white/30"
                          }`}
                          onClick={() => void patchConfig({ wallpaper: w.id })}
                        >
                          <div className="aspect-video w-full" style={{ background: w.background }} />
                          <div className="px-2 py-1.5 text-xs text-slate-300 text-center">
                            {lang === "ru" ? w.labelRu : w.labelEn}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        type="button"
                        className="rounded-md border border-white/10 bg-[#1a1f29] px-3 py-1.5 text-xs hover:bg-white/10 transition"
                        onClick={() => customUploadInputRef.current?.click()}
                      >
                        {lang === "ru" ? "Загрузить свои" : "Upload custom"}
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
                                addToast(lang === "ru" ? "Неподдерживаемый формат." : "Unsupported format.");
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
                    {customWallpapers.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {customWallpapers.map((f) => {
                          const rel = f.relPath;
                          const active = isCustomActive && parseCustomWallpaperRelPath(config.wallpaper ?? null) === rel;
                          return (
                            <button
                              key={rel}
                              type="button"
                              className={`rounded-lg border overflow-hidden transition ${
                                active ? "border-cyan-500/60 ring-2 ring-cyan-500/30" : "border-white/10 hover:border-white/30"
                              }`}
                              onClick={() => void patchConfig({ wallpaper: `${CUSTOM_WALLPAPER_PREFIX}${rel}` })}
                            >
                              <div className="aspect-video w-full bg-gradient-to-br from-slate-800 to-slate-900" />
                              <div className="px-2 py-1.5 text-xs text-slate-300 truncate">{f.name}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activePanel === "appearance" && (
                <div className="space-y-4 max-w-2xl">
                  <div className="text-sm text-slate-300">
                    {lang === "ru" ? "Настройки внешнего вида в разработке" : "Appearance settings coming soon"}
                  </div>
                </div>
              )}

              {activePanel === "profile" && (
                <div className="space-y-4 max-w-2xl">
                  {user ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-xl font-bold text-white">
                          {user.username[0]?.toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{user.username}</h3>
                          <p className="text-sm text-slate-400">{user.email}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between py-2.5 px-3 rounded-lg bg-[#1a1f29] border border-white/10">
                          <span className="text-sm text-slate-400">{lang === "ru" ? "ID" : "User ID"}</span>
                          <span className="text-sm text-slate-200 font-mono">{user.id.slice(0, 8)}...</span>
                        </div>
                        <div className="flex justify-between py-2.5 px-3 rounded-lg bg-[#1a1f29] border border-white/10">
                          <span className="text-sm text-slate-400">{lang === "ru" ? "IP адрес" : "IP Address"}</span>
                          <span className="text-sm text-slate-200 font-mono">{user.ip_address}</span>
                        </div>
                        <div className="flex justify-between py-2.5 px-3 rounded-lg bg-[#1a1f29] border border-white/10">
                          <span className="text-sm text-slate-400">{lang === "ru" ? "Уровень" : "Level"}</span>
                          <span className="text-sm text-cyan-400 font-semibold">{user.level}</span>
                        </div>
                        <div className="flex justify-between py-2.5 px-3 rounded-lg bg-[#1a1f29] border border-white/10">
                          <span className="text-sm text-slate-400">XP</span>
                          <span className="text-sm text-emerald-400 font-semibold">{user.xp}</span>
                        </div>
                        <div className="flex justify-between py-2.5 px-3 rounded-lg bg-[#1a1f29] border border-white/10">
                          <span className="text-sm text-slate-400">{lang === "ru" ? "Репутация" : "Reputation"}</span>
                          <span className="text-sm text-amber-400 font-semibold">{user.reputation}</span>
                        </div>
                        <div className="flex justify-between py-2.5 px-3 rounded-lg bg-[#1a1f29] border border-white/10">
                          <span className="text-sm text-slate-400">{lang === "ru" ? "Диск" : "Disk Capacity"}</span>
                          <span className="text-sm text-slate-200">{user.disk_capacity_mb} MB</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-300">
                      {lang === "ru" ? "Нет данных профиля" : "No profile data"}
                    </div>
                  )}
                </div>
              )}

              {activePanel === "network" && (
                <div className="space-y-4 max-w-2xl">
                  <div className="space-y-2 rounded-lg border border-white/10 bg-[#0f766e]/20 p-4">
                    <div className="text-sm text-slate-200 mb-3">{lang === "ru" ? "Сеть (WebSocket)" : "Network (WebSocket)"}</div>
                    <div className="space-y-2">
                      <div className="text-xs text-slate-400">{lang === "ru" ? "URL сервера" : "Server URL"}</div>
                      <div className="flex items-center gap-2">
                        <input
                          className="flex-1 rounded-md border border-white/10 bg-[#0d1117] px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500/50"
                          value={wsUrlDraft}
                          onChange={(e) => setWsUrlDraft(e.target.value)}
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          className="rounded-md border border-teal-500/30 bg-teal-500/20 px-4 py-2 text-xs text-teal-300 hover:bg-teal-500/30 transition"
                          onClick={() => {
                            const v = wsUrlDraft.trim();
                            void patchConfig({ wsUrl: v.length ? v : undefined });
                            addToast(lang === "ru" ? "Применено" : "Applied");
                          }}
                        >
                          {lang === "ru" ? "Применить" : "Apply"}
                        </button>
                      </div>
                      <div className="text-xs text-slate-500">
                        {lang === "ru" ? "После применения соединение переподключится автоматически." : "Connection will reconnect automatically after apply."}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Flash message */}
      {flashMsg && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="rounded-lg border border-teal-500/30 bg-gradient-to-r from-[#0f766e]/90 to-[#1e1b4b]/90 px-4 py-2 text-sm text-slate-200 shadow-lg backdrop-blur-sm">
            {flashMsg}
          </div>
        </div>
      )}
    </div>
  );
}
