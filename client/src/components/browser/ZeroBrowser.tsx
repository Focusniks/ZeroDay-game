import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { GameLanguage } from "../../lib/gameConfig";
import { useWindowFrame } from "../window/useWindowFrame";
import { playWindowClose, playWindowMaximize, playWindowMinimize, playWindowRestore } from "../../lib/osSounds";
import { themeIconUrl } from "../../lib/themeIcons";
import { useAuth } from "../../hooks/useAuth";
import { MessengerWeb } from "../../pages/MessengerPage";
import { CryptoWalletSite } from "../../pages/CryptoWalletSite";
import { HostingSite, hostingSites } from "../../pages/HostingSites";
import { ISPSite, ispSites } from "../../pages/ISPSites";
import { ExternalLink } from "lucide-react";

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

type Bookmark = {
  id: string;
  site_id?: string;
  custom_url?: string;
  custom_name?: string;
  custom_icon_url?: string;
  position: number;
};

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

const SYSTEM_PAGES = [
  { url: "zeroday://home", title: "Home" },
  { url: "zeroday://search", title: "Search" },
  { url: "zeroday://bookmarks", title: "Bookmarks" },
  { url: "zeroday://settings", title: "Settings" },
  { url: "zeroday://404", title: "Not Found" },
  { url: "zeroday://messenger", title: "Messenger" },
  { url: "zeroday://crypto", title: "Crypto Wallet" },
  { url: "zeroday://hosting/cloudpro", title: "CloudPro Hosting" },
  { url: "zeroday://hosting/fasthost", title: "FastHost" },
  { url: "zeroday://hosting/securehost", title: "SecureHost" },
  { url: "zeroday://hosting/budgethost", title: "BudgetHost" },
  { url: "zeroday://isp/freenet", title: "FreeNet ISP" },
  { url: "zeroday://isp/speedmax", title: "SpeedMax" },
  { url: "zeroday://isp/homenet", title: "HomeNet" },
  { url: "zeroday://isp/fiberoptic", title: "FiberOptic" },
];

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
  const [isLoadingData, setIsLoadingData] = useState(true);

  const { rect, maximized, startDrag, startResize, toggleMaximize } = useWindowFrame({
    defaultSize: { w: 1100, h: 750 },
    minSize: { w: 600, h: 400 }
  });

  const [maximizedTick, setMaximizedTick] = useState(0);
  const [resizingTick, setResizingTick] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const onToggleMaximize = () => {
    if (maximized) playWindowRestore();
    else playWindowMaximize();
    toggleMaximize();
    setMaximizedTick((v) => v + 1);
  };

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId), [tabs, activeTabId]);

  // Load data from backend
  useEffect(() => {
    if (!isOnline || !user) {
      setIsLoadingData(false);
      return;
    }

    const loadData = async () => {
      try {
        const [sitesRes, bookmarksRes, settingsRes] = await Promise.all([
          fetch("http://85.239.35.171:8000/api/browser/sites"),
          fetch(`http://85.239.35.171:8000/api/browser/bookmarks`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("zeroday.token")}` }
          }),
          fetch(`http://85.239.35.171:8000/api/browser/settings`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("zeroday.token")}` }
          })
        ]);

        if (sitesRes.ok) {
          const sitesData = await sitesRes.json();
          setSites(sitesData);
        }

        if (bookmarksRes.ok) {
          const bookmarksData = await bookmarksRes.json();
          setBookmarks(bookmarksData);
        }

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings(settingsData);
        }
      } catch (err) {
        console.error("Failed to load browser data:", err);
      } finally {
        setIsLoadingData(false);
      }
    };

    void loadData();
  }, [isOnline, user]);

  useEffect(() => {
    if (activeTab) {
      setUrlInput(activeTab.url);
    }
  }, [activeTab]);

  const addNotification = useCallback((type: NotificationType, message: string) => {
    const id = `notif-${Date.now()}`;
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
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

  const navigateTo = useCallback((url: string) => {
    if (!isOnline && !url.startsWith("zeroday://")) {
      addNotification("error", lang === "ru" ? "Нет подключения к интернету" : "No internet connection");
      return;
    }

    // Check if URL exists
    const isSystemPage = SYSTEM_PAGES.some(p => url.startsWith(p.url));
    const isKnownSite = sites.some(s => s.url === url);
    
    if (!isSystemPage && !isKnownSite && url.startsWith("zeroday://")) {
      // Show 404
      setIsLoading(true);
      setTimeout(() => {
        setTabs(prev =>
          prev.map(t =>
            t.id === activeTabId ? { ...t, url: "zeroday://404", title: "404 Not Found" } : t
          )
        );
        setUrlInput("zeroday://404");
        setIsLoading(false);
      }, 300);
      return;
    }

    setIsLoading(true);
    const loadTime = bandwidth > 0 ? Math.max(300, 1000 - bandwidth * 5) : 500;

    setTimeout(() => {
      const site = sites.find(s => s.url === url);
      const systemPage = SYSTEM_PAGES.find(p => url.startsWith(p.url));
      
      setTabs(prev =>
        prev.map(t =>
          t.id === activeTabId 
            ? { ...t, url, title: site?.name || systemPage?.title || url } 
            : t
        )
      );
      setHistory(prev => [...prev.slice(0, historyIndex + 1), url]);
      setHistoryIndex(prev => prev + 1);
      setUrlInput(url);
      setIsLoading(false);
      onFocus?.();
    }, loadTime);
  }, [isOnline, bandwidth, sites, activeTabId, historyIndex, lang, addNotification, onFocus]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    const searchUrl = `zeroday://search?q=${encodeURIComponent(searchQuery)}`;
    navigateTo(searchUrl);
    setShowSuggestions(false);
  }, [searchQuery, navigateTo]);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    
    let url = urlInput.trim();
    if (!url.startsWith("zeroday://") && !url.startsWith("https://")) {
      url = `zeroday://${url}`;
    }
    navigateTo(url);
  }, [urlInput, navigateTo]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      navigateTo(history[newIndex]);
    }
  }, [historyIndex, history, navigateTo]);

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      navigateTo(history[newIndex]);
    }
  }, [historyIndex, history, navigateTo]);

  const goHome = useCallback(() => {
    navigateTo(settings.homepage_url || "zeroday://home");
  }, [navigateTo, settings.homepage_url]);

  const handleSiteClick = useCallback((url: string) => {
    navigateTo(url);
  }, [navigateTo]);

  const addBookmark = useCallback(async (url: string, name?: string) => {
    if (!user) return;

    try {
      const site = sites.find(s => s.url === url);
      const response = await fetch("http://85.239.35.171:8000/api/browser/bookmarks", {
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
        const newBookmark = await response.json();
        setBookmarks(prev => [...prev, newBookmark]);
        addNotification("success", lang === "ru" ? "Закладка добавлена" : "Bookmark added");
      }
    } catch (err) {
      addNotification("error", lang === "ru" ? "Ошибка при сохранении закладки" : "Failed to save bookmark");
    }
  }, [user, sites, lang, addNotification]);

  const removeBookmark = useCallback(async (bookmarkId: string) => {
    try {
      const response = await fetch(`http://85.239.35.171:8000/api/browser/bookmarks/${bookmarkId}`, {
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

  const updateSettings = useCallback(async (newSettings: Partial<BrowserSettings>) => {
    try {
      const response = await fetch("http://85.239.35.171:8000/api/browser/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("zeroday.token")}`
        },
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        const updated = await response.json();
        setSettings(updated);
        addNotification("success", lang === "ru" ? "Настройки сохранены" : "Settings saved");
      }
    } catch (err) {
      addNotification("error", lang === "ru" ? "Ошибка при сохранении настроек" : "Failed to save settings");
    }
  }, [lang, addNotification]);

  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return sites
      .filter(site => 
        site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 5);
  }, [searchQuery, sites]);

  const searchResults = useMemo(() => {
    const urlParams = new URLSearchParams(activeTab?.url.split("?")[1]);
    const query = urlParams.get("q")?.toLowerCase() || "";
    if (!query) return [];
    
    return sites.filter(site =>
      site.name.toLowerCase().includes(query) ||
      site.description?.toLowerCase().includes(query) ||
      site.category.toLowerCase().includes(query)
    );
  }, [activeTab?.url, sites]);

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

    if (activeTab?.url === "zeroday://home") {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1a1f29] border border-white/10">
              <span className="text-3xl">🦊</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Zero Browser</h1>
              <p className="text-slate-400">{lang === "ru" ? "Ваше окно в сеть ZeroDay" : "Your window to ZeroDay network"}</p>
            </div>
          </div>

          {/* Search box */}
          <form onSubmit={handleSearch} className="w-full max-w-xl mb-8">
            <div className="flex items-center bg-[#1a1f29] rounded-full border border-white/10 focus-within:border-[#ff7139]/50 transition">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={lang === "ru" ? "Искать в ZeroDay..." : "Search ZeroDay..."}
                className="flex-1 bg-transparent px-6 py-4 text-white placeholder-slate-500 outline-none"
              />
              <button
                type="submit"
                className="m-1 px-6 py-3 bg-[#ff7139] hover:bg-[#ff5a2a] text-white rounded-full font-medium transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          {/* Quick links */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {sites.filter(s => s.category === "system").map((site) => (
              <button
                key={site.id}
                type="button"
                onClick={() => handleSiteClick(site.url)}
                className="flex flex-col items-center gap-3 p-6 rounded-xl bg-[#1a1f29] border border-white/10 hover:border-[#ff7139]/50 transition"
              >
                <span className="text-4xl">{site.icon_url || "📄"}</span>
                <span className="text-sm text-slate-300">{site.name}</span>
              </button>
            ))}
            {/* Messenger */}
            <button
              type="button"
              onClick={() => navigateTo("zeroday://messenger")}
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-[#1a1f29] border border-white/10 hover:border-blue-500/50 transition"
            >
              <span className="text-4xl">💬</span>
              <span className="text-sm text-slate-300">Zerogram</span>
            </button>
            {/* Crypto Wallet */}
            <button
              type="button"
              onClick={() => navigateTo("zeroday://crypto")}
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-[#1a1f29] border border-white/10 hover:border-purple-500/50 transition"
            >
              <span className="text-4xl">₿</span>
              <span className="text-sm text-slate-300">Crypto</span>
            </button>
            {/* Hosting */}
            <button
              type="button"
              onClick={() => navigateTo("zeroday://hosting/cloudpro")}
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-[#1a1f29] border border-white/10 hover:border-cyan-500/50 transition"
            >
              <span className="text-4xl">☁️</span>
              <span className="text-sm text-slate-300">Hosting</span>
            </button>
            {/* ISP */}
            <button
              type="button"
              onClick={() => navigateTo("zeroday://isp/freenet")}
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-[#1a1f29] border border-white/10 hover:border-green-500/50 transition"
            >
              <span className="text-4xl">📡</span>
              <span className="text-sm text-slate-300">Internet</span>
            </button>
          </div>

          {/* Bookmarks */}
          {bookmarks.length > 0 && (
            <div className="w-full max-w-2xl">
              <h2 className="text-lg font-semibold text-white mb-4 text-center">
                {lang === "ru" ? "Закладки" : "Bookmarks"}
              </h2>
              <div className="flex flex-wrap justify-center gap-3">
                {bookmarks.sort((a, b) => a.position - b.position).map((bookmark) => (
                  <button
                    key={bookmark.id}
                    type="button"
                    onClick={() => handleSiteClick(bookmark.custom_url || sites.find(s => s.id === bookmark.site_id)?.url || "")}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1f29] border border-white/10 hover:border-[#ff7139]/50 transition"
                  >
                    <span>{bookmark.custom_icon_url || "🔖"}</span>
                    <span className="text-sm text-slate-300">{bookmark.custom_name || sites.find(s => s.id === bookmark.site_id)?.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Connection status */}
          <div className="mt-8 text-center">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs ${
              isOnline ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
            }`}>
              <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-red-400"}`} />
              {isOnline 
                ? (lang === "ru" ? `Подключено • ${bandwidth} Mbps` : `Connected • ${bandwidth} Mbps`)
                : (lang === "ru" ? "Нет подключения" : "Not connected")}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab?.url.startsWith("zeroday://search")) {
      return (
        <div className="p-8">
          <h1 className="text-2xl font-bold text-white mb-6">
            {lang === "ru" ? "Результаты поиска" : "Search Results"}
          </h1>
          {searchResults.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-slate-400">{lang === "ru" ? "Ничего не найдено" : "No results found"}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {searchResults.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => handleSiteClick(site.url)}
                  className="w-full text-left p-4 rounded-xl bg-[#1a1f29] border border-white/10 hover:border-[#ff7139]/50 transition"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{site.icon_url || "📄"}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-[#ff7139]">{site.name}</h3>
                      <p className="text-xs text-slate-500">{site.url}</p>
                    </div>
                  </div>
                  {site.description && (
                    <p className="text-sm text-slate-400">{site.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab?.url === "zeroday://bookmarks") {
      return (
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">
              {lang === "ru" ? "Закладки" : "Bookmarks"}
            </h1>
            <button
              type="button"
              onClick={() => addBookmark(activeTab.url)}
              className="px-4 py-2 bg-[#ff7139] hover:bg-[#ff5a2a] text-white rounded-lg text-sm font-medium transition"
            >
              {lang === "ru" ? "Добавить текущую" : "Add Current"}
            </button>
          </div>
          {bookmarks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔖</div>
              <p className="text-slate-400">{lang === "ru" ? "Нет закладок" : "No bookmarks"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bookmarks.sort((a, b) => a.position - b.position).map((bookmark) => {
                const site = sites.find(s => s.id === bookmark.site_id);
                return (
                  <div
                    key={bookmark.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-[#1a1f29] border border-white/10"
                  >
                    <button
                      type="button"
                      onClick={() => handleSiteClick(bookmark.custom_url || site?.url || "")}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <span className="text-2xl">{bookmark.custom_icon_url || site?.icon_url || "📄"}</span>
                      <div>
                        <h3 className="text-white">{bookmark.custom_name || site?.name}</h3>
                        <p className="text-xs text-slate-500">{bookmark.custom_url || site?.url}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBookmark(bookmark.id)}
                      className="p-2 text-slate-400 hover:text-red-400 transition"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (activeTab?.url === "zeroday://settings") {
      return (
        <div className="p-8">
          <h1 className="text-2xl font-bold text-white mb-6">
            {lang === "ru" ? "Настройки браузера" : "Browser Settings"}
          </h1>
          <div className="space-y-6 max-w-xl">
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                {lang === "ru" ? "Домашняя страница" : "Homepage"}
              </label>
              <input
                type="text"
                value={settings.homepage_url}
                onChange={(e) => updateSettings({ homepage_url: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#1a1f29] px-4 py-2 text-white outline-none focus:border-[#ff7139]/50"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{lang === "ru" ? "Показывать панель закладок" : "Show bookmarks bar"}</span>
              <button
                type="button"
                onClick={() => updateSettings({ show_bookmarks_bar: !settings.show_bookmarks_bar })}
                className={`w-12 h-6 rounded-full transition ${settings.show_bookmarks_bar ? "bg-[#ff7139]" : "bg-slate-600"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition ${settings.show_bookmarks_bar ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{lang === "ru" ? "Автовоспроизведение медиа" : "Auto-play media"}</span>
              <button
                type="button"
                onClick={() => updateSettings({ auto_play_media: !settings.auto_play_media })}
                className={`w-12 h-6 rounded-full transition ${settings.auto_play_media ? "bg-[#ff7139]" : "bg-slate-600"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition ${settings.auto_play_media ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab?.url === "zeroday://404") {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-8xl mb-4">404</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {lang === "ru" ? "Страница не найдена" : "Page Not Found"}
          </h2>
          <p className="text-slate-400 mb-6">
            {lang === "ru" ? "Запрошенная страница не существует" : "The requested page does not exist"}
          </p>
          <button
            type="button"
            onClick={goHome}
            className="px-6 py-3 bg-[#ff7139] hover:bg-[#ff5a2a] text-white rounded-lg font-medium transition"
          >
            {lang === "ru" ? "На главную" : "Go Home"}
          </button>
        </div>
      );
    }

    if (activeTab?.url === "zeroday://messenger") {
      return (
        <div className="h-full">
          <MessengerWeb />
        </div>
      );
    }

    if (activeTab?.url === "zeroday://crypto") {
      return (
        <div className="h-full overflow-y-auto">
          <CryptoWalletSite />
        </div>
      );
    }

    // Hosting sites
    if (activeTab?.url.startsWith("zeroday://hosting/")) {
      const hostingId = activeTab.url.split("/")[2];
      const hosting = hostingSites[hostingId as keyof typeof hostingSites];
      if (hosting) {
        return (
          <div className="h-full overflow-y-auto">
            <HostingSite {...hosting} />
          </div>
        );
      }
    }

    // ISP sites
    if (activeTab?.url.startsWith("zeroday://isp/")) {
      const ispId = activeTab.url.split("/")[2];
      const isp = ispSites[ispId as keyof typeof ispSites];
      if (isp) {
        return (
          <div className="h-full overflow-y-auto">
            <ISPSite {...isp} />
          </div>
        );
      }
    }

    // Real search - redirect to external search engine
    if (activeTab?.url.startsWith("zeroday://search")) {
      const urlParams = new URLSearchParams(activeTab.url.replace("zeroday://search?", ""));
      const query = urlParams.get("q") || "";
      
      if (query) {
        // Open external search in new tab/window simulation
        return (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">
                {lang === "ru" ? "Поиск: " : "Search: "}"{query}"
              </h2>
              <p className="text-slate-400 mb-6">
                {lang === "ru" 
                  ? "Открываем результаты поиска во внешней поисковой системе..." 
                  : "Opening search results in external search engine..."}
              </p>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff7139] hover:bg-[#ff5a2a] text-white rounded-lg font-medium transition"
              >
                <ExternalLink className="w-4 h-4" />
                {lang === "ru" ? "Открыть в Google" : "Open in Google"}
              </a>
            </div>
            <div className="text-slate-500 text-sm">
              {lang === "ru" 
                ? "Примечание: В реальной игре поиск будет работать внутри браузера" 
                : "Note: In the actual game, search will work inside the browser"}
            </div>
          </div>
        );
      }
      
      // Search page without query
      return (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <h1 className="text-4xl font-bold text-white mb-8">
            <span className="text-[#ff7139]">Zero</span>Search
          </h1>
          <form onSubmit={handleSearch} className="w-full max-w-2xl">
            <div className="flex items-center bg-[#1a1f29] rounded-full border border-white/10 focus-within:border-[#ff7139]/50 transition">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === "ru" ? "Введите запрос..." : "Enter search query..."}
                className="flex-1 bg-transparent px-6 py-4 text-white placeholder-slate-500 outline-none"
              />
              <button
                type="submit"
                className="m-1 px-6 py-3 bg-[#ff7139] hover:bg-[#ff5a2a] text-white rounded-full font-medium transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      );
    }

    // Known site page
    const site = sites.find(s => s.url === activeTab?.url);
    if (site) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-6xl mb-4">{site.icon_url || "🌐"}</div>
          <h2 className="text-2xl font-bold text-white mb-2">{site.name}</h2>
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
      className={`settings-window absolute z-[75] pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl ${
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
      {/* Title bar */}
      <div
        className="flex cursor-grab items-center justify-between border-b border-white/10 bg-[#1a1f29] px-4 py-2.5"
        onPointerDown={(e) => startDrag(e, e.currentTarget)}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-3 w-3 rounded-full bg-[#ff5f57] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => { playWindowClose(); onClose(); }}
          />
          <button
            type="button"
            className="h-3 w-3 rounded-full bg-[#febc2e] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => { playWindowMinimize(); onMinimize(); }}
          />
          <button
            type="button"
            className="h-3 w-3 rounded-full bg-[#28c840] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onToggleMaximize}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1f29] border border-white/10">
            <span className="text-[10px]">🦊</span>
          </div>
          <span className="text-xs text-slate-300">{title}</span>
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

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="absolute top-4 right-4 z-50 space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`px-4 py-3 rounded-lg text-sm shadow-lg backdrop-blur-sm ${
                notif.type === "error" ? "bg-red-500/90 text-white" :
                notif.type === "success" ? "bg-emerald-500/90 text-white" :
                notif.type === "warning" ? "bg-amber-500/90 text-white" :
                "bg-slate-700/90 text-white"
              }`}
            >
              {notif.message}
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center bg-[#1a1f29] border-b border-white/10">
        <div className="flex flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`group flex min-w-[140px] max-w-[200px] items-center gap-2 border-r border-white/10 px-3 py-2 text-xs cursor-pointer ${
                tab.id === activeTabId
                  ? "bg-[#0d1117] text-white"
                  : "bg-[#1a1f29] text-slate-400 hover:bg-[#2a2f39]"
              }`}
              onClick={() => {
                setActiveTabId(tab.id);
                setUrlInput(tab.url);
              }}
            >
              <span className="truncate flex-1">{tab.title}</span>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 rounded hover:bg-white/20 p-0.5 transition"
                onClick={(e) => closeTab(e, tab.id)}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addNewTab}
          className="flex h-8 w-8 items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center gap-2 bg-[#1a1f29] px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goBack}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goHome}
            className="p-1.5 rounded text-slate-400 hover:bg-white/10 hover:text-white transition"
            title={lang === "ru" ? "Домой" : "Home"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => navigateTo(activeTab?.url || "zeroday://home")}
            className="p-1.5 rounded text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Search/URL bar */}
        <form onSubmit={handleUrlSubmit} className="flex-1 relative">
          <div className="flex items-center bg-[#0d1117] rounded-full border border-white/10 focus-within:border-[#ff7139]/50 transition">
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
              <span className="px-3 text-xs text-red-400">
                {lang === "ru" ? "Нет сети" : "Offline"}
              </span>
            )}
          </div>

          {/* Search suggestions */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1f29] rounded-lg border border-white/10 shadow-xl z-50">
              {filteredSuggestions.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/10 transition"
                  onClick={() => handleSiteClick(site.url)}
                >
                  <span className="text-lg">{site.icon_url || "📄"}</span>
                  <div>
                    <div className="text-white">{site.name}</div>
                    <div className="text-xs text-slate-500">{site.url}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Content area */}
      <div className="flex-1 bg-[#0d1117] overflow-auto">
        {renderPage()}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between bg-[#1a1f29] px-3 py-1 text-[10px] text-slate-500 border-t border-white/10">
        <div className="flex items-center gap-4">
          <span>{isOnline ? (lang === "ru" ? "В сети" : "Online") : (lang === "ru" ? "Оффлайн" : "Offline")}</span>
          {isOnline && <span>{bandwidth} Mbps</span>}
        </div>
        <div className="flex items-center gap-2">
          <span>ZeroDay Network</span>
          <span>•</span>
          <span>Secure</span>
        </div>
      </div>
    </div>
  );
}
