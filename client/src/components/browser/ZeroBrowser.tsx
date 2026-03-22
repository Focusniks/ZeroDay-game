import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { GameLanguage } from "../../lib/gameConfig";
import { useWindowFrame } from "../../desktop/modules/WindowFrameModule";
import { playWindowClose, playWindowMaximize, playWindowMinimize, playWindowRestore } from "../../lib/osSounds";
import { useAuth } from "../../hooks/useAuth";
import { themeIconUrl } from "../../lib/themeIcons";
import { eventBus, DesktopEvents } from "../../desktop/modules/EventBus";
import { notificationManager } from "../../desktop/modules/NotificationModule/NotificationModule";

const BROWSER_API_ORIGIN = "http://127.0.0.1:8000";

function parseZerodaySearchQuery(url: string): string {
  const m = url.match(/^zeroday:\/\/search\??(.*)$/i);
  if (!m?.[1]) return "";
  try {
    return new URLSearchParams(m[1]).get("q")?.trim() ?? "";
  } catch {
    return "";
  }
}

function browserPagePath(url: string): string {
  return url.split("?")[0]?.split("#")[0] ?? "";
}

function resolveIconSrc(raw: string | null | undefined): string | null {
  const u = raw?.trim();
  if (!u) return null;
  if (u.startsWith("data:") || u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) {
    if (typeof window !== "undefined") return `${window.location.origin}${u}`;
    return u;
  }
  if (typeof window !== "undefined") return `${window.location.origin}/${u.replace(/^\//, "")}`;
  return u;
}

/** Домашняя и часть системных страниц без каталога; остальное — заглушка офлайн. */
function isOfflineAllowedBrowserPage(url: string): boolean {
  const path = url.split("?")[0]?.split("#")[0] ?? "";
  return (
    path === "zeroday://home" ||
    path.startsWith("zeroday://settings") ||
    path === "zeroday://history"
  );
}

function mapApiSiteRow(row: Record<string, unknown>): Site {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    url: String(row.url ?? ""),
    description: row.description != null ? String(row.description) : undefined,
    icon_url: row.icon_url != null ? String(row.icon_url) : undefined,
    category: String(row.category ?? "general")
  };
}

function shuffleDiscoverPool<T extends { id: string }>(items: T[], seedStr: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    h = (h + 0x6d2b79f5) | 0;
    const j = Math.abs(h) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Props = {
  lang: GameLanguage;
  minimized?: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onFocus?: () => void;
  zIndex?: number;
  isOnline?: boolean;
  bandwidth?: number;
};

type BrowserTab = {
  id: string;
  title: string;
  url: string;
};

type Site = {
  id: string;
  name: string;
  url: string;
  description?: string;
  icon_url?: string;
  category: string;
};

/** Favicon URL for tab: zeroday pages → theme icons, sites → icon_url, https → Google favicon API */
function getTabFaviconUrl(tab: { url: string; title: string }, sites: Site[]): string | null {
  const path = tab.url.split("?")[0]?.split("#")[0] ?? "";
  if (path === "zeroday://home") return themeIconUrl("breeze/places/user-home.svg");
  if (path === "zeroday://search") return themeIconUrl("globe.svg");
  if (path === "zeroday://bookmarks") return themeIconUrl("breeze/places/document-recent.svg");
  if (path === "zeroday://history") return themeIconUrl("time.svg");
  if (path.startsWith("zeroday://settings")) return themeIconUrl("settings.svg");
  if (path === "zeroday://404") return themeIconUrl("info.svg");
  const site = sites.find((s) => s.url === tab.url || path.startsWith(s.url));
  if (site?.icon_url) return resolveIconSrc(site.icon_url) ?? null;
  try {
    const u = new URL(tab.url);
    if (u.protocol === "https:" || u.protocol === "http:")
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=32`;
  } catch {
    /* ignore */
  }
  return null;
}

type Bookmark = {
  id: string;
  site_id?: string;
  custom_url?: string;
  custom_name?: string;
  custom_icon_url?: string;
  position: number;
};

type BrowserHistoryEntry = {
  id: string;
  url: string;
  title?: string;
  visited_at: string;
};

function mapApiHistoryRow(row: Record<string, unknown>): BrowserHistoryEntry {
  return {
    id: String(row.id ?? ""),
    url: String(row.url ?? ""),
    title: row.title != null ? String(row.title) : undefined,
    visited_at: String(row.visited_at ?? ""),
  };
}

const BROWSER_HISTORY_LS_KEY = "zeroday.browserHistory.v1";

/** Страницы браузера, которые не пишем в историю (в т.ч. поиск с любым запросом). */
function shouldAppendBrowserHistory(url: string): boolean {
  const path = browserPagePath(url);
  if (
    path === "zeroday://home" ||
    path.startsWith("zeroday://settings") ||
    path === "zeroday://bookmarks" ||
    path === "zeroday://history" ||
    path === "zeroday://404"
  ) {
    return false;
  }
  if (path === "zeroday://search") return false;
  return true;
}

function readLocalBrowserHistory(): BrowserHistoryEntry[] {
  try {
    const raw = localStorage.getItem(BROWSER_HISTORY_LS_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p
      .map((row) => mapApiHistoryRow(row as Record<string, unknown>))
      .filter((e) => e.id && e.url);
  } catch {
    return [];
  }
}

function writeLocalBrowserHistory(entries: BrowserHistoryEntry[]) {
  try {
    localStorage.setItem(BROWSER_HISTORY_LS_KEY, JSON.stringify(entries.slice(0, 300)));
  } catch {
    /* ignore quota */
  }
}

function appendLocalBrowserHistory(url: string, title: string) {
  const entries = readLocalBrowserHistory();
  const now = Date.now();
  const first = entries[0];
  if (first && first.url === url) {
    const t = new Date(first.visited_at).getTime();
    if (!Number.isNaN(t) && now - t < 2500) return;
  }
  const e: BrowserHistoryEntry = {
    id: `local-${now}-${Math.random().toString(36).slice(2, 9)}`,
    url,
    title,
    visited_at: new Date(now).toISOString(),
  };
  writeLocalBrowserHistory([e, ...entries]);
}

function mapApiBookmark(row: Record<string, unknown>): Bookmark {
  return {
    id: String(row.id ?? ""),
    site_id: row.site_id != null ? String(row.site_id) : undefined,
    custom_url: row.custom_url != null ? String(row.custom_url) : undefined,
    custom_name: row.custom_name != null ? String(row.custom_name) : undefined,
    custom_icon_url: row.custom_icon_url != null ? String(row.custom_icon_url) : undefined,
    position: typeof row.position === "number" ? row.position : Number(row.position ?? 0),
  };
}

function SiteIconFallback({ size = "md" }: { size?: "xs" | "sm" | "md" | "lg" | "xl" }) {
  const sizes = {
    xs: "w-4 h-4",
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-10 h-10",
  };
  return (
    <div
      className={`${sizes[size]} rounded-lg bg-gradient-to-br from-indigo-500 via-violet-600 to-cyan-600 flex items-center justify-center shadow-inner ring-1 ring-white/15`}
      aria-hidden
    >
      <svg className="w-[55%] h-[55%] text-white/95" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    </div>
  );
}

// Компонент для отображения иконки сайта
function SiteIcon({ url, alt, size = "md" }: { url?: string | null; alt: string; size?: "xs" | "sm" | "md" | "lg" | "xl" }) {
  const sizes = {
    xs: "w-4 h-4",
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-10 h-10",
  };

  const [failed, setFailed] = useState(false);
  const raw = url?.trim() ?? "";
  const isEmojiLike = raw.length > 0 && raw.length <= 4 && !/[./:]/.test(raw);
  const resolved = useMemo(() => resolveIconSrc(isEmojiLike ? null : url), [url, isEmojiLike]);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  if (isEmojiLike) {
    return <span className={`${sizes[size]} flex items-center justify-center text-lg leading-none`}>{raw}</span>;
  }

  if (!resolved || failed) {
    return <SiteIconFallback size={size} />;
  }

  const tile = `${sizes[size]} rounded-lg bg-white flex items-center justify-center overflow-hidden ring-1 ring-slate-600/40 shadow-sm`;

  return (
    <div className={tile} title={alt}>
      <img
        src={resolved}
        alt=""
        className="max-w-[88%] max-h-[88%] object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// Компонент карточки результата поиска
function SearchResultCard({ site, onClick }: { site: Site; onClick: () => void }) {
  // Извлекаем hostname из URL
  const getHostname = (url: string) => {
    if (url.startsWith('zeroday://')) {
      return url.replace('zeroday://', '');
    }
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left group transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <SiteIcon url={site.icon_url} alt={site.name} size="md" />
        </div>
        <div className="flex-1 min-w-0">
          {/* URL / Breadcrumb */}
          <div className="flex items-center gap-2 mb-1">
            <div className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400 truncate max-w-md">
              {getHostname(site.url)}
            </div>
          </div>
          
          {/* Title */}
          <h3 className="text-lg font-medium text-blue-400 group-hover:text-blue-300 group-hover:underline transition-colors truncate mb-1">
            {site.name}
          </h3>
          
          {/* Description */}
          {site.description && (
            <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
              {site.description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

type BrowserSettings = {
  homepage_url: string;
  theme: string;
  show_bookmarks_bar: boolean;
  auto_play_media: boolean;
  block_popups: boolean;
};

type NotificationType = "info" | "success" | "warning" | "error";

type Notification = {
  id: string;
  type: NotificationType;
  message: string;
};

type NavigateToOptions = {
  immediate?: boolean;
  skipServerHistory?: boolean;
  /** По умолчанию запись в стек вкладки; `none` — только сменить URL (назад/вперёд). */
  tabHistory?: "push" | "none";
};

const NOTIFICATION_DISPLAY_MS = 2600;

function BrowserNotificationToast({
  notif,
  onDismiss,
  closeLabel
}: {
  notif: Notification;
  onDismiss: () => void;
  closeLabel: string;
}) {
  const accent =
    notif.type === "error"
      ? { bar: "bg-red-500", iconBg: "bg-red-500/15 text-red-400", Icon: IconToastError }
      : notif.type === "success"
        ? { bar: "bg-emerald-500", iconBg: "bg-emerald-500/15 text-emerald-400", Icon: IconToastSuccess }
        : notif.type === "warning"
          ? { bar: "bg-amber-500", iconBg: "bg-amber-500/15 text-amber-400", Icon: IconToastWarning }
          : { bar: "bg-blue-500", iconBg: "bg-blue-500/15 text-blue-400", Icon: IconToastInfo };
  const { bar, iconBg, Icon } = accent;

  return (
    <div
      role="alert"
      className="pointer-events-auto flex w-full max-w-sm overflow-hidden rounded-lg border border-slate-600/60 bg-slate-900/95 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md animate-in slide-in-from-right-3 fade-in zoom-in-95 duration-200"
    >
      <div className={`w-1 shrink-0 ${bar}`} aria-hidden />
      <div className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-3 pr-2">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
          <Icon />
        </div>
        <p className="min-w-0 flex-1 pt-1 text-sm leading-snug text-slate-100">{notif.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
          aria-label={closeLabel}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function IconToastError() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function IconToastSuccess() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconToastWarning() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86a1 1 0 00.87-1.48l-6.93-12a1 1 0 00-1.74 0l-6.93 12a1 1 0 00.87 1.48z" />
    </svg>
  );
}

function IconToastInfo() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 18a9 9 0 110-18 9 9 0 010 18z" />
    </svg>
  );
}

const SYSTEM_PAGES = [
  { url: "zeroday://home", title: "Home" },
  { url: "zeroday://search", title: "Search" },
  { url: "zeroday://bookmarks", title: "Bookmarks" },
  { url: "zeroday://history", title: "History" },
  { url: "zeroday://settings", title: "Settings" },
  { url: "zeroday://404", title: "Not Found" },
];

const LEGACY_SITE_SLUGS: Record<string, string> = {
  "zerogram.com": "messenger",
  "cryptowallet.network": "crypto",
  "cloudpro.network": "hosting",
  "fasthost.network": "hosting",
  "securehost.network": "hosting",
  "budgethost.network": "hosting",
  "freenet.network": "isp",
  "speedmax.network": "isp",
  "homenet.network": "isp",
  "fiberoptic.network": "isp",
};

function resolveSiteSlugFromUrl(siteUrl: string): string | null {
  if (!siteUrl) return null;

  if (siteUrl.startsWith("zeroday://")) {
    const remainder = siteUrl.replace("zeroday://", "");
    const slug = remainder.split(/[/?#]/)[0]?.trim().toLowerCase();
    return slug || null;
  }

  try {
    const hostname = new URL(siteUrl).hostname.toLowerCase();
    if (LEGACY_SITE_SLUGS[hostname]) {
      return LEGACY_SITE_SLUGS[hostname];
    }
    const firstLabel = hostname.split(".")[0]?.trim().toLowerCase();
    return firstLabel || null;
  } catch {
    return null;
  }
}

export function ZeroBrowser({
  lang,
  minimized = false,
  onMinimize,
  onClose,
  onFocus,
  zIndex,
  isOnline = false,
  bandwidth = 0
}: Props) {
  const title = "Zero Browser";
  const { user } = useAuth();

  const [tabs, setTabs] = useState<BrowserTab[]>([
    { id: "tab-1", title: lang === "ru" ? "Домашняя" : "Home", url: "zeroday://home" }
  ]);
  const [activeTabId, setActiveTabId] = useState("tab-1");
  const [urlInput, setUrlInput] = useState("zeroday://home");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<string[]>(["zeroday://home"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Data from backend
  const [sites, setSites] = useState<Site[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [settings, setSettings] = useState<BrowserSettings>({
    homepage_url: "zeroday://home",
    theme: "dark",
    show_bookmarks_bar: true,
    auto_play_media: true,
    block_popups: true
  });
  /** Локальный черновик на странице настроек; в БД уходит только по кнопке «Сохранить». */
  const [settingsForm, setSettingsForm] = useState<BrowserSettings>({
    homepage_url: "zeroday://home",
    theme: "dark",
    show_bookmarks_bar: true,
    auto_play_media: true,
    block_popups: true
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchRemoteResults, setSearchRemoteResults] = useState<Site[]>([]);
  const [searchRemoteLoading, setSearchRemoteLoading] = useState(false);
  const [bookmarkBarMenu, setBookmarkBarMenu] = useState<null | { x: number; y: number; id: string }>(null);
  const [newBookmarkTitle, setNewBookmarkTitle] = useState("");
  const [newBookmarkUrlInput, setNewBookmarkUrlInput] = useState("");
  const [bookmarkEdit, setBookmarkEdit] = useState<null | { id: string; name: string; url: string }>(null);
  const [browserMenuOpen, setBrowserMenuOpen] = useState(false);
  const [discoverCount, setDiscoverCount] = useState(24);
  const [browserHistoryEntries, setBrowserHistoryEntries] = useState<BrowserHistoryEntry[]>([]);
  const [browserHistoryLoading, setBrowserHistoryLoading] = useState(false);

  const { rect, maximized, startDrag, startResize, toggleMaximize } = useWindowFrame({
    defaultSize: { w: 1100, h: 750 },
    minSize: { w: 600, h: 400 }
  });

  const maximizedRef = useRef(maximized);
  useEffect(() => {
    maximizedRef.current = maximized;
  }, [maximized]);

  const [maximizedTick, setMaximizedTick] = useState(0);
  const [resizingTick, setResizingTick] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const bookmarkMenuRef = useRef<HTMLDivElement>(null);
  const browserMenuRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const discoverSentinelRef = useRef<HTMLDivElement>(null);
  const lastHistoryPostRef = useRef<{ url: string; at: number } | null>(null);

  const onToggleMaximize = () => {
    if (maximizedRef.current) playWindowRestore();
    else playWindowMaximize();
    toggleMaximize();
    setMaximizedTick((v) => v + 1);
  };

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId), [tabs, activeTabId]);

  // Слушаем сообщения от iframe (messenger)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Проверяем, что сообщение от нашего источника
      if (!event.data || typeof event.data !== 'object') return;
      
      const { type, payload } = event.data;
      if (!type || !type.startsWith('zeroday:')) return;
      
      const eventType = type.replace('zeroday:', '');
      
      switch (eventType) {
        case 'message_received': {
          // Новое сообщение в мессенджере
          const { message, isChatOpen } = payload || {};
          
          // Показываем уведомление на десктопе
          if (!isChatOpen && message) {
            const senderName = message.sender_username || 'Unknown';
            notificationManager.show({
              title: lang === 'ru' ? 'Новое сообщение' : 'New message',
              message: `${senderName}: ${message.content?.substring(0, 50)}${message.content?.length > 50 ? '...' : ''}`,
              type: 'info',
              duration: 5000
            });
            
            // Отправляем событие для обновления badge
            eventBus.emit('messenger:new_message', { message });
          }
          break;
        }
        
        case 'unread_count': {
          // Обновление количества непрочитанных сообщений
          const { count } = payload || {};
          if (typeof count === 'number') {
            eventBus.emit('messenger:unread_count', { count });
          }
          break;
        }
        
        case 'notification': {
          // Пробрасываем уведомление от мессенджера
          const { message, notificationType } = payload || {};
          if (message) {
            notificationManager.show({
              title: 'ZeroDay Messenger',
              message,
              type: notificationType || 'info',
              duration: 4000
            });
          }
          break;
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [lang]);

  useEffect(() => {
    if (!isOnline) {
      setSites([]);
      setSearchRemoteResults([]);
      setSearchRemoteLoading(false);
      setIsLoadingData(false);
      return;
    }

    const loadData = async () => {
      setIsLoadingData(true);
      try {
        const sitesRes = await fetch(`${BROWSER_API_ORIGIN}/api/browser/sites`);
        if (sitesRes.ok) {
          const json: unknown = await sitesRes.json();
          const raw = Array.isArray(json) ? json : [];
          setSites(raw.map((row) => mapApiSiteRow(row as Record<string, unknown>)));
        } else {
          setSites([]);
        }

        const token = localStorage.getItem("zeroday.token");
        if (user && token) {
          const [bookmarksRes, settingsRes] = await Promise.all([
            fetch(`${BROWSER_API_ORIGIN}/api/browser/bookmarks`, {
              headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`${BROWSER_API_ORIGIN}/api/browser/settings`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          ]);

          if (bookmarksRes.ok) {
            const bjson: unknown = await bookmarksRes.json();
            const brows = Array.isArray(bjson) ? bjson : [];
            setBookmarks(brows.map((row) => mapApiBookmark(row as Record<string, unknown>)));
          }
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            setSettings(settingsData);
          }
        } else {
          setBookmarks([]);
        }
      } catch (err) {
        console.error("Failed to load browser data:", err);
        setSites([]);
      } finally {
        setIsLoadingData(false);
      }
    };

    void loadData();
  }, [isOnline, user]);

  useEffect(() => {
    if (!isOnline || !activeTab?.url.startsWith("zeroday://search")) {
      setSearchRemoteResults([]);
      setSearchRemoteLoading(false);
      return;
    }

    const q = parseZerodaySearchQuery(activeTab.url);
    if (!q) {
      setSearchRemoteResults([]);
      setSearchRemoteLoading(false);
      return;
    }

    const ac = new AbortController();
    setSearchRemoteLoading(true);

    void (async () => {
      try {
        const res = await fetch(
          `${BROWSER_API_ORIGIN}/api/browser/search?q=${encodeURIComponent(q)}`,
          { signal: ac.signal }
        );
        if (!res.ok) {
          setSearchRemoteResults([]);
          return;
        }
        const json: unknown = await res.json();
        const raw = Array.isArray(json) ? json : [];
        setSearchRemoteResults(raw.map((row) => mapApiSiteRow(row as Record<string, unknown>)));
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setSearchRemoteResults([]);
        }
      } finally {
        if (!ac.signal.aborted) {
          setSearchRemoteLoading(false);
        }
      }
    })();

    return () => ac.abort();
  }, [isOnline, activeTab?.url]);

  useEffect(() => {
    if (activeTab) {
      setUrlInput(activeTab.url);
      if (activeTab.url.startsWith("zeroday://search")) {
        setSearchQuery(parseZerodaySearchQuery(activeTab.url));
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (browserPagePath(activeTab?.url ?? "") === "zeroday://settings") {
      setSettingsForm(settings);
    }
  }, [activeTab?.url, settings]);

  useEffect(() => {
    if (!bookmarkBarMenu) return;
    const onDown = (e: PointerEvent) => {
      if (bookmarkMenuRef.current?.contains(e.target as Node)) return;
      setBookmarkBarMenu(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [bookmarkBarMenu]);

  useEffect(() => {
    if (browserPagePath(activeTab?.url ?? "") !== "zeroday://bookmarks") {
      setBookmarkEdit(null);
    }
  }, [activeTab?.url]);

  useEffect(() => {
    if (!browserMenuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (browserMenuRef.current?.contains(e.target as Node)) return;
      setBrowserMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [browserMenuOpen]);

  useEffect(() => {
    if (browserPagePath(activeTab?.url ?? "") !== "zeroday://history") {
      return;
    }
    const token = localStorage.getItem("zeroday.token");
    if (!user || !token) {
      setBrowserHistoryEntries(readLocalBrowserHistory());
      setBrowserHistoryLoading(false);
      return;
    }
    const ac = new AbortController();
    setBrowserHistoryLoading(true);
    void (async () => {
      try {
        const res = await fetch(`${BROWSER_API_ORIGIN}/api/browser/history?limit=300`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ac.signal,
        });
        if (res.ok) {
          const j: unknown = await res.json();
          const raw = Array.isArray(j) ? j : [];
          const apiEntries = raw.map((row) => mapApiHistoryRow(row as Record<string, unknown>));
          if (apiEntries.length > 0) {
            setBrowserHistoryEntries(apiEntries);
          } else {
            setBrowserHistoryEntries(readLocalBrowserHistory());
          }
        } else {
          setBrowserHistoryEntries(readLocalBrowserHistory());
        }
      } catch {
        if (!ac.signal.aborted) setBrowserHistoryEntries(readLocalBrowserHistory());
      } finally {
        if (!ac.signal.aborted) setBrowserHistoryLoading(false);
      }
    })();
    return () => ac.abort();
  }, [user, activeTab?.url]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((type: NotificationType, message: string) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setNotifications((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, NOTIFICATION_DISPLAY_MS);
  }, []);

  const addNewTab = () => {
    const newTab: BrowserTab = {
      id: `tab-${Date.now()}`,
      title: lang === "ru" ? "Новая вкладка" : "New Tab",
      url: settings.homepage_url || "zeroday://home"
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setUrlInput(newTab.url);
  };

  const closeTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      playWindowClose();
      onClose();
      return;
    }

    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
      setActiveTabId(newTabs[newActiveIndex].id);
      setUrlInput(newTabs[newActiveIndex].url);
    }
  };

  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  // HTML5 DnD часто не работает в WebView2 (Tauri); перетаскивание вкладок — через Pointer Events.
  const tabPointerDragRef = useRef<{
    pointerId: number;
    tabId: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const dragOverTabIdRef = useRef<string | null>(null);
  const skipNextTabClickRef = useRef(false);

  const onTabPointerDown = (e: React.PointerEvent<HTMLDivElement>, tabId: string) => {
    if ((e.target as HTMLElement).closest("button")) return;
    tabPointerDragRef.current = {
      pointerId: e.pointerId,
      tabId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    setDraggedTabId(tabId);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onTabPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = tabPointerDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > 5) d.moved = true;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const hit = el?.closest?.("[data-browser-tab-id]");
    const id = hit?.getAttribute("data-browser-tab-id");
    if (id && id !== d.tabId) {
      dragOverTabIdRef.current = id;
      setDragOverTabId(id);
    } else if (!id || id === d.tabId) {
      dragOverTabIdRef.current = null;
      setDragOverTabId(null);
    }
  };

  const onTabPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = tabPointerDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    tabPointerDragRef.current = null;
    const targetId = dragOverTabIdRef.current;
    dragOverTabIdRef.current = null;
    setDragOverTabId(null);
    setDraggedTabId(null);
    if (d.moved && targetId && targetId !== d.tabId) {
      skipNextTabClickRef.current = true;
      setTabs((prev) => {
        const fromIdx = prev.findIndex((t) => t.id === d.tabId);
        const toIdx = prev.findIndex((t) => t.id === targetId);
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
        const next = [...prev];
        const [removed] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, removed);
        return next;
      });
    }
  };

  const onTabPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = tabPointerDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    tabPointerDragRef.current = null;
    dragOverTabIdRef.current = null;
    setDragOverTabId(null);
    setDraggedTabId(null);
  };

  const recordServerHistory = useCallback(
    (url: string, title: string, skip?: boolean) => {
      if (skip) return;
      if (!shouldAppendBrowserHistory(url)) return;
      const now = Date.now();
      const prev = lastHistoryPostRef.current;
      if (prev && prev.url === url && now - prev.at < 2500) return;
      lastHistoryPostRef.current = { url, at: now };

      appendLocalBrowserHistory(url, title);

      if (!user) return;

      const token = localStorage.getItem("zeroday.token");
      if (!token) return;

      void fetch(`${BROWSER_API_ORIGIN}/api/browser/history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url, title }),
      }).catch(() => {});
    },
    [user]
  );

  const navigateTo = useCallback(
    (url: string, options?: NavigateToOptions) => {
      const pathOnly = url.split("?")[0]?.split("#")[0] ?? "";

      if (!isOnline && pathOnly.startsWith("zeroday://search")) {
        addNotification(
          "error",
          lang === "ru" ? "Поиск недоступен без интернета" : "Search requires an internet connection"
        );
        return;
      }

      if (!isOnline && !url.startsWith("zeroday://")) {
        addNotification("error", lang === "ru" ? "Нет подключения к интернету" : "No internet connection");
        return;
      }

      const isSystemPage = SYSTEM_PAGES.some((p) => url.startsWith(p.url));
      const isKnownSite = sites.some((s) => s.url === url);
      const legacyKnownSite = Boolean(resolveSiteSlugFromUrl(url));

      if (!isOnline && !isSystemPage && !isKnownSite && !legacyKnownSite) {
        addNotification("error", lang === "ru" ? "Требуется подключение к сети" : "Network connection required");
        return;
      }

      if (!isSystemPage && !isKnownSite && url.startsWith("zeroday://")) {
        setIsLoading(true);
        setTimeout(() => {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === activeTabId ? { ...t, url: "zeroday://404", title: "404 Not Found" } : t
            )
          );
          setUrlInput("zeroday://404");
          setIsLoading(false);
        }, 300);
        return;
      }

      const applyNavigation = () => {
        const site = sites.find((s) => s.url === url);
        const systemPage = SYSTEM_PAGES.find((p) => url.startsWith(p.url));
        const slug = resolveSiteSlugFromUrl(url);
        const title =
          site?.name ||
          systemPage?.title ||
          (legacyKnownSite && slug ? slug : url);

        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, url, title } : t))
        );
        if (options?.tabHistory !== "none") {
          setHistory((prev) => [...prev.slice(0, historyIndex + 1), url]);
          setHistoryIndex((prev) => prev + 1);
        }
        setUrlInput(url);
        setIsLoading(false);
        onFocus?.();
        recordServerHistory(url, title, options?.skipServerHistory);
      };

      if (options?.immediate) {
        applyNavigation();
        return;
      }

      setIsLoading(true);
      const loadTime = bandwidth > 0 ? Math.max(300, 1000 - bandwidth * 5) : 500;
      setTimeout(applyNavigation, loadTime);
    },
    [
      isOnline,
      bandwidth,
      sites,
      activeTabId,
      historyIndex,
      lang,
      addNotification,
      onFocus,
      recordServerHistory,
    ]
  );

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (!isOnline) {
      addNotification("error", lang === "ru" ? "Поиск недоступен без интернета" : "Search requires an internet connection");
      return;
    }
    const searchUrl = `zeroday://search?q=${encodeURIComponent(searchQuery)}`;
    navigateTo(searchUrl);
    setShowSuggestions(false);
  }, [searchQuery, navigateTo, isOnline, lang, addNotification]);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    let url = urlInput.trim();
    
    // Проверяем, является ли ввод доменом с зоной (например: cloudpro.network)
    const domainWithTldRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    const hasProtocol = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('zeroday://');
    
    if (!hasProtocol && domainWithTldRegex.test(url)) {
      // Это домен с зоной - добавляем https://
      url = `https://${url}`;
    } else if (!hasProtocol && !url.startsWith('zeroday://')) {
      // Это не домен и не протокол - считаем поисковым запросом
      const searchUrl = `zeroday://search?q=${encodeURIComponent(url)}`;
      navigateTo(searchUrl);
      setShowSuggestions(false);
      return;
    }
    
    navigateTo(url);
  }, [urlInput, navigateTo]);

  const goBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    navigateTo(history[newIndex], { immediate: true, tabHistory: "none", skipServerHistory: true });
  }, [historyIndex, history, navigateTo]);

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    navigateTo(history[newIndex], { immediate: true, tabHistory: "none", skipServerHistory: true });
  }, [historyIndex, history, navigateTo]);

  const goHome = useCallback(() => {
    navigateTo(settings.homepage_url || "zeroday://home");
  }, [navigateTo, settings.homepage_url]);

  const handleSiteClick = useCallback((url: string) => {
    navigateTo(url);
  }, [navigateTo]);

  const goToBookmarksAndEdit = useCallback(
    (bookmarkId: string) => {
      const b = bookmarks.find((x) => x.id === bookmarkId);
      if (!b) return;
      const site = b.site_id ? sites.find((s) => s.id === b.site_id) : undefined;
      const openUrl = (b.custom_url && b.custom_url.length > 0 ? b.custom_url : site?.url) ?? "";
      setBookmarkEdit({
        id: b.id,
        name: b.custom_name || site?.name || openUrl || "",
        url: openUrl,
      });
      const onBookmarks = browserPagePath(activeTab?.url ?? "") === "zeroday://bookmarks";
      if (!onBookmarks) {
        navigateTo("zeroday://bookmarks", { immediate: true });
      }
      setBookmarkBarMenu(null);
    },
    [bookmarks, sites, activeTab?.url, navigateTo]
  );

  const removeHistoryEntry = useCallback(
    async (entryId: string) => {
      const isLocalId = entryId.startsWith("local-");
      if (!user || isLocalId) {
        const next = readLocalBrowserHistory().filter((e) => e.id !== entryId);
        writeLocalBrowserHistory(next);
        setBrowserHistoryEntries(next);
        addNotification("success", lang === "ru" ? "Запись удалена" : "Entry removed");
        return;
      }
      try {
        const res = await fetch(`${BROWSER_API_ORIGIN}/api/browser/history/${entryId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${localStorage.getItem("zeroday.token") ?? ""}` },
        });
        if (res.ok) {
          setBrowserHistoryEntries((prev) => prev.filter((e) => e.id !== entryId));
          addNotification("success", lang === "ru" ? "Запись удалена" : "Entry removed");
        }
      } catch {
        addNotification("error", lang === "ru" ? "Не удалось удалить" : "Could not delete");
      }
    },
    [user, lang, addNotification]
  );

  const clearBrowserHistory = useCallback(
    async (scope: "all" | "older_than", hours?: number, days?: number) => {
      const hasLocalEntries = browserHistoryEntries.some((e) => e.id.startsWith("local-"));
      if (!user || hasLocalEntries) {
        if (scope === "all") {
          writeLocalBrowserHistory([]);
        } else {
          const h = days != null && days > 0 ? days * 24 : (hours ?? 24);
          const cutoff = Date.now() - h * 3600000;
          const next = readLocalBrowserHistory().filter(
            (e) => new Date(e.visited_at).getTime() >= cutoff
          );
          writeLocalBrowserHistory(next);
        }
        setBrowserHistoryEntries(readLocalBrowserHistory());
        addNotification("success", lang === "ru" ? "История очищена" : "History cleared");
        return;
      }
      try {
        const q =
          scope === "all"
            ? "scope=all"
            : days != null && days > 0
              ? `scope=older_than&days=${days}`
              : `scope=older_than&hours=${hours ?? 24}`;
        const res = await fetch(`${BROWSER_API_ORIGIN}/api/browser/history?${q}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${localStorage.getItem("zeroday.token") ?? ""}` },
        });
        if (res.ok) {
          const listRes = await fetch(`${BROWSER_API_ORIGIN}/api/browser/history?limit=300`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("zeroday.token") ?? ""}` },
          });
          if (listRes.ok) {
            const j: unknown = await listRes.json();
            const raw = Array.isArray(j) ? j : [];
            setBrowserHistoryEntries(raw.map((row) => mapApiHistoryRow(row as Record<string, unknown>)));
          }
          addNotification("success", lang === "ru" ? "История очищена" : "History cleared");
        }
      } catch {
        addNotification("error", lang === "ru" ? "Ошибка очистки" : "Clear failed");
      }
    },
    [user, lang, addNotification]
  );

  const addBookmark = useCallback(async (url: string, name?: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const site = sites.find(s => s.url === url);
      const response = await fetch(`${BROWSER_API_ORIGIN}/api/browser/bookmarks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("zeroday.token")}`
        },
        body: JSON.stringify({
          site_id: site?.id,
          custom_url: !site ? url : undefined,
          custom_name: name || site?.name
        })
      });

      if (response.ok) {
        const row = (await response.json()) as Record<string, unknown>;
        const newBookmark = mapApiBookmark(row);
        setBookmarks((prev) => [...prev, newBookmark]);
        addNotification("success", lang === "ru" ? "Закладка добавлена" : "Bookmark added");
        return true;
      }
    } catch (err) {
      addNotification("error", lang === "ru" ? "Ошибка при сохранении закладки" : "Failed to save bookmark");
    }
    return false;
  }, [user, sites, lang, addNotification]);

  const removeBookmark = useCallback(async (bookmarkId: string) => {
    try {
      const response = await fetch(`${BROWSER_API_ORIGIN}/api/browser/bookmarks/${bookmarkId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("zeroday.token")}`
        }
      });

      if (response.ok) {
        setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
        addNotification("success", lang === "ru" ? "Закладка удалена" : "Bookmark removed");
      }
    } catch (err) {
      addNotification("error", lang === "ru" ? "Ошибка при удалении закладки" : "Failed to remove bookmark");
    }
  }, [lang, addNotification]);

  const updateBookmarkApi = useCallback(
    async (bookmarkId: string, custom_url: string, custom_name: string) => {
      if (!user) return false;
      try {
        const response = await fetch(`${BROWSER_API_ORIGIN}/api/browser/bookmarks/${bookmarkId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("zeroday.token") ?? ""}`,
          },
          body: JSON.stringify({
            custom_url: custom_url.trim(),
            custom_name: custom_name.trim(),
          }),
        });
        if (response.ok) {
          const row = (await response.json()) as Record<string, unknown>;
          const updated = mapApiBookmark(row);
          setBookmarks((prev) => prev.map((b) => (b.id === bookmarkId ? updated : b)));
          addNotification("success", lang === "ru" ? "Закладка обновлена" : "Bookmark updated");
          return true;
        }
        addNotification("error", lang === "ru" ? "Не удалось сохранить закладку" : "Could not save bookmark");
      } catch {
        addNotification("error", lang === "ru" ? "Ошибка сети" : "Network error");
      }
      return false;
    },
    [user, lang, addNotification]
  );

  const saveSettingsToServer = useCallback(async (payload: BrowserSettings) => {
    try {
      const response = await fetch(`${BROWSER_API_ORIGIN}/api/browser/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("zeroday.token")}`
        },
        body: JSON.stringify({
          homepage_url: payload.homepage_url,
          theme: payload.theme,
          show_bookmarks_bar: payload.show_bookmarks_bar,
          auto_play_media: payload.auto_play_media,
          block_popups: payload.block_popups
        })
      });

      if (response.ok) {
        const updated = await response.json();
        setSettings({
          homepage_url: updated.homepage_url ?? payload.homepage_url,
          theme: updated.theme ?? payload.theme,
          show_bookmarks_bar: updated.show_bookmarks_bar ?? payload.show_bookmarks_bar,
          auto_play_media: updated.auto_play_media ?? payload.auto_play_media,
          block_popups: updated.block_popups ?? payload.block_popups
        });
        addNotification("success", lang === "ru" ? "Настройки сохранены" : "Settings saved");
        return true;
      }
      addNotification("error", lang === "ru" ? "Не удалось сохранить настройки" : "Could not save settings");
    } catch {
      addNotification("error", lang === "ru" ? "Ошибка при сохранении настроек" : "Failed to save settings");
    }
    return false;
  }, [lang, addNotification]);

  const sortedBookmarks = useMemo(
    () => [...bookmarks].sort((a, b) => a.position - b.position),
    [bookmarks]
  );

  const bookmarkTargetUrl = useCallback(
    (b: Bookmark) => {
      const site = b.site_id ? sites.find((s) => s.id === b.site_id) : undefined;
      return (b.custom_url && b.custom_url.length > 0 ? b.custom_url : site?.url) ?? "";
    },
    [sites]
  );

  const submitNewBookmarkFromPage = useCallback(async () => {
    const url = newBookmarkUrlInput.trim();
    if (!url) {
      addNotification("warning", lang === "ru" ? "Укажите адрес ссылки" : "Enter a URL");
      return;
    }
    if (!user || !isOnline) {
      addNotification("warning", lang === "ru" ? "Нужен вход в сеть" : "Sign in and stay online");
      return;
    }
    const title = newBookmarkTitle.trim();
    const ok = await addBookmark(url, title || undefined);
    if (ok) {
      setNewBookmarkTitle("");
      setNewBookmarkUrlInput("");
    }
  }, [newBookmarkUrlInput, newBookmarkTitle, user, isOnline, lang, addNotification, addBookmark]);

  const currentPageBookmark = useMemo(() => {
    const url = activeTab?.url ?? "";
    if (!url) return undefined;
    return sortedBookmarks.find((b) => bookmarkTargetUrl(b) === url);
  }, [activeTab?.url, sortedBookmarks, bookmarkTargetUrl]);

  const toggleBookmarkCurrentPage = useCallback(() => {
    const url = activeTab?.url;
    if (!url || !user || !isOnline) return;
    if (currentPageBookmark) {
      void removeBookmark(currentPageBookmark.id);
      return;
    }
    void addBookmark(url, activeTab?.title);
  }, [
    activeTab?.url,
    activeTab?.title,
    user,
    isOnline,
    currentPageBookmark,
    addBookmark,
    removeBookmark
  ]);

  const filteredSuggestions = useMemo(() => {
    if (!isOnline || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return sites
      .filter(
        (site) =>
          site.name.toLowerCase().includes(q) || site.description?.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [searchQuery, sites, isOnline]);

  const activeSearchQueryNormalized = useMemo(() => {
    if (!activeTab?.url.startsWith("zeroday://search")) return "";
    return parseZerodaySearchQuery(activeTab.url).toLowerCase();
  }, [activeTab?.url]);

  const searchMatchIdSet = useMemo(
    () => new Set(searchRemoteResults.map((s) => s.id)),
    [searchRemoteResults]
  );

  const discoverPool = useMemo(() => {
    const rest = sites.filter((s) => !searchMatchIdSet.has(s.id));
    return shuffleDiscoverPool(rest, activeSearchQueryNormalized + String(rest.length));
  }, [sites, searchMatchIdSet, activeSearchQueryNormalized]);

  const discoverItems = useMemo(() => {
    if (discoverPool.length === 0) return [] as { site: Site; key: string }[];
    return discoverPool
      .slice(0, discoverCount)
      .map((s, i) => ({ site: s, key: `${s.id}-${i}` }));
  }, [discoverPool, discoverCount]);

  useEffect(() => {
    setDiscoverCount(24);
  }, [activeSearchQueryNormalized]);

  useEffect(() => {
    const path = activeTab?.url ?? "";
    if (!path.startsWith("zeroday://search") || !parseZerodaySearchQuery(path)) return;
    const root = contentScrollRef.current;
    const sentinel = discoverSentinelRef.current;
    if (!root || !sentinel || discoverPool.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) {
          setDiscoverCount((c) => Math.min(c + 20, 500));
        }
      },
      { root, rootMargin: "200px", threshold: 0 }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [activeTab?.url, discoverPool.length, activeSearchQueryNormalized]);

  if (minimized) return null;

  const renderPage = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-[#ff7139] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div className="text-slate-400 text-sm">
              {lang === "ru" ? "Загрузка..." : "Loading..."}
            </div>
          </div>
        </div>
      );
    }

    const tabPath = (activeTab?.url ?? "").split("?")[0]?.split("#")[0] ?? "";
    if (!isOnline && !isOfflineAllowedBrowserPage(tabPath)) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[280px] p-8 bg-slate-950">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.556 5.636a7 7 0 00-9.9 9.9m9.9-9.9l-2.828-2.828M12 3a9 9 0 019 9m-9-9a9 9 0 00-9 9m9 9a9 9 0 01-9-9m9 9c-1.657 0-3-4.03-3-9s1.343-9 3-9m0 18c1.657 0 3-4.03 3-9s-1.343-9-3-9"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2 text-center">
            {lang === "ru" ? "Нет подключения к интернету" : "No internet connection"}
          </h2>
          <p className="text-slate-400 text-sm text-center max-w-md">
            {lang === "ru"
              ? "Включите сеть в симуляторе или дождитесь восстановления соединения."
              : "Turn on the network in the simulator or wait for the connection to be restored."}
          </p>
        </div>
      );
    }

    if (activeTab?.url === "zeroday://home") {
      return (
        <div className="flex flex-col items-center justify-center h-full p-12 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          {/* Logo и заголовок */}
          <div className="flex flex-col items-center mb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">Zero Browser</h1>
            </div>
            <p className="text-slate-400 text-sm">{lang === "ru" ? "Ваше окно в сеть ZeroDay" : "Your window to ZeroDay network"}</p>
          </div>

          {/* Search box - современный минималистичный дизайн */}
          <form onSubmit={handleSearch} className="w-full max-w-2xl mb-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center bg-slate-800/80 backdrop-blur-xl rounded-xl border border-slate-700/50 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                <svg className="w-5 h-5 text-slate-500 ml-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder={lang === "ru" ? "Поиск в ZeroDay..." : "Search ZeroDay..."}
                  className="flex-1 bg-transparent px-4 py-3.5 text-white placeholder-slate-500 outline-none text-sm"
                />
                <button
                  type="submit"
                  className="m-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {lang === "ru" ? "Поиск" : "Search"}
                </button>
              </div>
            </div>
          </form>

          {!isOnline ? (
            <div className="text-center py-10 px-6 rounded-2xl bg-red-500/5 border border-red-500/20 mb-8 w-full max-w-2xl">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.556 5.636a7 7 0 00-9.9 9.9m9.9-9.9l-2.828-2.828M12 3a9 9 0 019 9m-9-9a9 9 0 00-9 9m9 9a9 9 0 01-9-9m9 9c-1.657 0-3-4.03-3-9s1.343-9 3-9m0 18c1.657 0 3-4.03 3-9s-1.343-9-3-9" />
                </svg>
              </div>
              <p className="text-slate-300 font-medium mb-1">{lang === "ru" ? "Нет подключения к сети" : "No network connection"}</p>
              <p className="text-sm text-slate-500">{lang === "ru" ? "Проверьте настройки сети" : "Check your network settings"}</p>
            </div>
          ) : null}

          {/* Connection status */}
          <div className="mt-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50">
            <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <span className={`text-xs font-medium ${isOnline ? "text-emerald-400" : "text-red-400"}`}>
              {isOnline
                ? (lang === "ru" ? `Онлайн • ${bandwidth} Mbps` : `Online • ${bandwidth} Mbps`)
                : (lang === "ru" ? "Оффлайн" : "Offline")}
            </span>
          </div>
        </div>
      );
    }

    if (activeTab?.url.startsWith("zeroday://search")) {
      const query = parseZerodaySearchQuery(activeTab.url);

      return (
        <div className="min-h-full bg-slate-950">
          <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800">
            <div className="flex items-center gap-4 px-4 lg:pl-8 py-3 justify-start">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <span className="text-lg font-semibold text-white">ZeroSearch</span>
              </div>

              <form onSubmit={handleSearch} className="flex-1 min-w-0 max-w-2xl w-full">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === "ru" ? "Поиск по сайтам ZeroDay…" : "Search ZeroDay sites…"}
                    className="w-full px-4 py-2.5 pl-11 bg-slate-800 border border-slate-700 rounded-full text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 hover:bg-blue-500 rounded-full transition-colors"
                    aria-label={lang === "ru" ? "Искать" : "Search"}
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="p-6 pl-4 lg:pl-8 max-w-3xl w-full mr-auto text-left">
            {!query ? (
              <p className="text-sm text-slate-400">
                {lang === "ru" ? "Введите запрос в поле выше." : "Enter a query in the field above."}
              </p>
            ) : searchRemoteLoading ? (
              <div className="flex flex-col items-start py-16 gap-4">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-400">
                  {lang === "ru" ? "Запрос к каталогу сайтов…" : "Querying site catalog…"}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <p className="text-sm text-slate-400">
                    {lang === "ru"
                      ? `Найдено: ${searchRemoteResults.length}`
                      : `Found: ${searchRemoteResults.length}`}
                  </p>
                </div>

                {searchRemoteResults.length === 0 ? (
                  <div className="py-6">
                    <p className="text-sm text-slate-500 mb-4">
                      {lang === "ru" ? "По запросу ничего не нашлось." : "No direct matches for this query."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {searchRemoteResults.map((site) => (
                      <SearchResultCard key={site.id} site={site} onClick={() => handleSiteClick(site.url)} />
                    ))}
                  </div>
                )}

                {discoverPool.length > 0 ? (
                  <div className="mt-10 space-y-4">
                    <p className="text-sm text-slate-500">
                      {lang === "ru" ? "Другие сайты" : "Other sites"}
                    </p>
                    <div className="space-y-5">
                      {discoverItems.map(({ site, key }) => (
                        <SearchResultCard key={key} site={site} onClick={() => handleSiteClick(site.url)} />
                      ))}
                    </div>
                    <div ref={discoverSentinelRef} className="h-1 w-full" aria-hidden />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      );
    }

    if (browserPagePath(activeTab?.url ?? "") === "zeroday://bookmarks") {
      return (
        <div className="p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-full">
          <div className="max-w-4xl mr-auto w-full">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">
                  {lang === "ru" ? "Закладки" : "Bookmarks"}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === "ru"
                    ? "Звёздочка у адреса, ПКМ на панели или форма ниже."
                    : "Star in the bar, right‑click on the bar, or use the form below."}
                </p>
              </div>
            </div>

            {user && isOnline ? (
              <div className="mb-8 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 space-y-3">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {lang === "ru" ? "Новая закладка" : "New bookmark"}
                </p>
                <input
                  type="text"
                  value={newBookmarkTitle}
                  onChange={(e) => setNewBookmarkTitle(e.target.value)}
                  placeholder={lang === "ru" ? "Название на панели" : "Title in bar"}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                />
                <input
                  type="text"
                  value={newBookmarkUrlInput}
                  onChange={(e) => setNewBookmarkUrlInput(e.target.value)}
                  placeholder={lang === "ru" ? "URL (https://… или zeroday://…)" : "URL (https://… or zeroday://…)"}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  type="button"
                  onClick={() => void submitNewBookmarkFromPage()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                >
                  {lang === "ru" ? "Добавить" : "Add"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-6">
                {lang === "ru" ? "Войдите в сеть, чтобы управлять закладками." : "Sign in and stay online to manage bookmarks."}
              </p>
            )}

            {bookmarks.length === 0 ? (
              <div className="py-12 px-4 rounded-2xl bg-slate-800/30 border border-slate-700/50 text-left">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <p className="text-slate-300 font-medium mb-1">{lang === "ru" ? "Пока нет закладок" : "No bookmarks yet"}</p>
                <p className="text-sm text-slate-500">
                  {lang === "ru" ? "Добавьте через форму выше или звёздочку в адресной строке." : "Add one with the form above or the star in the address bar."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedBookmarks.map((bookmark) => {
                  const site = sites.find((s) => s.id === bookmark.site_id);
                  const openUrl = bookmarkTargetUrl(bookmark);
                  const isEditing = bookmarkEdit?.id === bookmark.id;
                  return (
                    <div
                      key={bookmark.id}
                      className="group flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-blue-500/30 transition-all"
                    >
                      {isEditing && bookmarkEdit ? (
                        <>
                          <div className="flex-1 min-w-0 space-y-2">
                            <input
                              type="text"
                              value={bookmarkEdit.name}
                              onChange={(e) => setBookmarkEdit((d) => (d ? { ...d, name: e.target.value } : d))}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                              placeholder={lang === "ru" ? "Название" : "Title"}
                            />
                            <input
                              type="text"
                              value={bookmarkEdit.url}
                              onChange={(e) => setBookmarkEdit((d) => (d ? { ...d, url: e.target.value } : d))}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                              placeholder="URL"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                void (async () => {
                                  const ok = await updateBookmarkApi(bookmarkEdit.id, bookmarkEdit.url, bookmarkEdit.name);
                                  if (ok) setBookmarkEdit(null);
                                })();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
                            >
                              {lang === "ru" ? "Сохранить" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setBookmarkEdit(null)}
                              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs"
                            >
                              {lang === "ru" ? "Отмена" : "Cancel"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeBookmark(bookmark.id)}
                              className="px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 text-xs"
                            >
                              {lang === "ru" ? "Удалить" : "Delete"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openUrl && handleSiteClick(openUrl)}
                            className="flex items-center gap-3 flex-1 text-left min-w-0"
                          >
                            <SiteIcon
                              url={bookmark.custom_icon_url || site?.icon_url}
                              alt={bookmark.custom_name || site?.name || "Bookmark"}
                              size="md"
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-medium text-slate-200 truncate">
                                {bookmark.custom_name || site?.name}
                              </h3>
                              <p className="text-xs text-slate-500 truncate">{openUrl || "—"}</p>
                            </div>
                          </button>
                          <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                const site = sites.find((s) => s.id === bookmark.site_id);
                                const ou = bookmarkTargetUrl(bookmark);
                                setBookmarkEdit({
                                  id: bookmark.id,
                                  name: bookmark.custom_name || site?.name || ou || "",
                                  url: ou,
                                });
                              }}
                              className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-700/80"
                            >
                              {lang === "ru" ? "Изменить" : "Edit"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeBookmark(bookmark.id)}
                              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                              aria-label={lang === "ru" ? "Удалить" : "Delete"}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (browserPagePath(activeTab?.url ?? "") === "zeroday://history") {
      return (
        <div className="p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-full">
          <div className="max-w-4xl mr-auto w-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">
                  {lang === "ru" ? "История" : "History"}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === "ru" ? "Недавние страницы и очистка по периоду." : "Recent pages; clear by time range or all."}
                </p>
              </div>
            </div>

            {user && browserHistoryLoading ? (
              <p className="text-sm text-slate-400">{lang === "ru" ? "Загрузка…" : "Loading…"}</p>
            ) : (
              <>
                {!user ? (
                  <p className="text-sm text-slate-500 mb-4">
                    {lang === "ru"
                      ? "История хранится локально в браузере (без входа в аккаунт)."
                      : "History is stored locally in the browser when not signed in."}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="text-xs text-slate-500 w-full sm:w-auto sm:mr-2 py-1.5">
                    {lang === "ru" ? "Очистить:" : "Clear:"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void clearBrowserHistory("older_than", 1)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    {lang === "ru" ? "Старше часа" : "Older than 1 h"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void clearBrowserHistory("older_than", 24)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    {lang === "ru" ? "Старше суток" : "Older than 24 h"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void clearBrowserHistory("older_than", undefined, 7)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    {lang === "ru" ? "Старше 7 дней" : "Older than 7 d"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void clearBrowserHistory("all")}
                    className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-xs text-red-300 hover:bg-red-500/25"
                  >
                    {lang === "ru" ? "Всю историю" : "Everything"}
                  </button>
                </div>

                {browserHistoryEntries.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    {lang === "ru" ? "Пока пусто." : "Nothing here yet."}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {browserHistoryEntries.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-stretch gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => handleSiteClick(e.url)}
                          className="flex-1 min-w-0 text-left px-4 py-3 hover:bg-slate-700/40 transition-colors"
                        >
                          <div className="text-sm font-medium text-slate-100 truncate">
                            {e.title || e.url}
                          </div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">{e.url}</div>
                          <div className="text-xs text-slate-600 mt-1">
                            {new Date(e.visited_at).toLocaleString(lang === "ru" ? "ru-RU" : "en-US")}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeHistoryEntry(e.id)}
                          className="shrink-0 px-3 text-slate-500 hover:text-red-400 hover:bg-red-500/10 text-sm"
                          aria-label={lang === "ru" ? "Удалить" : "Remove"}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      );
    }

    if (browserPagePath(activeTab?.url ?? "") === "zeroday://settings") {
      return (
        <div className="p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-full">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-white">
                {lang === "ru" ? "Настройки браузера" : "Browser Settings"}
              </h1>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  {lang === "ru" ? "Домашняя страница" : "Homepage"}
                </label>
                <input
                  type="text"
                  value={settingsForm.homepage_url}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, homepage_url: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  placeholder="zeroday://home"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">{lang === "ru" ? "Показывать панель закладок" : "Show bookmarks bar"}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{lang === "ru" ? "Отображать закладки под адресной строкой" : "Display bookmarks bar below address bar"}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettingsForm((f) => ({ ...f, show_bookmarks_bar: !f.show_bookmarks_bar }))
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors ${settingsForm.show_bookmarks_bar ? "bg-blue-600" : "bg-slate-700"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${settingsForm.show_bookmarks_bar ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">{lang === "ru" ? "Автовоспроизведение медиа" : "Auto-play media"}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{lang === "ru" ? "Автоматически воспроизводить видео и аудио" : "Automatically play videos and audio"}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettingsForm((f) => ({ ...f, auto_play_media: !f.auto_play_media }))
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors ${settingsForm.auto_play_media ? "bg-blue-600" : "bg-slate-700"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${settingsForm.auto_play_media ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => void saveSettingsToServer(settingsForm)}
                  disabled={!user || !isOnline}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  {lang === "ru" ? "Сохранить" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab?.url === "zeroday://404") {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-800/50 border border-slate-700/50 mb-6">
              <span className="text-4xl font-bold text-slate-600">404</span>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              {lang === "ru" ? "Страница не найдена" : "Page Not Found"}
            </h2>
            <p className="text-slate-400 mb-8 max-w-md">
              {lang === "ru" ? "Запрошенная страница не существует или была перемещена" : "The requested page does not exist or has been moved"}
            </p>
            <button
              type="button"
              onClick={goHome}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {lang === "ru" ? "На главную" : "Go Home"}
            </button>
          </div>
        </div>
      );
    }

    const site = sites.find(s => s.url === activeTab?.url);
    if (site) {
      if (!isOnline && !site.url.startsWith("zeroday://")) {
        return (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="text-6xl mb-4">📡</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {lang === "ru" ? "Нет подключения к сети" : "No Network Connection"}
            </h2>
            <p className="text-slate-400 mb-4">
              {lang === "ru" ? "Для доступа к этому сайту требуется подключение к интернету" : "Internet connection required to access this site"}
            </p>
          </div>
        );
      }

      const slug = resolveSiteSlugFromUrl(site.url);
      if (slug) {
        const token = typeof window !== "undefined" ? localStorage.getItem("zeroday.token") : null;
        const iframeSrc = `${BROWSER_API_ORIGIN}/sites/${encodeURIComponent(slug)}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
        return (
          <div className="h-full">
            <iframe
              src={iframeSrc}
              className="w-full h-full border-0"
              title={site.name}
              sandbox="allow-scripts allow-same-origin allow-forms allow-local-storage allow-modals allow-popups"
            />
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center h-full">
          <SiteIcon url={site.icon_url} alt={site.name} size="xl" />
          <h2 className="text-2xl font-bold text-white mb-2 mt-4">{site.name}</h2>
          <p className="text-slate-400 mb-4">{site.url}</p>
          {site.description && (
            <p className="text-slate-500 text-center max-w-md">{site.description}</p>
          )}
          {isOnline ? (
            <p className="text-emerald-400 text-sm mt-4">{lang === "ru" ? "Страница загружена" : "Page loaded"}</p>
          ) : (
            <p className="text-red-400 text-sm mt-4">{lang === "ru" ? "Требуется подключение" : "Connection required"}</p>
          )}
        </div>
      );
    }

    // Открытие legacy-доменов напрямую через универсальный backend site router.
    if (activeTab?.url && !activeTab.url.startsWith("zeroday://")) {
      const slug = resolveSiteSlugFromUrl(activeTab.url);
      if (slug) {
        const token = typeof window !== "undefined" ? localStorage.getItem("zeroday.token") : null;
        const iframeSrc = `${BROWSER_API_ORIGIN}/sites/${encodeURIComponent(slug)}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
        return (
          <div className="h-full">
            <iframe
              src={iframeSrc}
              className="w-full h-full border-0"
              title={slug}
              sandbox="allow-scripts allow-same-origin allow-forms allow-local-storage allow-modals allow-popups"
            />
          </div>
        );
      }
    }

    // Default fallback
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-6xl mb-4">🌐</div>
        <h2 className="text-2xl font-bold text-white mb-2">{activeTab?.title}</h2>
        <p className="text-slate-400">{activeTab?.url}</p>
      </div>
    );
  };

  return (
    <div
      className={`settings-window absolute z-[75] pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900 shadow-2xl ${
        minimized ? "pointer-events-none opacity-0 scale-95" : ""
      }`}
      onMouseDown={onFocus}
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
      {/* Title bar - macOS style */}
      <div
        className="flex cursor-grab items-center justify-between border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-xl px-4 py-2"
        onPointerDown={(e) => startDrag(e, e.currentTarget)}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-3 w-3 rounded-full bg-[#ff5f57] hover:brightness-110 shadow-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => { playWindowClose(); onClose(); }}
          />
          <button
            type="button"
            className="h-3 w-3 rounded-full bg-[#febc2e] hover:brightness-110 shadow-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => { playWindowMinimize(); onMinimize(); }}
          />
          <button
            type="button"
            className="h-3 w-3 rounded-full bg-[#28c840] hover:brightness-110 shadow-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleMaximize}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-indigo-600">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <span className="text-xs font-medium text-slate-300">{title}</span>
        </div>
        <div className="w-16" />
      </div>

      {/* Resize handles */}
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

      {/* Toasts (стиль «системного» браузерного уведомления) */}
      {notifications.length > 0 ? (
        <div className="pointer-events-none absolute bottom-3 right-3 z-[60] flex w-[min(100%-1.5rem,22rem)] flex-col gap-2">
          {notifications.map((notif) => (
            <BrowserNotificationToast
              key={notif.id}
              notif={notif}
              onDismiss={() => dismissNotification(notif.id)}
              closeLabel={lang === "ru" ? "Закрыть" : "Dismiss"}
            />
          ))}
        </div>
      ) : null}

      {/* Tab bar - Chrome-like style with icons and drag-and-drop */}
      <div className="flex items-center bg-slate-800/30 border-b border-slate-700/50 px-2 py-1.5 gap-1">
        <div className="flex flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {tabs.map((tab) => {
            const faviconUrl = getTabFaviconUrl(tab, sites);
            return (
              <div
                key={tab.id}
                data-browser-tab-id={tab.id}
                onPointerDown={(e) => onTabPointerDown(e, tab.id)}
                onPointerMove={onTabPointerMove}
                onPointerUp={onTabPointerUp}
                onPointerCancel={onTabPointerCancel}
                className={`group relative flex min-w-[150px] max-w-[220px] touch-none select-none items-center gap-2 px-3 py-1.5 text-xs cursor-pointer rounded-lg transition-all ${
                  tab.id === activeTabId
                    ? "bg-slate-700/70 text-white shadow-sm"
                    : "text-slate-400 hover:bg-slate-700/40 hover:text-slate-200"
                } ${dragOverTabId === tab.id ? "ring-1 ring-cyan-400/60" : ""} ${draggedTabId === tab.id ? "opacity-60" : ""}`}
                onClick={() => {
                  if (skipNextTabClickRef.current) {
                    skipNextTabClickRef.current = false;
                    return;
                  }
                  setActiveTabId(tab.id);
                  setUrlInput(tab.url);
                }}
              >
                <div className="flex-shrink-0">
                  <SiteIcon url={faviconUrl} alt={tab.title} size="xs" />
                </div>
                <span className="truncate flex-1 font-medium">{tab.title}</span>
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 rounded hover:bg-slate-600 p-0.5 transition-all flex-shrink-0"
                  onClick={(e) => closeTab(e, tab.id)}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addNewTab}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Navigation bar - modern style */}
      <div className="flex items-center gap-2 bg-slate-800/30 px-3 py-2 border-b border-slate-700/50">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goBack}
            disabled={historyIndex <= 0}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goHome}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white transition-all"
            title={lang === "ru" ? "Домой" : "Home"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => navigateTo(activeTab?.url || "zeroday://home")}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-w-0 items-center gap-2">
          <form onSubmit={handleUrlSubmit} className="flex-1 relative min-w-0">
            <div className="flex items-center bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-700/50 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
              <input
                ref={searchInputRef}
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={lang === "ru" ? "Поиск или адрес сайта" : "Search or enter address"}
                className="flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder-slate-500 outline-none"
              />
              {!isOnline && (
                <span className="px-3 text-xs text-red-400 font-medium shrink-0">
                  {lang === "ru" ? "Нет сети" : "Offline"}
                </span>
              )}
            </div>

            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl z-50 overflow-hidden">
                {filteredSuggestions.map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700/50 transition-all"
                    onClick={() => handleSiteClick(site.url)}
                  >
                    <SiteIcon url={site.icon_url} alt={site.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium">{site.name}</div>
                      <div className="text-xs text-slate-500 truncate">{site.url}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </form>

          <div className="relative shrink-0" ref={browserMenuRef}>
            <button
              type="button"
              onClick={() => setBrowserMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/50 bg-slate-800/80 text-slate-400 hover:border-slate-600 hover:text-white transition-colors"
              title={lang === "ru" ? "Меню браузера" : "Browser menu"}
              aria-expanded={browserMenuOpen}
              aria-haspopup="menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {browserMenuOpen ? (
              <div
                className="absolute right-0 top-full z-[70] mt-1 w-52 rounded-lg border border-slate-600/80 bg-slate-800 py-1 shadow-xl"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700/80"
                  onClick={() => {
                    navigateTo("zeroday://settings", { immediate: true });
                    setBrowserMenuOpen(false);
                  }}
                >
                  {lang === "ru" ? "Настройки браузера" : "Browser settings"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700/80"
                  onClick={() => {
                    navigateTo("zeroday://bookmarks", { immediate: true });
                    setBrowserMenuOpen(false);
                  }}
                >
                  {lang === "ru" ? "Закладки" : "Bookmarks"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700/80"
                  onClick={() => {
                    navigateTo("zeroday://history", { immediate: true });
                    setBrowserMenuOpen(false);
                  }}
                >
                  {lang === "ru" ? "История" : "History"}
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={toggleBookmarkCurrentPage}
            disabled={!user || !isOnline || !activeTab?.url}
            title={
              !user
                ? lang === "ru"
                  ? "Войдите, чтобы добавлять закладки"
                  : "Sign in to add bookmarks"
                : !isOnline
                  ? lang === "ru"
                    ? "Нужен интернет"
                    : "Internet required"
                  : currentPageBookmark
                    ? lang === "ru"
                      ? "Удалить закладку"
                      : "Remove bookmark"
                    : lang === "ru"
                      ? "Добавить в закладки"
                      : "Bookmark this page"
            }
            className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
              currentPageBookmark
                ? "border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                : "border-slate-700/50 bg-slate-800/80 text-slate-400 hover:border-slate-600 hover:text-amber-300/90"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            aria-label={lang === "ru" ? "Закладка" : "Bookmark"}
          >
            <svg className="w-5 h-5" fill={currentPageBookmark ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>
        </div>
      </div>

      {settings.show_bookmarks_bar && user && sortedBookmarks.length > 0 ? (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-700/50 bg-slate-800/35 overflow-x-auto shrink-0 scrollbar-thin scrollbar-thumb-slate-600">
          {sortedBookmarks.map((bookmark) => {
            const site = bookmark.site_id ? sites.find((s) => s.id === bookmark.site_id) : undefined;
            const href = bookmarkTargetUrl(bookmark);
            const name = bookmark.custom_name || site?.name || href || "…";
            const iconUrl = bookmark.custom_icon_url || site?.icon_url;
            return (
              <button
                key={bookmark.id}
                type="button"
                onClick={() => href && handleSiteClick(href)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setBookmarkBarMenu({ x: e.clientX, y: e.clientY, id: bookmark.id });
                }}
                disabled={!href}
                className="flex items-center gap-1.5 shrink-0 max-w-[160px] px-2 py-1 rounded-md text-xs text-slate-300 hover:bg-slate-700/70 hover:text-white border border-transparent hover:border-slate-600/60 disabled:opacity-40"
              >
                <SiteIcon url={iconUrl} alt={name} size="sm" />
                <span className="truncate font-medium">{name}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Content area */}
      <div ref={contentScrollRef} className="flex-1 bg-slate-950 overflow-auto">
        {renderPage()}
      </div>

      {/* Status bar - minimal style */}
      <div className="flex items-center justify-between bg-slate-800/30 px-3 py-1.5 text-xs text-slate-500 border-t border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <span className={isOnline ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
              {isOnline ? (lang === "ru" ? "Онлайн" : "Online") : (lang === "ru" ? "Оффлайн" : "Offline")}
            </span>
          </div>
          {isOnline && (
            <span className="text-slate-400">{bandwidth} Mbps</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>ZeroDay Network</span>
        </div>
      </div>

      {bookmarkBarMenu
        ? createPortal(
            <div
              ref={bookmarkMenuRef}
              className="fixed z-[200] min-w-[200px] rounded-lg border border-slate-600/80 bg-slate-800 py-1 shadow-2xl"
              style={{ left: bookmarkBarMenu.x, top: bookmarkBarMenu.y }}
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700/80"
                onClick={() => {
                  goToBookmarksAndEdit(bookmarkBarMenu.id);
                }}
              >
                {lang === "ru" ? "Редактировать…" : "Edit…"}
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/15"
                onClick={() => {
                  void removeBookmark(bookmarkBarMenu.id);
                  setBookmarkBarMenu(null);
                }}
              >
                {lang === "ru" ? "Удалить" : "Delete"}
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
