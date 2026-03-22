о/**
 * TaskbarModule — модуль панели задач
 * 
 * Включает:
 * - Start Menu (главное меню)
 * - Панель приложений
 * - System Tray (сеть, звук, часы)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createBaseModule, type DesktopModule, type ModuleAPI } from '../DesktopModule';
import { eventBus, DesktopEvents } from '../EventBus';
import { themeIconUrl, breezePlaceUrl } from '../../../lib/themeIcons';
import {
  TaskbarThemeIcon,
  buildStartMenuCatalog,
  type StartGroup,
  type StartMenuCatalogRow,
} from '../../utils';

// ============================================================================
// Типы
// ============================================================================

export type TaskbarWindowEntry = {
  token: string;
  label: string;
  icon: React.ReactNode;
  windowType: 'terminal' | 'settings' | 'files' | 'notes' | 'scripts' | 'media' | 'browser';
  minimized: boolean;
};

// ============================================================================
// Константы
// ============================================================================

const TASKBAR_HEIGHT = 48;
const START_MENU_WIDTH = 480;
const START_MENU_HEIGHT = 560;

// ============================================================================
// Компоненты
// ============================================================================

interface StartMenuProps {
  lang: 'ru' | 'en';
  catalog: ReturnType<typeof buildStartMenuCatalog>;
  onClose: () => void;
  onLaunchApp: (key: string) => void;
}

function StartMenu({ lang, catalog, onClose, onLaunchApp }: StartMenuProps) {
  const [startSearch, setStartSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<StartGroup>("sundry");

  const handleLaunch = useCallback((key: string) => {
    onLaunchApp(key);
    onClose();
  }, [onLaunchApp, onClose]);

  const searchBlob = startSearch.trim().toLowerCase().replace(/\s+/g, '');
  const filteredRows = startSearch.trim()
    ? catalog.allSearchRows.filter((a) => a.keywords.some((k) => k.includes(searchBlob)))
    : catalog.rowsByGroup[activeGroup];

  return (
    <div className="start-menu-anchor" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 600 }}>
      <div className="start-menu shadow-xl" style={{ width: START_MENU_WIDTH, height: START_MENU_HEIGHT }}>
        {/* Search */}
        <div className="start-menu-search-wrap">
          <input
            type="text"
            className="start-menu-search"
            placeholder={lang === "ru" ? "Поиск..." : "Search..."}
            value={startSearch}
            onChange={(e) => setStartSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* Content */}
        {startSearch.trim() ? (
          <div className="start-menu-app-list">
            {filteredRows.length === 0 ? (
              <div className="start-menu-empty" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {lang === "ru" ? "Ничего не найдено" : "Nothing found"}
              </div>
            ) : (
              filteredRows.map((row) => (
                <button key={row.key} className="start-menu-app-btn" onClick={() => handleLaunch(row.key)}>
                  <span className="start-menu-app-ico">{row.icon}</span>
                  <span className="start-menu-app-lbl">{row.label}</span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="start-menu-body">
            <div className="start-menu-categories">
              {(Object.keys(catalog.groupLabel) as StartGroup[]).map((g) => (
                <button
                  key={g}
                  className={`start-menu-cat-btn ${activeGroup === g ? "active" : ""}`}
                  onClick={() => setActiveGroup(g)}
                >
                  {catalog.groupLabel[g]}
                </button>
              ))}
            </div>
            <div className="start-menu-pane">
              <div className="start-menu-pane-title">{catalog.groupLabel[activeGroup]}</div>
              <div className="start-menu-app-list" role="presentation">
                {catalog.rowsByGroup[activeGroup].map((row) => (
                  <button key={row.key} className="start-menu-app-btn" onClick={() => handleLaunch(row.key)}>
                    <span className="start-menu-app-ico">{row.icon}</span>
                    <span className="start-menu-app-lbl">{row.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface TaskbarButtonProps {
  entry: TaskbarWindowEntry;
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  badgeCount?: number;
}

function TaskbarButton({ entry, isActive, onClick, onContextMenu, badgeCount }: TaskbarButtonProps) {
  return (
    <button
      className={`taskbar-app taskbar-app-chip ${
        isActive && !entry.minimized ? "taskbar-app--active" : ""
      } ${entry.minimized ? "taskbar-app--minimized" : ""}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={entry.label}
    >
      <span className="taskbar-app-chip-icon">
        {entry.icon}
        {badgeCount !== undefined && badgeCount > 0 && (
          <span className="taskbar-badge">
            {badgeCount > 999 ? '999+' : badgeCount}
          </span>
        )}
      </span>
      <span className="taskbar-app-chip-label">{entry.label}</span>
    </button>
  );
}

interface SystemTrayProps {
  lang: 'ru' | 'en';
  isNetworkConnected: boolean;
  isNetworkConnecting: boolean;
  onNetworkClick: () => void;
  clockText: string;
  clockDateText: string;
}

function SystemTray({ lang, isNetworkConnected, isNetworkConnecting, onNetworkClick, clockText, clockDateText }: SystemTrayProps) {
  return (
    <div className="taskbar-status-icons">
      {/* Network */}
      <button
        type="button"
        className={`taskbar-app taskbar-status-btn ${
          isNetworkConnected ? "taskbar-net-btn--ok" : isNetworkConnecting ? "taskbar-net-btn--connecting" : "taskbar-net-btn--bad"
        }`}
        onClick={onNetworkClick}
        title={lang === "ru" ? "Состояние сети" : "Network Status"}
      >
        <TaskbarThemeIcon src={themeIconUrl("network.svg")} alt="" />
      </button>

      {/* Sound */}
      <button
        type="button"
        className="taskbar-app taskbar-status-btn"
        title={lang === "ru" ? "Звук" : "Sound"}
      >
        <TaskbarThemeIcon src={themeIconUrl("sound.svg")} alt="" />
      </button>

      {/* Settings */}
      <button
        type="button"
        className="taskbar-app taskbar-status-btn"
        title={lang === "ru" ? "Параметры" : "Settings"}
      >
        <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" />
      </button>

      {/* Keyboard layout */}
      <button
        type="button"
        className="taskbar-app taskbar-status-btn"
        aria-label={lang === "ru" ? "Раскладка клавиатуры" : "Keyboard layout"}
      >
        <span style={{ fontSize: '11px', fontWeight: 500 }}>EN</span>
      </button>

      {/* Clock */}
      <button
        type="button"
        className="taskbar-clock linux-clock-btn"
        title={clockDateText}
      >
        <span className="taskbar-clock-wrap">
          <span>{clockText}</span>
          <span className="taskbar-clock-date">{clockDateText}</span>
        </span>
      </button>
    </div>
  );
}

// ============================================================================
// Главный компонент Taskbar
// ============================================================================

export interface TaskbarProps {
  lang: 'ru' | 'en';
  taskbarWindows: TaskbarWindowEntry[];
  activeWindowToken: string | null;
  isNetworkConnected: boolean;
  isNetworkConnecting: boolean;
  clockText: string;
  clockDateText: string;
  onWindowClick: (entry: TaskbarWindowEntry) => void;
  onWindowContextMenu: (entry: TaskbarWindowEntry, x: number, y: number) => void;
  onNetworkClick: () => void;
  onLaunchApp: (key: string) => void;
  badgeCounts?: Record<string, number>;
}

export function Taskbar({
  lang,
  taskbarWindows,
  activeWindowToken,
  isNetworkConnected,
  isNetworkConnecting,
  clockText,
  clockDateText,
  onWindowClick,
  onWindowContextMenu,
  onNetworkClick,
  onLaunchApp,
  badgeCounts = {},
}: TaskbarProps) {
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const startRef = useRef<HTMLDivElement>(null);
  const startMenuCatalog = buildStartMenuCatalog(lang, {
    openTerminal: () => onLaunchApp("sundry-terminal"),
    openSettings: () => onLaunchApp("sundry-settings"),
    openFiles: () => onLaunchApp("sundry-files"),
    openNotes: () => onLaunchApp("sundry-notes"),
    openScripts: () => onLaunchApp("sundry-scripts"),
    openMedia: () => onLaunchApp("sundry-media"),
    openBrowser: () => onLaunchApp("internet-browser"),
  });

  // Close start menu on outside click
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      const el = startRef.current;
      if (el && !(e.target instanceof Node && el.contains(e.target))) {
        setStartMenuOpen(false);
      }
    };

    if (startMenuOpen) {
      document.addEventListener('pointerdown', handleDocClick);
      return () => document.removeEventListener('pointerdown', handleDocClick);
    }
  }, [startMenuOpen]);

  const handleStartBtn = () => {
    setStartMenuOpen((prev) => !prev);
  };

  const handleLaunchApp = useCallback((key: string) => {
    onLaunchApp(key);
  }, [onLaunchApp]);

  return (
    <div className="taskbar taskbar-shell" style={{ height: TASKBAR_HEIGHT }}>
      {/* Left: Start button */}
      <div className="taskbar-zone-left">
        <div className="relative" ref={startRef}>
          <button
            type="button"
            onClick={handleStartBtn}
            className="linux-start-button taskbar-start linux-launcher-btn"
            aria-label={lang === "ru" ? "Открыть меню" : "Open menu"}
          >
            <TaskbarThemeIcon src={themeIconUrl("start.svg")} alt="" />
          </button>

          {startMenuOpen && (
            <StartMenu
              lang={lang}
              catalog={startMenuCatalog}
              onClose={() => setStartMenuOpen(false)}
              onLaunchApp={handleLaunchApp}
            />
          )}
        </div>
      </div>

      {/* Center: App buttons */}
      <div className="taskbar-zone-center">
        <div className="taskbar-app-grid">
          {taskbarWindows.map((app) => (
            <TaskbarButton
              key={app.token}
              entry={app}
              isActive={activeWindowToken === app.token}
              onClick={() => onWindowClick(app)}
              onContextMenu={(e) => {
                e.preventDefault();
                onWindowContextMenu(app, e.clientX, e.clientY);
              }}
              badgeCount={badgeCounts[app.token]}
            />
          ))}
        </div>
      </div>

      {/* Right: System tray */}
      <div className="taskbar-zone-right">
        <SystemTray
          lang={lang}
          isNetworkConnected={isNetworkConnected}
          isNetworkConnecting={isNetworkConnecting}
          onNetworkClick={onNetworkClick}
          clockText={clockText}
          clockDateText={clockDateText}
        />
      </div>
    </div>
  );
}

// ============================================================================
// API модуля
// ============================================================================

export interface TaskbarModuleState {
  lang: 'ru' | 'en';
  taskbarWindows: TaskbarWindowEntry[];
  activeWindowToken: string | null;
  isNetworkConnected: boolean;
  isNetworkConnecting: boolean;
  clockText: string;
  clockDateText: string;
}

export interface TaskbarModuleAPI {
  setActiveWindowToken: (token: string | null) => void;
  setTaskbarWindows: (windows: TaskbarWindowEntry[]) => void;
  setNetworkStatus: (connected: boolean, connecting: boolean) => void;
  setClockText: (text: string, date: string) => void;
  focusWindow: (entry: TaskbarWindowEntry) => void;
  minimizeWindow: (entry: TaskbarWindowEntry) => void;
  closeWindow: (entry: TaskbarWindowEntry) => void;
  setLang: (lang: 'ru' | 'en') => void;
}

// ============================================================================
// Фабричная функция для создания модуля
// ============================================================================

/**
 * Создаёт модуль TaskbarModule
 * 
 * @param initialLang - начальный язык интерфейса
 * @param initialState - начальное состояние
 * @returns DesktopModule
 * 
 * @example
 * ```tsx
 * const taskbar = createTaskbarModule('ru');
 * moduleRegistry.register(taskbar);
 * 
 * // Получить API после регистрации
 * eventBus.on('taskbar:api', ({ api }) => {
 *   api.setClockText('12:00', '01.01.2024');
 * });
 * ```
 */
export function createTaskbarModule(
  initialLang: 'ru' | 'en' = 'ru',
  initialState?: Partial<TaskbarModuleState>
): DesktopModule {
  // Internal mutable state
  const state: TaskbarModuleState = {
    lang: initialLang,
    taskbarWindows: [],
    activeWindowToken: null,
    isNetworkConnected: true,
    isNetworkConnecting: false,
    clockText: '',
    clockDateText: '',
    ...initialState,
  };

  // Render function uses React state internally
  // Module provides API for external state updates
  const render = (): React.ReactNode => {
    // This is a controlled component - state comes from external React components
    // The module itself doesn't manage React state, it just provides the component
    // For the module pattern, we return null here as rendering is handled by
    // the React component passed to the module
    return null;
  };

  const module: DesktopModule = createBaseModule(
    'system:taskbar',
    'Taskbar',
    render,
    {
      category: 'system',
      position: { y: 0, zIndex: 500 },
      state: { visible: true },
      onInit: (moduleApi: ModuleAPI) => {
        // Create and expose module API via event
        const api: TaskbarModuleAPI = {
          setActiveWindowToken: (token) => {
            state.activeWindowToken = token;
            eventBus.emit('taskbar:state:update', { state });
          },
          setTaskbarWindows: (windows) => {
            state.taskbarWindows = windows;
            eventBus.emit('taskbar:state:update', { state });
          },
          setNetworkStatus: (connected, connecting) => {
            state.isNetworkConnected = connected;
            state.isNetworkConnecting = connecting;
            eventBus.emit('taskbar:state:update', { state });
          },
          setClockText: (text, date) => {
            state.clockText = text;
            state.clockDateText = date;
            eventBus.emit('taskbar:state:update', { state });
          },
          focusWindow: (entry) => {
            eventBus.emit(DesktopEvents.WINDOW_FOCUS, { windowId: entry.token });
          },
          minimizeWindow: (entry) => {
            eventBus.emit(DesktopEvents.WINDOW_MINIMIZE, { windowId: entry.token });
          },
          closeWindow: (entry) => {
            eventBus.emit(DesktopEvents.WINDOW_CLOSE, { windowId: entry.token });
          },
          setLang: (lang) => {
            state.lang = lang;
            eventBus.emit('taskbar:state:update', { state });
          },
        };

        // Expose API via event for consumers
        eventBus.emit('taskbar:api', { api, state });

        // Listen for window events to update state
        eventBus.on(DesktopEvents.WINDOW_OPEN, ({ appId, props }: { appId: string; props?: Record<string, unknown> }) => {
          // Handle window open - could add to taskbarWindows
          eventBus.emit('taskbar:state:update', { state });
        });

        eventBus.on(DesktopEvents.WINDOW_CLOSE, ({ windowId }: { windowId: string }) => {
          state.taskbarWindows = state.taskbarWindows.filter(w => w.token !== windowId);
          if (state.activeWindowToken === windowId) {
            state.activeWindowToken = null;
          }
          eventBus.emit('taskbar:state:update', { state });
        });

        eventBus.on(DesktopEvents.WINDOW_MINIMIZE, ({ windowId }: { windowId: string }) => {
          const win = state.taskbarWindows.find(w => w.token === windowId);
          if (win) {
            win.minimized = true;
            eventBus.emit('taskbar:state:update', { state });
          }
        });

        eventBus.on(DesktopEvents.WINDOW_FOCUS, ({ windowId }: { windowId: string }) => {
          state.activeWindowToken = windowId;
          // Unminimize if minimized
          const win = state.taskbarWindows.find(w => w.token === windowId);
          if (win && win.minimized) {
            win.minimized = false;
          }
          eventBus.emit('taskbar:state:update', { state });
        });
      },
      onDestroy: () => {
        // Cleanup
        eventBus.offAll('taskbar:state:update');
        eventBus.offAll('taskbar:api');
      },
    }
  );

  return module;
}

// ============================================================================
// Экспорт
// ============================================================================

export default createTaskbarModule;

// ============================================================================
// React Hook для использования TaskbarModule
// ============================================================================

interface TaskbarModuleStateSnapshot {
  lang: 'ru' | 'en';
  taskbarWindows: TaskbarWindowEntry[];
  activeWindowToken: string | null;
  isNetworkConnected: boolean;
  isNetworkConnecting: boolean;
  clockText: string;
  clockDateText: string;
}

/**
 * Хук для получения состояния и API TaskbarModule
 *
 * @example
 * ```tsx
 * const { state, api } = useTaskbarModule();
 *
 * // Использовать state для рендеринга
 * // Использовать api для управления
 * ```
 */
export function useTaskbarModule() {
  const [state, setState] = useState<TaskbarModuleStateSnapshot>({
    lang: 'ru',
    taskbarWindows: [],
    activeWindowToken: null,
    isNetworkConnected: true,
    isNetworkConnecting: false,
    clockText: '',
    clockDateText: '',
  });

  const [api, setApi] = useState<TaskbarModuleAPI | null>(null);

  useEffect(() => {
    // Подписка на API
    const handleApi = (data: unknown) => {
      const { api: taskbarApi, state: initialState } = data as { api: TaskbarModuleAPI; state: TaskbarModuleState };
      setApi(taskbarApi);
      setState(initialState);
    };

    // Подписка на обновления состояния
    const handleStateUpdate = (data: unknown) => {
      const { state: newState } = data as { state: TaskbarModuleState };
      setState(newState);
    };

    eventBus.on('taskbar:api', handleApi);
    eventBus.on('taskbar:state:update', handleStateUpdate);

    return () => {
      eventBus.off('taskbar:api', handleApi);
      eventBus.off('taskbar:state:update', handleStateUpdate);
    };
  }, []);

  return { state, api };
}
