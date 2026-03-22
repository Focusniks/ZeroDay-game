/**
 * ModuleRegistry — реестр модулей для централизованного управления
 * 
 * Позволяет регистрировать, удалять и получать модули рабочего стола
 */

import { eventBus, DesktopEvents } from './EventBus';
import type { DesktopModule, ModuleAPI, ModuleState } from './DesktopModule';

export type { DesktopModule, ModuleAPI, ModuleState } from './DesktopModule';

/**
 * ModuleRegistry — singleton для управления модулями
 */
class ModuleRegistry {
  private modules: Map<string, DesktopModule> = new Map();
  private initialized = false;
  
  /**
   * Регистрация модуля
   */
  register(module: DesktopModule): void {
    if (this.modules.has(module.id)) {
      console.warn(`[ModuleRegistry] Module "${module.id}" already registered, skipping.`);
      return;
    }
    
    this.modules.set(module.id, module);
    
    // Вызываем onInit если определён
    if (module.onInit) {
      try {
        const api = this.createModuleAPI(module);
        module.onInit(api);
      } catch (error) {
        console.error(`[ModuleRegistry] Error initializing module "${module.id}":`, error);
      }
    }
    
    // Публикуем событие регистрации
    eventBus.emit(DesktopEvents.MODULE_REGISTER, { module });
    
    console.log(`[ModuleRegistry] Registered: ${module.name} (${module.id})`);
  }
  
  /**
   * Удаление модуля
   */
  unregister(moduleId: string): void {
    const module = this.modules.get(moduleId);
    if (module) {
      // Вызываем onDestroy если определён
      if (module.onDestroy) {
        try {
          module.onDestroy();
        } catch (error) {
          console.error(`[ModuleRegistry] Error destroying module "${moduleId}":`, error);
        }
      }
      
      this.modules.delete(moduleId);
      eventBus.emit(DesktopEvents.MODULE_UNREGISTER, { moduleId });
      
      console.log(`[ModuleRegistry] Unregistered: ${moduleId}`);
    }
  }
  
  /**
   * Получение модуля по ID
   */
  get<T extends DesktopModule = DesktopModule>(id: string): T | undefined {
    return this.modules.get(id) as T | undefined;
  }
  
  /**
   * Проверка наличия модуля
   */
  has(id: string): boolean {
    return this.modules.has(id);
  }
  
  /**
   * Получение всех модулей
   */
  getAll(): DesktopModule[] {
    return Array.from(this.modules.values());
  }
  
  /**
   * Получение только системных модулей (начинаются с 'system:')
   */
  getSystemModules(): DesktopModule[] {
    return this.getAll().filter((m) => m.id.startsWith('system:'));
  }
  
  /**
   * Получение только модулей приложений (начинаются с 'app:')
   */
  getAppModules(): DesktopModule[] {
    return this.getAll().filter((m) => m.id.startsWith('app:'));
  }
  
  /**
   * Количество модулей
   */
  get size(): number {
    return this.modules.size;
  }
  
  /**
   * Очистка всех модулей
   */
  clear(): void {
    const moduleIds = Array.from(this.modules.keys());
    moduleIds.forEach((id) => this.unregister(id));
  }
  
  /**
   * Создание API для модуля
   */
  private createModuleAPI(module: DesktopModule): ModuleAPI {
    return {
      // Event Bus операции
      emit: <T>(event: string, data: T) => eventBus.emit(event, data),
      on: <T>(event: string, handler: (data: T) => void) => eventBus.on(event, handler),
      once: <T>(event: string, handler: (data: T) => void) => eventBus.once(event, handler),
      off: (event: string) => eventBus.offAll(event),
      
      // Операции с модулями
      getModule: <T extends DesktopModule>(id: string) => this.get<T>(id),
      getAllModules: () => this.getAll(),
      
      // Операции с окнами (заглушки — переопределяются в WindowManager)
      openWindow: (appId: string, props?: Record<string, unknown>) => {
        eventBus.emit(DesktopEvents.WINDOW_OPEN, { appId, props });
      },
      closeWindow: (windowId: string) => {
        eventBus.emit(DesktopEvents.WINDOW_CLOSE, { windowId });
      },
      minimizeWindow: (windowId: string) => {
        eventBus.emit(DesktopEvents.WINDOW_MINIMIZE, { windowId });
      },
      maximizeWindow: (windowId: string) => {
        eventBus.emit(DesktopEvents.WINDOW_MAXIMIZE, { windowId });
      },
      focusWindow: (windowId: string) => {
        eventBus.emit(DesktopEvents.WINDOW_FOCUS, { windowId });
      },
      
      // Состояние модуля
      updateModuleState: (moduleId: string, state: Partial<ModuleState>) => {
        eventBus.emit(DesktopEvents.MODULE_STATE_CHANGE, { moduleId, state });
      },
      
      // Persistent storage
      getPersistentState: <T>(key: string): T | null => {
        try {
          const stored = localStorage.getItem(`desktop:module:${module.id}:${key}`);
          return stored ? JSON.parse(stored) : null;
        } catch {
          return null;
        }
      },
      setPersistentState: <T>(key: string, value: T): void => {
        try {
          localStorage.setItem(
            `desktop:module:${module.id}:${key}`,
            JSON.stringify(value)
          );
        } catch (error) {
          console.warn(`[ModuleRegistry] Failed to save state for ${module.id}:${key}`, error);
        }
      },
    };
  }
  
  /**
   * Инициализация — вызывается когда desktop готов
   */
  initialize(): void {
    if (this.initialized) {
      console.warn('[ModuleRegistry] Already initialized');
      return;
    }
    
    this.initialized = true;
    eventBus.emit(DesktopEvents.DESKTOP_READY, {});
    console.log(`[ModuleRegistry] Desktop ready with ${this.modules.size} modules`);
  }
  
  /**
   * Проверка инициализации
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Глобальный экземпляр ModuleRegistry
 */
export const moduleRegistry = new ModuleRegistry();

/**
 * React hook для доступа к ModuleRegistry
 */
export function useModuleRegistry(): ModuleRegistry {
  return moduleRegistry;
}

/**
 * React hook для доступа к конкретному модулю
 */
export function useModule<T extends DesktopModule = DesktopModule>(id: string): T | undefined {
  return moduleRegistry.get<T>(id);
}
