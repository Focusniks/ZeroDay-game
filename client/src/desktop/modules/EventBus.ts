/**
 * EventBus — централизованная система событий pub/sub для межмодульного взаимодействия
 * 
 * Позволяет модулям общаться друг с другом без прямой зависимости
 */

type EventHandler<T = unknown> = (data: T) => void;

interface EventSubscription {
  remove: () => void;
}

/**
 * Desktop Events — предопределённые типы событий
 */
export const DesktopEvents = {
  // Window events
  WINDOW_OPEN: 'desktop:window:open',
  WINDOW_CLOSE: 'desktop:window:close',
  WINDOW_FOCUS: 'desktop:window:focus',
  WINDOW_MINIMIZE: 'desktop:window:minimize',
  WINDOW_MAXIMIZE: 'desktop:window:maximize',
  WINDOW_RESTORE: 'desktop:window:restore',
  
  // Module events
  MODULE_REGISTER: 'desktop:module:register',
  MODULE_UNREGISTER: 'desktop:module:unregister',
  MODULE_STATE_CHANGE: 'desktop:module:state-change',
  
  // UI events
  START_MENU_OPEN: 'desktop:start-menu:open',
  START_MENU_CLOSE: 'desktop:start-menu:close',
  TASKBAR_CLICK: 'desktop:taskbar:click',
  
  // Theme events
  THEME_CHANGE: 'desktop:theme:change',
  
  // Notification events
  NOTIFICATION_SHOW: 'desktop:notification:show',
  NOTIFICATION_DISMISS: 'desktop:notification:dismiss',
  NOTIFICATION_CLEAR: 'desktop:notification:clear',
  
  // Desktop events
  DESKTOP_READY: 'desktop:ready',
  DESKTOP_REFRESH: 'desktop:refresh',
  
  // Application events
  APP_LAUNCH: 'desktop:app:launch',
  APP_CLOSE: 'desktop:app:close',
} as const;

export type DesktopEventType = typeof DesktopEvents[keyof typeof DesktopEvents];

/**
 * EventBus — singleton для управления событиями
 */
class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private subscriptions: Map<string, Set<EventSubscription>> = new Map();
  
  /**
   * Подписка на событие
   * @returns Функция для отписки
   */
  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    
    const handlers = this.handlers.get(event)!;
    handlers.add(handler as EventHandler);
    
    // Создаём subscription для возможности групповой отписки
    const subscription: EventSubscription = {
      remove: () => this.off(event, handler as EventHandler<unknown>),
    };
    
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }
    this.subscriptions.get(event)!.add(subscription);
    
    return subscription.remove;
  }
  
  /**
   * Одноразовая подписка — автоматически отписывается после первого вызова
   */
  once<T>(event: string, handler: EventHandler<T>): () => void {
    const unsubscribe = this.on<T>(event, (data) => {
      unsubscribe();
      handler(data);
    });
    return unsubscribe;
  }
  
  /**
   * Отписка от события
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  /**
   * Отписка от всех событий определённого типа
   */
  /**
   * Отписка от всех событий определённого типа
   */
  offAll(event?: string): void {
    if (event) {
      this.handlers.delete(event);
      this.subscriptions.delete(event);
    } else {
      this.handlers.clear();
      this.subscriptions.clear();
    }
  }
  
  /**
   * Публикация события — вызывает все подписанные обработчики
   */
  emit<T>(event: string, data: T): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[EventBus] Error in handler for event "${event}":`, error);
        }
      });
    }
  }
  
  /**
   * Проверка наличия подписчиков
   */
  hasListeners(event: string): boolean {
    const handlers = this.handlers.get(event);
    return handlers !== undefined && handlers.size > 0;
  }
  
  /**
   * Количество подписчиков
   */
  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }
  
  /**
   * Получить все события с подписчиками
   */
  getActiveEvents(): string[] {
    return Array.from(this.handlers.entries())
      .filter(([, handlers]) => handlers.size > 0)
      .map(([event]) => event);
  }
}

/**
 * Глобальный экземпляр EventBus
 */
export const eventBus = new EventBus();

/**
 * Хелпер для создания typed события
 */
export function createDesktopEvent<T>(eventName: DesktopEventType) {
  return {
    emit: (data: T) => eventBus.emit(eventName, data),
    on: (handler: EventHandler<T>) => eventBus.on(eventName, handler),
    once: (handler: EventHandler<T>) => eventBus.once(eventName, handler),
    off: () => eventBus.offAll(eventName),
  };
}
