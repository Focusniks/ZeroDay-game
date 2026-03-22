/**
 * NotificationModule — модуль системы уведомлений
 * 
 * Предоставляет:
 * - Toast-уведомления
 * - Очередь уведомлений
 * - Автоматическое скрытие
 * - Управление состоянием (read/dismiss)
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createBaseModule, type DesktopModule, type ModuleAPI } from '../DesktopModule';
import { eventBus, DesktopEvents } from '../EventBus';

// ============================================================================
// Типы
// ============================================================================

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationOptions {
  id?: string;
  title: string;
  message: string;
  type?: NotificationType;
  duration?: number; // ms, 0 = persistent
  icon?: React.ReactNode;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
  onDismiss?: () => void;
  onClick?: () => void;
}

export interface NotificationEntry extends NotificationOptions {
  id: string;
  createdAt: number;
  read: boolean;
  visible: boolean;
}

// ============================================================================
// NotificationToast Component
// ============================================================================

interface NotificationToastProps {
  notification: NotificationEntry;
  onDismiss: (id: string) => void;
  onClick?: () => void;
}

const typeStyles: Record<NotificationType, { bg: string; border: string; icon: string }> = {
  info: {
    bg: 'bg-blue-900/80',
    border: 'border-blue-500/50',
    icon: 'ℹ️',
  },
  success: {
    bg: 'bg-green-900/80',
    border: 'border-green-500/50',
    icon: '✅',
  },
  warning: {
    bg: 'bg-yellow-900/80',
    border: 'border-yellow-500/50',
    icon: '⚠️',
  },
  error: {
    bg: 'bg-red-900/80',
    border: 'border-red-500/50',
    icon: '❌',
  },
};

export function NotificationToast({ notification, onDismiss, onClick }: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const style = typeStyles[notification.type ?? 'info'];

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Auto dismiss
    if (notification.duration && notification.duration > 0) {
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, notification.duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [notification.duration]);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(notification.id);
      notification.onDismiss?.();
    }, 200);
  }, [notification.id, notification.onDismiss, onDismiss]);

  const handleClick = useCallback(() => {
    if (notification.onClick) {
      notification.onClick();
    } else if (onClick) {
      onClick();
    }
  }, [notification, onClick]);

  return (
    <div
      className={`notification-toast ${style.bg} ${style.border} border rounded-lg shadow-xl p-4 min-w-[300px] max-w-[400px] cursor-pointer transition-all duration-200 ${
        isVisible && !isExiting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      onClick={handleClick}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="text-xl flex-shrink-0">{notification.icon || style.icon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white mb-1">{notification.title}</h4>
          <p className="text-xs text-slate-300">{notification.message}</p>

          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
              {notification.actions.map((action, i) => (
                <button
                  key={i}
                  className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        <button
          className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// NotificationContainer Component
// ============================================================================

interface NotificationContainerProps {
  notifications: NotificationEntry[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function NotificationContainer({
  notifications,
  onDismiss,
  position = 'top-right',
}: NotificationContainerProps) {
  const [visibleNotifications, setVisibleNotifications] = useState<NotificationEntry[]>([]);

  useEffect(() => {
    // Filter to only show notifications that should be visible
    const visible = notifications.filter((n) => n.visible);
    setVisibleNotifications(visible);
  }, [notifications]);

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div
      className={`notification-container fixed ${positionClasses[position]} z-[700] flex flex-col gap-2 pointer-events-none`}
      style={{ zIndex: 700 }}
    >
      {visibleNotifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationToast
            notification={notification}
            onDismiss={onDismiss}
          />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// NotificationManager (singleton)
// ============================================================================

class NotificationManager {
  private notifications: Map<string, NotificationEntry> = new Map();
  private listeners: Set<() => void> = new Set();
  private idCounter = 0;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private generateId(): string {
    return `notif-${++this.idCounter}-${Date.now()}`;
  }

  show(options: NotificationOptions): string {
    const id = options.id || this.generateId();
    
    const entry: NotificationEntry = {
      id,
      title: options.title,
      message: options.message,
      type: options.type || 'info',
      duration: options.duration ?? 5000,
      icon: options.icon,
      actions: options.actions,
      onDismiss: options.onDismiss,
      onClick: options.onClick,
      createdAt: Date.now(),
      read: false,
      visible: true,
    };

    this.notifications.set(id, entry);
    this.notify();

    // Emit event
    eventBus.emit(DesktopEvents.NOTIFICATION_SHOW, { notification: entry });

    return id;
  }

  dismiss(id: string): void {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.visible = false;
      this.notify();
      
      // Remove after animation
      setTimeout(() => {
        this.notifications.delete(id);
        this.notify();
      }, 300);
    }

    eventBus.emit(DesktopEvents.NOTIFICATION_DISMISS, { notificationId: id });
  }

  dismissAll(): void {
    this.notifications.forEach((n) => {
      n.visible = false;
    });
    this.notify();

    setTimeout(() => {
      this.notifications.clear();
      this.notify();
    }, 300);

    eventBus.emit(DesktopEvents.NOTIFICATION_CLEAR, {});
  }

  markAsRead(id: string): void {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.read = true;
      this.notify();
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach((n) => {
      n.read = true;
    });
    this.notify();
  }

  getNotification(id: string): NotificationEntry | undefined {
    return this.notifications.get(id);
  }

  getAll(): NotificationEntry[] {
    return Array.from(this.notifications.values());
  }

  getVisible(): NotificationEntry[] {
    return this.getAll().filter((n) => n.visible);
  }

  getUnreadCount(): number {
    return this.getAll().filter((n) => !n.read).length;
  }

  clear(): void {
    this.notifications.clear();
    this.notify();
  }
}

export const notificationManager = new NotificationManager();

// ============================================================================
// React Hook для использования NotificationManager
// ============================================================================

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);

  useEffect(() => {
    // Initial load
    setNotifications(notificationManager.getAll());

    // Subscribe to changes
    return notificationManager.subscribe(() => {
      setNotifications(notificationManager.getAll());
    });
  }, []);

  return {
    notifications,
    show: notificationManager.show.bind(notificationManager),
    dismiss: notificationManager.dismiss.bind(notificationManager),
    dismissAll: notificationManager.dismissAll.bind(notificationManager),
    markAsRead: notificationManager.markAsRead.bind(notificationManager),
    markAllAsRead: notificationManager.markAllAsRead.bind(notificationManager),
    getUnreadCount: notificationManager.getUnreadCount.bind(notificationManager),
  };
}

// ============================================================================
// Фабричная функция для создания модуля
// ============================================================================

/**
 * Создаёт модуль NotificationModule
 * 
 * @example
 * ```tsx
 * const notificationModule = createNotificationModule();
 * moduleRegistry.register(notificationModule);
 * 
 * // Показать уведомление
 * notificationManager.show({
 *   title: 'Успешно',
 *   message: 'Файл сохранён',
 *   type: 'success',
 * });
 * ```
 */
export function createNotificationModule(): DesktopModule {
  return createBaseModule(
    'system:notifications',
    'Notifications',
    () => null, // Rendering is handled by NotificationContainer which uses the hook
    {
      category: 'system',
      position: { x: 0, y: 0, zIndex: 700 },
      state: { visible: true },
      onInit: (moduleApi: ModuleAPI) => {
        // Listen for notification events from EventBus
        eventBus.on(DesktopEvents.NOTIFICATION_SHOW, (data: { notification: NotificationEntry }) => {
          // Notification will be shown via the hook
        });

        eventBus.on(DesktopEvents.NOTIFICATION_DISMISS, (data: { notificationId: string }) => {
          notificationManager.dismiss(data.notificationId);
        });

        eventBus.on(DesktopEvents.NOTIFICATION_CLEAR, () => {
          notificationManager.dismissAll();
        });

        // Listen for app-level notification events
        eventBus.on('notification:show', (data: NotificationOptions) => {
          notificationManager.show(data);
        });

        eventBus.on('notification:dismiss', (data: { id: string }) => {
          notificationManager.dismiss(data.id);
        });

        eventBus.on('notification:dismiss-all', () => {
          notificationManager.dismissAll();
        });
      },
      onDestroy: () => {
        // Cleanup
        eventBus.offAll('notification:show');
        eventBus.offAll('notification:dismiss');
        eventBus.offAll('notification:dismiss-all');
      },
    }
  );
}

// ============================================================================
// Exports
// ============================================================================

export default createNotificationModule;
