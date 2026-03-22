/**
 * Desktop Utilities — общие утилиты для модулей рабочего стола
 */

import React from 'react';
import { themeIconUrl, breezePlaceUrl } from '../lib/themeIcons';

/**
 * Иконка темы для taskbar
 */
export function TaskbarThemeIcon({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} className={className ?? "taskbar-theme-icon"} draggable={false} />;
}

/**
 * Нормализует строку для поиска: lowercase, без диакритики
 */
export function lowerBlob(parts: Array<string | undefined | null>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * CSS классы для иконок в start menu
 */
export const SM_ICO = "taskbar-theme-icon start-menu-theme-icon";

// ============================================================================
// Типы для Start Menu
// ============================================================================

export type StartGroup = 'games' | 'graphics' | 'internet' | 'office' | 'sundry' | 'system' | 'other';

export type StartMenuCatalogRow = {
  key: string;
  icon: React.ReactNode;
  label: string;
  keywords: string[];
};

export interface StartMenuHandlerApi {
  openTerminal: () => void;
  openSettings: () => void;
  openFiles: () => void;
  openNotes: () => void;
  openScripts: () => void;
  openMedia: () => void;
  openBrowser: () => void;
}

/**
 * Нормализует строку для поиска (локальная версия для buildStartMenuCatalog)
 */
function lowerBlobSearch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

/**
 * Единый источник для каталога Start Menu (категории + глобальный поиск)
 */
export function buildStartMenuCatalog(lang: 'ru' | 'en', h: StartMenuHandlerApi): {
  groupLabel: Record<StartGroup, string>;
  rowsByGroup: Record<StartGroup, StartMenuCatalogRow[]>;
  allSearchRows: StartMenuCatalogRow[];
} {
  const groupLabel: Record<StartGroup, string> = {
    games: lang === "ru" ? "Игры" : "Games",
    graphics: lang === "ru" ? "Графика" : "Graphics",
    internet: lang === "ru" ? "Интернет" : "Internet",
    office: lang === "ru" ? "Офис" : "Office",
    sundry: lang === "ru" ? "Служебные" : "Sundry",
    system: lang === "ru" ? "Система" : "System",
    other: lang === "ru" ? "Другое" : "Other",
  };

  const mkRow = (
    key: string,
    icon: React.ReactNode,
    label: string,
    ...keywords: string[]
  ): StartMenuCatalogRow => ({
    key,
    icon,
    label,
    keywords: [lowerBlobSearch(label), ...keywords.map(lowerBlobSearch)],
  });

  const rowsByGroup: Record<StartGroup, StartMenuCatalogRow[]> = {
    games: [
      mkRow("games-hack-arena", <TaskbarThemeIcon src={themeIconUrl("scripts.svg")} alt="" className={SM_ICO} />, "HackScript Arena", "хак", "arena", "hack"),
    ],
    graphics: [
      mkRow("graphics-image", <TaskbarThemeIcon src={themeIconUrl("media.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Просмотр изображений" : "Image Viewer", "image", "photo"),
      mkRow("graphics-video", <TaskbarThemeIcon src={themeIconUrl("media.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Видео-плеер" : "Video Player", "video"),
    ],
    internet: [
      mkRow("internet-browser", <TaskbarThemeIcon src={themeIconUrl("browser.svg")} alt="" className={SM_ICO} />, "Zero Browser", "browser", "web"),
      mkRow("internet-net-settings", <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Параметры сети" : "Network Settings", "network"),
    ],
    office: [
      mkRow("office-notes", <TaskbarThemeIcon src={themeIconUrl("notes.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Заметки" : "Notes", "notes"),
      mkRow("office-fm", <TaskbarThemeIcon src={themeIconUrl("files.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Файловый менеджер" : "File Manager", "files", "fm"),
    ],
    sundry: [
      mkRow("sundry-terminal", <TaskbarThemeIcon src={themeIconUrl("terminal.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Терминал" : "Terminal", "terminal", "cmd"),
      mkRow("sundry-settings", <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Параметры" : "Settings", "settings"),
      mkRow("sundry-files", <TaskbarThemeIcon src={themeIconUrl("files.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Файлы" : "Files", "files"),
      mkRow("sundry-computer", <TaskbarThemeIcon src={breezePlaceUrl("computer")} alt="" className={SM_ICO} />, lang === "ru" ? "Компьютер" : "Computer", "computer"),
      mkRow("sundry-trash", <TaskbarThemeIcon src={breezePlaceUrl("user-trash")} alt="" className={SM_ICO} />, lang === "ru" ? "Корзина" : "Trash", "trash"),
      mkRow("sundry-notes", <TaskbarThemeIcon src={themeIconUrl("notes.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Заметки" : "Notes", "notes"),
      mkRow("sundry-scripts", <TaskbarThemeIcon src={themeIconUrl("scripts.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Скрипты" : "Scripts", "scripts"),
      mkRow("sundry-media", <TaskbarThemeIcon src={themeIconUrl("media.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Фото и видео" : "Photos & Video", "media"),
    ],
    system: [
      mkRow("sys-settings", <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Системные параметры" : "System Parameters", "system"),
      mkRow("sys-desktop", <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Рабочий стол" : "Desktop", "desktop"),
      mkRow("sys-network", <TaskbarThemeIcon src={themeIconUrl("network.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Сеть" : "Network", "network"),
      mkRow("sys-computer", <TaskbarThemeIcon src={themeIconUrl("files.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Компьютер" : "Computer", "computer"),
    ],
    other: [
      mkRow("prog-editor", <TaskbarThemeIcon src={themeIconUrl("scripts.svg")} alt="" className={SM_ICO} />, "HackScript / " + (lang === "ru" ? "редактор" : "Editor"), "editor"),
      mkRow("prog-terminal", <TaskbarThemeIcon src={themeIconUrl("terminal.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Терминал" : "Terminal", "terminal"),
      mkRow("science-lab-notes", <TaskbarThemeIcon src={themeIconUrl("notes.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Лабораторный журнал" : "Lab Journal", "lab"),
      mkRow("science-script-lab", <TaskbarThemeIcon src={themeIconUrl("scripts.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Скриптовая лаборатория" : "Script Laboratory", "script"),
      mkRow("sv-music", <TaskbarThemeIcon src={themeIconUrl("media.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Музыка" : "Music", "music"),
      mkRow("sv-video", <TaskbarThemeIcon src={themeIconUrl("media.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Видео" : "Video", "video"),
      mkRow("other-browse", <TaskbarThemeIcon src={themeIconUrl("files.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Обзор файлов" : "Browse Files", "browse"),
      mkRow("other-all-settings", <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Все параметры" : "All Settings", "all"),
      mkRow("wp-desktop", <TaskbarThemeIcon src={themeIconUrl("settings.svg")} alt="" className={SM_ICO} />, lang === "ru" ? "Параметры рабочего стола" : "Desktop Settings", "wallpaper"),
      mkRow("wp-folder", <TaskbarThemeIcon src={breezePlaceUrl("folder")} alt="" className={SM_ICO} />, lang === "ru" ? "Папка «Обои»" : "Wallpaper Folder", "wallpaper"),
    ],
  };

  const allSearchRows: StartMenuCatalogRow[] = [
    ...rowsByGroup.games,
    ...rowsByGroup.graphics,
    ...rowsByGroup.internet,
    ...rowsByGroup.office,
    ...rowsByGroup.sundry,
    ...rowsByGroup.system,
    ...rowsByGroup.other,
  ];

  return { groupLabel, rowsByGroup, allSearchRows };
}
