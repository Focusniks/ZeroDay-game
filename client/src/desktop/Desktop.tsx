/**
 * Desktop — главный контейнер модульной системы рабочего стола
 * 
 * Этот файл демонстрирует использование модульной системы и служит
 * основой для постепенного упрощения DashboardPage.tsx
 * 
 * План миграции:
 * 1. Использовать модули для новых компонентов
 * 2. Постепенно выносить логику из DashboardPage в модули
 * 3. Упростить DashboardPage до простого контейнера
 */

import React, { useEffect, useState } from 'react';
import {
  moduleRegistry,
  eventBus,
  DesktopEvents,
  Taskbar,
  NotificationContainer,
  useNotifications,
  windowManager,
  useTaskbarModule,
  type TaskbarWindowEntry,
} from './modules';

// ============================================================================
// Типы
// ============================================================================

type DesktopMode = 'full' | 'minimal';

interface DesktopProps {
  mode?: DesktopMode;
  lang?: 'ru' | 'en';
  wallpaper?: string;
  children?: React.ReactNode;
}

// ============================================================================
// DesktopContent — компонент объединяющий все модули
// ============================================================================

interface DesktopContentProps {
  lang: 'ru' | 'en';
  wallpaper: string;
  children?: React.ReactNode;
}

function DesktopContent({ lang, wallpaper, children }: DesktopContentProps) {
  const { notifications, dismiss } = useNotifications();
  const { state: taskbarState, api: taskbarApi } = useTaskbarModule();

  // Clock update effect
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();

      taskbarApi?.setClockText(`${hours}:${minutes}`, `${day}.${month}.${year}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [taskbarApi]);

  // Initialize taskbar language
  useEffect(() => {
    taskbarApi?.setLang(lang);
  }, [lang, taskbarApi]);

  const handleWindowClick = (entry: TaskbarWindowEntry) => {
    if (entry.minimized) {
      eventBus.emit(DesktopEvents.WINDOW_RESTORE, { windowId: entry.token });
    } else if (taskbarState.activeWindowToken === entry.token) {
      eventBus.emit(DesktopEvents.WINDOW_MINIMIZE, { windowId: entry.token });
    } else {
      eventBus.emit(DesktopEvents.WINDOW_FOCUS, { windowId: entry.token });
    }
  };

  const handleWindowContextMenu = (entry: TaskbarWindowEntry, x: number, y: number) => {
    // Context menu logic - could use a module for this too
    console.log('Context menu for', entry.token, 'at', x, y);
  };

  const handleNetworkClick = () => {
    // Toggle network popover
    eventBus.emit('desktop:network:toggle', {});
  };

  const handleLaunchApp = (key: string) => {
    // Map app keys to window IDs
    const appMap: Record<string, { title: string; windowType: TaskbarWindowEntry['windowType'] }> = {
      'sundry-terminal': { title: 'Терминал', windowType: 'terminal' },
      'sundry-settings': { title: 'Параметры', windowType: 'settings' },
      'sundry-files': { title: 'Файлы', windowType: 'files' },
      'sundry-notes': { title: 'Заметки', windowType: 'notes' },
      'sundry-scripts': { title: 'Скрипты', windowType: 'scripts' },
      'sundry-media': { title: 'Медиа', windowType: 'media' },
      'internet-browser': { title: 'Zero Browser', windowType: 'browser' },
    };

    const app = appMap[key];
    if (app) {
      const windowId = `${app.windowType}-${Date.now()}`;
      eventBus.emit(DesktopEvents.WINDOW_OPEN, {
        windowId,
        title: app.title,
      });
    }
  };

  return (
    <div
      className="desktop-root"
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        backgroundImage: wallpaper ? `url(${wallpaper})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Desktop icons area */}
      <div className="desktop-icons-area">
        {children}
      </div>

      {/* Taskbar */}
      <Taskbar
        lang={lang}
        taskbarWindows={taskbarState.taskbarWindows}
        activeWindowToken={taskbarState.activeWindowToken}
        isNetworkConnected={taskbarState.isNetworkConnected}
        isNetworkConnecting={taskbarState.isNetworkConnecting}
        clockText={taskbarState.clockText}
        clockDateText={taskbarState.clockDateText}
        onWindowClick={handleWindowClick}
        onWindowContextMenu={handleWindowContextMenu}
        onNetworkClick={handleNetworkClick}
        onLaunchApp={handleLaunchApp}
      />

      {/* Notification container */}
      <NotificationContainer
        notifications={notifications}
        onDismiss={dismiss}
        position="top-right"
      />
    </div>
  );
}

// ============================================================================
// Desktop — главный экспорт
// ============================================================================

export function Desktop({ mode = 'full', lang = 'ru', wallpaper, children }: DesktopProps) {
  // Register modules on mount
  useEffect(() => {
    if (!moduleRegistry.isInitialized()) {
      moduleRegistry.initialize();
    }

    // Emit desktop ready event
    eventBus.emit(DesktopEvents.DESKTOP_READY, { lang });
  }, [lang]);

  // Determine wallpaper
  const desktopWallpaper = wallpaper || '/wallpapers/default.jpg';

  if (mode === 'minimal') {
    // Minimal mode for login screen etc.
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: `url(${desktopWallpaper})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <DesktopContent
      lang={lang}
      wallpaper={desktopWallpaper}
      children={children}
    />
  );
}

// ============================================================================
// Exports
// ============================================================================

export default Desktop;
