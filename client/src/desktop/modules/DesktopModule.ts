/**
 * DesktopModule — базовые интерфейсы для модулей рабочего стола
 * 
 * Каждый модуль должен реализовать интерфейс DesktopModule
 */

import type { ReactNode } from 'react';

// ============================================================================
// Позиционирование и размеры
// ============================================================================

/**
 * Позиция и размер модуля на экране
 */
export type ModulePosition = {
  /** X координата (в пикселях или процентах) */
  x: number;
  /** Y координата */
  y: number;
  /** Ширина */
  width: number;
  /** Высота */
  height: number;
  /** Z-index для слоёв */
  zIndex: number;
};

/**
 * Минимальные и максимальные размеры
 */
export type ModuleSizeConstraints = {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
};

// ============================================================================
// Состояние модуля
// ============================================================================

/**
 * Состояние видимости и активности модуля
 */
export type ModuleState = {
  /** Видим ли модуль */
  visible: boolean;
  /** Активен ли (в фокусе) */
  active: boolean;
  /** Минимизирован */
  minimized: boolean;
  /** Максимизирован (растянут на весь экран) */
  maximized?: boolean;
  /** Скрыт (не отображается, но может быть активен) */
  hidden?: boolean;
};

// ============================================================================
// Обработчики событий
// ============================================================================

/**
 * Обработчики событий модуля
 */
export type ModuleEvents = {
  /** Начало перетаскивания */
  onDragStart?: (position: ModulePosition) => void;
  /** Конец перетаскивания */
  onDragEnd?: (position: ModulePosition) => void;
  /** Начало изменения размера */
  onResizeStart?: (position: ModulePosition) => void;
  /** Конец изменения размера */
  onResizeEnd?: (position: ModulePosition) => void;
  /** Получение фокуса */
  onFocus?: () => void;
  /** Потеря фокуса */
  onBlur?: () => void;
  /** Клик */
  onClick?: (event: MouseEvent) => void;
  /** Двойной клик */
  onDoubleClick?: (event: MouseEvent) => void;
  /** Нажатие клавиши */
  onKeyDown?: (event: KeyboardEvent) => void;
  /** Отпускание клавиши */
  onKeyUp?: (event: KeyboardEvent) => void;
};

// ============================================================================
// Конфигурация модуля
// ============================================================================

/**
 * Настройки отображения модуля
 */
export type ModuleDisplayConfig = {
  /** Можно ли перетаскивать */
  draggable?: boolean;
  /** Можно ли изменять размер */
  resizable?: boolean;
  /** Можно ли минимизировать */
  minimizable?: boolean;
  /** Можно ли максимизировать */
  maximizable?: boolean;
  /** Можно ли закрыть */
  closable?: boolean;
  /** Всегда поверх других окон */
  alwaysOnTop?: boolean;
  /** Анимация при появлении */
  animateOnMount?: boolean;
};

// ============================================================================
// API для модулей
// ============================================================================

/**
 * API, предоставляемое модулю при инициализации
 */
export interface ModuleAPI {
  // ---- Event Bus ----
  /** Публикация события */
  emit: <T>(event: string, data: T) => void;
  /** Подписка на событие (возвращает функцию отписки) */
  on: <T>(event: string, handler: (data: T) => void) => () => void;
  /** Одноразовая подписка */
  once: <T>(event: string, handler: (data: T) => void) => () => void;
  /** Отписка от события */
  off: (event: string) => void;
  
  // ---- Модули ----
  /** Получить модуль по ID */
  getModule: <T extends DesktopModule>(id: string) => T | undefined;
  /** Получить все модули */
  getAllModules: () => DesktopModule[];
  
  // ---- Окна ----
  /** Открыть окно приложения */
  openWindow: (appId: string, props?: Record<string, unknown>) => void;
  /** Закрыть окно */
  closeWindow: (windowId: string) => void;
  /** Минимизировать окно */
  minimizeWindow: (windowId: string) => void;
  /** Максимизировать окно */
  maximizeWindow: (windowId: string) => void;
  /** Перевести окно в фокус */
  focusWindow: (windowId: string) => void;
  
  // ---- Состояние ----
  /** Обновить состояние модуля */
  updateModuleState: (moduleId: string, state: Partial<ModuleState>) => void;
  
  // ---- Persistent Storage ----
  /** Получить сохранённое состояние */
  getPersistentState: <T>(key: string) => T | null;
  /** Сохранить состояние */
  setPersistentState: <T>(key: string, value: T) => void;
}

// ============================================================================
// Базовый интерфейс модуля
// ============================================================================

/**
 * Базовый интерфейс, который должны реализовать все модули
 */
export interface DesktopModule {
  /** Уникальный идентификатор модуля (формат: "category:name") */
  readonly id: string;
  
  /** Название модуля (для отладки и отображения) */
  readonly name: string;
  
  /** Категория модуля */
  readonly category?: 'system' | 'app' | 'widget' | 'plugin';
  
  /** Компонент рендеринга */
  render: () => ReactNode;
  
  /** Начальная позиция и размер */
  getInitialPosition: () => ModulePosition;
  
  /** Конфигурация отображения */
  getDisplayConfig?: () => ModuleDisplayConfig;
  
  /** Ограничения размеров */
  getSizeConstraints?: () => ModuleSizeConstraints;
  
  /** Состояние по умолчанию */
  getDefaultState: () => ModuleState;
  
  /** Обработчики событий */
  getEventHandlers?: () => ModuleEvents;
  
  /** Инициализация модуля (вызывается при регистрации) */
  onInit?: (api: ModuleAPI) => void;
  
  /** Очистка при размонтировании */
  onDestroy?: () => void;
}

// ============================================================================
// Фабричные функции (helper для создания модулей)
// ============================================================================

/**
 * Фабричная функция для создания базового модуля
 */
export function createBaseModule(
  id: string,
  name: string,
  render: () => ReactNode,
  options?: {
    category?: DesktopModule['category'];
    position?: Partial<ModulePosition>;
    state?: Partial<ModuleState>;
    displayConfig?: ModuleDisplayConfig;
    events?: ModuleEvents;
    sizeConstraints?: ModuleSizeConstraints;
    onInit?: (api: ModuleAPI) => void;
    onDestroy?: () => void;
  }
): DesktopModule {
  const defaultPosition: ModulePosition = {
    x: 0,
    y: 0,
    width: 100,
    height: 48,
    zIndex: 1000,
    ...options?.position,
  };
  
  const defaultState: ModuleState = {
    visible: true,
    active: false,
    minimized: false,
    ...options?.state,
  };
  
  return {
    id,
    name,
    category: options?.category ?? 'widget',
    render,
    getInitialPosition: () => defaultPosition,
    getDefaultState: () => defaultState,
    getDisplayConfig: () => options?.displayConfig ?? {},
    getSizeConstraints: () => options?.sizeConstraints ?? {},
    getEventHandlers: () => options?.events ?? {},
    onInit: options?.onInit,
    onDestroy: options?.onDestroy,
  };
}
