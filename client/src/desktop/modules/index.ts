/**
 * Desktop Module System — ядро модульной архитектуры рабочего стола
 *
 * Экспортирует все публичные API модульной системы
 */

// Event Bus — система событий pub/sub
export { eventBus, DesktopEvents, createDesktopEvent } from './EventBus';
export type { DesktopEventType } from './EventBus';

// Desktop Module — интерфейсы модулей
export {
  createBaseModule,
} from './DesktopModule';
export type {
  DesktopModule,
  ModuleAPI,
  ModulePosition,
  ModuleSizeConstraints,
  ModuleState,
  ModuleEvents,
  ModuleDisplayConfig,
} from './DesktopModule';

// Module Registry — реестр модулей
export {
  moduleRegistry,
  useModuleRegistry,
  useModule,
} from './ModuleRegistry';

// Utils — общие утилиты
export {
  TaskbarThemeIcon,
  lowerBlob,
  SM_ICO,
  buildStartMenuCatalog,
} from '../utils';
export type {
  StartGroup,
  StartMenuCatalogRow,
  StartMenuHandlerApi,
} from '../utils';

// TaskbarModule — панель задач
export {
  createTaskbarModule,
  Taskbar,
  useTaskbarModule,
} from './TaskbarModule';
export type {
  TaskbarProps,
  TaskbarModuleState,
  TaskbarModuleAPI,
  TaskbarWindowEntry,
} from './TaskbarModule';

// WindowFrameModule — оконная рамка
export {
  WindowFrame,
  useWindowFrame,
  createWindowFrameModule,
  windowManager,
  WindowFrameRenderer,
} from './WindowFrameModule';
export type {
  WindowFrameProps,
  WindowRect,
  ResizeDir,
  WindowFrameModuleConfig,
  WindowEntry,
} from './WindowFrameModule';

// NotificationModule — уведомления
export {
  createNotificationModule,
  notificationManager,
  NotificationToast,
  NotificationContainer,
  useNotifications,
} from './NotificationModule';
export type {
  NotificationOptions,
  NotificationEntry,
  NotificationType,
} from './NotificationModule';
