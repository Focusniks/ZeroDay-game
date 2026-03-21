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

// Доменные имена сайтов
const BROWSER_DOMAINS = {
  messenger: "https://zerogram.com",
  crypto: "https://cryptowallet.network",
  hosting: {
    cloudpro: "https://cloudpro.network",
    fasthost: "https://fasthost.network",
    securehost: "https://securehost.network",
    budgethost: "https://budgethost.network",
  },
  isp: {
    freenet: "https://freenet.network",
    speedmax: "https://speedmax.network",
    homenet: "https://homenet.network",
    fiberoptic: "https://fiberoptic.network",
  },
};

// Компонент для отображения иконки сайта
function SiteIcon({ url, alt, size = "md" }: { url?: string | null; alt: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-10 h-10",
  };

  // Пустая иконка - заглушка
  if (!url || url.trim() === '') {
    return (
      <div className={`${sizes[size]} rounded-md bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center`}>
        <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      </div>
    );
  }

  // Если это emoji или простой символ (короткая строка)
  if (url.length <= 4) {
    return <span className={`${sizes[size]} flex items-center justify-center text-lg`}>{url}</span>;
  }

  // Если это data URL
  if (url.startsWith('data:')) {
    return (
      <img
        src={url}
        alt={alt}
        className={`${sizes[size]} rounded-md object-cover`}
        onError={(e) => {
          (e.target as HTMLImageElement).src = '';
          (e.target as HTMLImageElement).alt = '';
        }}
      />
    );
  }

  // Если это путь к иконке (SVG/PNG/ICO)
  if (url.endsWith('.svg') || url.endsWith('.png') || url.endsWith('.ico') || url.includes('/theme-icons/')) {
    return (
      <div className={`${sizes[size]} rounded-md bg-slate-800/50 flex items-center justify-center overflow-hidden`}>
        <img
          src={url}
          alt={alt}
          className="w-full h-full object-contain p-0.5"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Заглушка по умолчанию для всего остального
  return (
    <div className={`${sizes[size]} rounded-md bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center`}>
      <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    </div>
  );
}

// Компонент карточки результата поиска (в стиле Google)
function SearchResultCard({ 
  site, 
  onClick,
  lang
}: { 
  site: Site & { relevance?: number }; 
  onClick: () => void;
  lang: GameLanguage;
}) {
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
            {site.relevance && site.relevance >= 80 && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                ТОП
              </span>
            )}
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
          
          {/* Category / Additional info */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-slate-500 capitalize">
              {site.category === 'system' ? (lang === 'ru' ? 'Системный' : 'System') : site.category}
            </span>
            {site.relevance && (
              <span className="text-xs text-slate-600">
                {lang === 'ru' ? 'Релевантность' : 'Relevance'}: {site.relevance}%
              </span>
            )}
          </div>
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

const SYSTEM_PAGES = [
  { url: "zeroday://home", title: "Home" },
  { url: "zeroday://search", title: "Search" },
  { url: "zeroday://bookmarks", title: "Bookmarks" },
  { url: "zeroday://settings", title: "Settings" },
  { url: "zeroday://404", title: "Not Found" },
  { url: "https://zerogram.com", title: "Zerogram" },
  { url: "https://cryptowallet.network", title: "Crypto Wallet" },
  { url: "https://cloudpro.network", title: "CloudPro Hosting" },
  { url: "https://fasthost.network", title: "FastHost" },
  { url: "https://securehost.network", title: "SecureHost" },
  { url: "https://budgethost.network", title: "BudgetHost" },
  { url: "https://freenet.network", title: "FreeNet ISP" },
  { url: "https://speedmax.network", title: "SpeedMax" },
  { url: "https://homenet.network", title: "HomeNet" },
  { url: "https://fiberoptic.network", title: "FiberOptic" },
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
          fetch("http://127.0.0.1:8000/api/sites"),
          fetch(`http://127.0.0.1:8000/api/browser/bookmarks`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("zeroday.token")}` }
          }),
          fetch(`http://127.0.0.1:8000/api/browser/settings`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("zeroday.token")}` }
          })
        ]);

        if (sitesRes.ok) {
          const json = await sitesRes.json();
          setSites(json.sites || []);
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
    // Проверка подключения к сети для внешних URL
    if (!isOnline && !url.startsWith("zeroday://")) {
      addNotification("error", lang === "ru" ? "Нет подключения к интернету" : "No internet connection");
      return;
    }

    // Проверка: является ли URL системной страницей или известным сайтом
    const isSystemPage = SYSTEM_PAGES.some(p => url.startsWith(p.url));
    const isKnownSite = sites.some(s => s.url === url);

    // Если это не системная страница и не известный сайт, и нет сети - блокируем
    if (!isOnline && !isSystemPage && !isKnownSite) {
      addNotification("error", lang === "ru" ? "Требуется подключение к сети" : "Network connection required");
      return;
    }

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
    
    // Проверяем, является ли ввод доменом с зоной (например: zerogram.com, cloudpro.network)
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
      const response = await fetch("http://127.0.0.1:8000/api/browser/bookmarks", {
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
      const response = await fetch(`http://127.0.0.1:8000/api/browser/bookmarks/${bookmarkId}`, {
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
      const response = await fetch("http://127.0.0.1:8000/api/browser/settings", {
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

    // Поиск по сайтам из БД с релевантностью
    const siteResults = sites
      .filter(site => {
        const name = site.name.toLowerCase();
        const desc = (site.description || "").toLowerCase();
        const category = site.category.toLowerCase();
        const url = site.url.toLowerCase();
        
        // Проверка на совпадение с запросом
        return name.includes(query) || 
               desc.includes(query) || 
               category.includes(query) ||
               url.includes(query);
      })
      .map(site => {
        // Вычисляем релевантность
        let relevance = 0;
        const name = site.name.toLowerCase();
        const desc = (site.description || "").toLowerCase();
        const category = site.category.toLowerCase();
        
        // Точное совпадение в названии - highest relevance
        if (name === query) relevance += 100;
        else if (name.startsWith(query)) relevance += 50;
        else if (name.includes(query)) relevance += 30;
        
        // Совпадение в описании
        if (desc.includes(query)) relevance += 10;
        
        // Совпадение в категории
        if (category.includes(query)) relevance += 15;
        
        // Системные сайты имеют приоритет
        if (site.category === "system") relevance += 20;
        
        return { ...site, relevance };
      })
      .sort((a, b) => b.relevance - a.relevance); // Сортировка по релевантности

    // Поиск по системным страницам
    const pageResults = SYSTEM_PAGES
      .filter(page => {
        const title = page.title.toLowerCase();
        const url = page.url.toLowerCase();
        return title.includes(query) || url.includes(query);
      })
      .map(page => ({
        id: page.url,
        name: page.title,
        url: page.url,
        description: `Открыть ${page.title}`,
        icon_url: null,
        category: "system" as const,
        relevance: 25 // Средний приоритет для системных страниц
      }));

    // Объединяем и сортируем по релевантности
    return [...siteResults, ...pageResults].sort((a, b) => b.relevance - a.relevance);
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
          <form onSubmit={handleSearch} className="w-full max-w-2xl mb-10">
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
                  Поиск
                </button>
              </div>
            </div>
          </form>

          {/* Quick links */}
          {isOnline ? (
            <div className="w-full max-w-4xl">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 text-center">
                {lang === "ru" ? "Быстрый доступ" : "Quick Access"}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
                {sites.filter(s => s.category === "system" && s.url !== "zeroday://404").map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => handleSiteClick(site.url)}
                    className="group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-800/50 transition-all"
                  >
                    <SiteIcon url={site.icon_url} alt={site.name} size="lg" />
                    <span className="text-xs text-slate-300 font-medium group-hover:text-white transition-colors">{site.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 px-6 rounded-2xl bg-red-500/5 border border-red-500/20 mb-10">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.556 5.636a7 7 0 00-9.9 9.9m9.9-9.9l-2.828-2.828M12 3a9 9 0 019 9m-9-9a9 9 0 00-9 9m9 9a9 9 0 01-9-9m9 9c-1.657 0-3-4.03-3-9s1.343-9 3-9m0 18c1.657 0 3-4.03 3-9s-1.343-9-3-9" />
                </svg>
              </div>
              <p className="text-slate-300 font-medium mb-1">{lang === "ru" ? "Нет подключения к сети" : "No network connection"}</p>
              <p className="text-sm text-slate-500">{lang === "ru" ? "Проверьте настройки сети" : "Check your network settings"}</p>
            </div>
          )}

          {/* Bookmarks */}
          {bookmarks.length > 0 && (
            <div className="w-full max-w-4xl">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                {lang === "ru" ? "Закладки" : "Bookmarks"}
              </h2>
              <div className="flex flex-wrap gap-2">
                {bookmarks.sort((a, b) => a.position - b.position).map((bookmark) => {
                  const site = sites.find(s => s.id === bookmark.site_id);
                  const iconUrl = bookmark.custom_icon_url || site?.icon_url;
                  const name = bookmark.custom_name || site?.name || 'Закладка';
                  return (
                    <button
                      key={bookmark.id}
                      type="button"
                      onClick={() => handleSiteClick(bookmark.custom_url || site?.url || "")}
                      className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-800/50 transition-all"
                    >
                      <SiteIcon url={iconUrl} alt={name} size="sm" />
                      <span className="text-xs text-slate-300 font-medium group-hover:text-white transition-colors">{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Connection status */}
          <div className="mt-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50">
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
      const urlParams = new URLSearchParams(activeTab.url.replace("zeroday://search?", ""));
      const query = urlParams.get("q") || "";
      
      return (
        <div className="min-h-full bg-slate-950">
          {/* Search Header - как в Google */}
          <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800">
            <div className="flex items-center gap-4 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <span className="text-lg font-semibold text-white">ZeroSearch</span>
              </div>
              
              {/* Search Box в шапке */}
              <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery || query}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Введите запрос..."
                    className="w-full px-4 py-2.5 pl-11 bg-slate-800 border border-slate-700 rounded-full text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 hover:bg-blue-500 rounded-full transition-colors"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </form>
              
              <div className="flex items-center gap-2">
                <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Tabs как в Google */}
            <div className="flex items-center gap-1 px-4">
              <button className="px-4 py-2 text-sm font-medium text-blue-400 border-b-2 border-blue-400">
                Все
              </button>
              <button className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-t-lg transition-all">
                Сайты
              </button>
              <button className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-t-lg transition-all">
                Закладки
              </button>
            </div>
          </div>
          
          {/* Results Content */}
          <div className="p-6 max-w-3xl mx-auto">
            {/* Stats */}
            <div className="mb-6">
              <p className="text-sm text-slate-400">
                {searchResults.length > 0 
                  ? `Результатов: ${searchResults.length} (0.${Math.floor(Math.random() * 50 + 10)} сек)`
                  : 'Ничего не найдено'}
              </p>
            </div>
            
            {searchResults.length === 0 ? (
              <div className="py-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-1">Ничего не найдено</h2>
                    <p className="text-slate-400 text-sm">Попробуйте изменить запрос</p>
                  </div>
                </div>
                
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Советы по поиску:</h3>
                  <ul className="space-y-2 text-sm text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>Проверьте правильность написания слов</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>Используйте более общие запросы</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>Попробуйте поискать по названию сайта</span>
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Sponsored / Top Results Section */}
                {searchResults.filter(r => r.relevance && r.relevance >= 80).length > 0 && (
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Лучшие результаты
                    </p>
                    {searchResults.filter(r => r.relevance && r.relevance >= 80).map((site, index) => (
                      <SearchResultCard 
                        key={`${site.id}-${index}`} 
                        site={site} 
                        onClick={() => handleSiteClick(site.url)}
                        lang={lang}
                      />
                    ))}
                  </div>
                )}
                
                {/* Other Results */}
                {searchResults.filter(r => !r.relevance || r.relevance < 80).length > 0 && (
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Результаты
                    </p>
                    {searchResults.filter(r => !r.relevance || r.relevance < 80).map((site, index) => (
                      <SearchResultCard 
                        key={`${site.id}-${index}`} 
                        site={site} 
                        onClick={() => handleSiteClick(site.url)}
                        lang={lang}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Pagination */}
            {searchResults.length > 0 && (
              <div className="flex items-center justify-center gap-2 mt-10 pt-6 border-t border-slate-800">
                <button className="px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-50" disabled>
                  Назад
                </button>
                <div className="flex items-center gap-1">
                  <button className="w-8 h-8 rounded-lg bg-blue-600 text-white text-sm font-medium">1</button>
                  <button className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-800 text-sm font-medium transition-all">2</button>
                  <button className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-800 text-sm font-medium transition-all">3</button>
                  <span className="px-2 text-slate-500">...</span>
                  <button className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-800 text-sm font-medium transition-all">10</button>
                </div>
                <button className="px-4 py-2 text-sm text-slate-400 hover:text-white">
                  Вперёд
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab?.url === "zeroday://bookmarks") {
      return (
        <div className="p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-full">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <h1 className="text-xl font-semibold text-white">
                  {lang === "ru" ? "Закладки" : "Bookmarks"}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => addBookmark(activeTab.url)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {lang === "ru" ? "Добавить" : "Add"}
              </button>
            </div>
            
            {bookmarks.length === 0 ? (
              <div className="text-center py-16 px-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <p className="text-slate-300 font-medium mb-1">{lang === "ru" ? "Нет закладок" : "No bookmarks"}</p>
                <p className="text-sm text-slate-500">{lang === "ru" ? "Добавьте первую закладку" : "Add your first bookmark"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bookmarks.sort((a, b) => a.position - b.position).map((bookmark) => {
                  const site = sites.find(s => s.id === bookmark.site_id);
                  return (
                    <div
                      key={bookmark.id}
                      className="group flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-blue-500/30 transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => handleSiteClick(bookmark.custom_url || site?.url || "")}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <SiteIcon url={bookmark.custom_icon_url || site?.icon_url} alt={bookmark.custom_name || site?.name || 'Bookmark'} size="md" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-slate-200 truncate">{bookmark.custom_name || site?.name}</h3>
                          <p className="text-xs text-slate-500 truncate">{bookmark.custom_url || site?.url}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBookmark(bookmark.id)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab?.url === "zeroday://settings") {
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
                  value={settings.homepage_url}
                  onChange={(e) => updateSettings({ homepage_url: e.target.value })}
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
                  onClick={() => updateSettings({ show_bookmarks_bar: !settings.show_bookmarks_bar })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${settings.show_bookmarks_bar ? "bg-blue-600" : "bg-slate-700"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${settings.show_bookmarks_bar ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">{lang === "ru" ? "Автовоспроизведение медиа" : "Auto-play media"}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{lang === "ru" ? "Автоматически воспроизводить видео и аудио" : "Automatically play videos and audio"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSettings({ auto_play_media: !settings.auto_play_media })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${settings.auto_play_media ? "bg-blue-600" : "bg-slate-700"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${settings.auto_play_media ? "translate-x-5" : "translate-x-0"}`} />
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

    // Hosting sites - требуют подключения к сети
    if (activeTab?.url.startsWith("https://cloudpro.network") || activeTab?.url.startsWith("https://fasthost.network") || activeTab?.url.startsWith("https://securehost.network") || activeTab?.url.startsWith("https://budgethost.network")) {
      if (!isOnline) {
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

    // ISP sites - требуют подключения к сети
    if (activeTab?.url.startsWith("https://freenet.network") || activeTab?.url.startsWith("https://speedmax.network") || activeTab?.url.startsWith("https://homenet.network") || activeTab?.url.startsWith("https://fiberoptic.network")) {
      if (!isOnline) {
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

    // Crypto wallet - требует подключения к сети
    if (activeTab?.url.startsWith("https://cryptowallet.network")) {
      if (!isOnline) {
        return (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="text-6xl mb-4">📡</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {lang === "ru" ? "Нет подключения к сети" : "No Network Connection"}
            </h2>
            <p className="text-slate-400 mb-4">
              {lang === "ru" ? "Для доступа к криптокошельку требуется подключение к интернету" : "Internet connection required to access crypto wallet"}
            </p>
          </div>
        );
      }
      return (
        <div className="h-full overflow-y-auto">
          <CryptoWalletSite />
        </div>
      );
    }

    // Messenger - требует подключения к сети
    if (activeTab?.url.startsWith("https://zerogram.com")) {
      if (!isOnline) {
        return (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="text-6xl mb-4">📡</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {lang === "ru" ? "Нет подключения к сети" : "No Network Connection"}
            </h2>
            <p className="text-slate-400 mb-4">
              {lang === "ru" ? "Для доступа к мессенджеру требуется подключение к интернету" : "Internet connection required to access messenger"}
            </p>
          </div>
        );
      }
      return (
        <div className="h-full">
          <MessengerWeb />
        </div>
      );
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
            onClick={() => { playWindowClose(); onClose(); }}
          />
          <button
            type="button"
            className="h-3 w-3 rounded-full bg-[#febc2e] hover:brightness-110 shadow-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => { playWindowMinimize(); onMinimize(); }}
          />
          <button
            type="button"
            className="h-3 w-3 rounded-full bg-[#28c840] hover:brightness-110 shadow-sm"
            onMouseDown={(e) => e.stopPropagation()}
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

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="absolute top-4 right-4 z-50 space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`px-4 py-2.5 rounded-lg text-sm shadow-lg backdrop-blur-sm ${
                notif.type === "error" ? "bg-red-600 text-white" :
                notif.type === "success" ? "bg-emerald-600 text-white" :
                notif.type === "warning" ? "bg-amber-600 text-white" :
                "bg-slate-700 text-white"
              }`}
            >
              {notif.message}
            </div>
          ))}
        </div>
      )}

      {/* Tab bar - Chrome-like style */}
      <div className="flex items-center bg-slate-800/30 border-b border-slate-700/50 px-2 py-1.5 gap-1">
        <div className="flex flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`group relative flex min-w-[150px] max-w-[220px] items-center gap-2 px-3 py-1.5 text-xs cursor-pointer rounded-lg transition-all ${
                tab.id === activeTabId
                  ? "bg-slate-700/70 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-700/40 hover:text-slate-200"
              }`}
              onClick={() => {
                setActiveTabId(tab.id);
                setUrlInput(tab.url);
              }}
            >
              <span className="truncate flex-1 font-medium">{tab.title}</span>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 rounded hover:bg-slate-600 p-0.5 transition-all"
                onClick={(e) => closeTab(e, tab.id)}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
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
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goHome}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white transition-all"
            title={lang === "ru" ? "Домой" : "Home"}
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => navigateTo(activeTab?.url || "zeroday://home")}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white transition-all"
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Search/URL bar - modern rounded style */}
        <form onSubmit={handleUrlSubmit} className="flex-1 relative">
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
              <span className="px-3 text-xs text-red-400 font-medium">
                {lang === "ru" ? "Нет сети" : "Offline"}
              </span>
            )}
          </div>

          {/* Search suggestions */}
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
      </div>

      {/* Content area */}
      <div className="flex-1 bg-slate-950 overflow-auto">
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
    </div>
  );
}
