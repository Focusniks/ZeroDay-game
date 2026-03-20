import type { GameLanguage } from "../../lib/gameConfig";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { breezePlaceUrl } from "../../lib/themeIcons";

export type NautilusSidebarItem = { rel: string; label: string };
/** Reserved for future cloud / subscription volumes from backend. */
export type NautilusDeviceItem = { rel: string; label: string; canHighlight: boolean };

type Props = {
  lang: GameLanguage;
  COMPUTER_VIEW: string;
  DISK0_VIEW: string;
  RECENT_VIEW: string;
  currentRel: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  navPastLen: number;
  navFutureLen: number;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
  navigateTo: (rel: string) => void;
  viewMode: "grid" | "list";
  setViewMode: (m: "grid" | "list") => void;
  iconZoom: number;
  setIconZoom: (z: number) => void;
  menuOpen: string | null;
  setMenuOpen: (m: string | null) => void;
  sidebarComputerItems: NautilusSidebarItem[];
  /** When empty, the Devices block is hidden (future: mount points from backend). */
  sidebarDeviceItems?: NautilusDeviceItem[];
  isNautilusSidebarActive: (rel: string) => boolean;
  newFolderTargetRel: () => string | null;
  onNewFolder: () => void;
  onUploadClick: () => void;
  onRefresh: () => void;
  onCloseWindow: () => void;
  /** Виртуальный путь внутри игры (без реального пути на диске хоста). */
  virtualLocationPath: string;
  nautilusStatusText: string;
  fileInput: ReactNode;
  children: ReactNode;
};

function tLang(lang: GameLanguage, ru: string, en: string) {
  return lang === "ru" ? ru : en;
}

function sidebarComputerIconUrl(item: NautilusSidebarItem, p: Props): string {
  const isHome =
    item.rel === p.DISK0_VIEW && (item.label === "Home" || item.label === "Домашняя папка");
  if (item.rel === p.RECENT_VIEW) return breezePlaceUrl("document-recent");
  if (item.rel === p.COMPUTER_VIEW) return breezePlaceUrl("computer");
  if (item.rel === "Trash") return breezePlaceUrl("user-trash");
  if (isHome) return breezePlaceUrl("user-home");
  return breezePlaceUrl("folder");
}

export function NautilusExplorerLayout(p: Props) {
  const L = (ru: string, en: string) => tLang(p.lang, ru, en);
  const headerRef = useRef<HTMLDivElement>(null);
  const sidebarDeviceItems = p.sidebarDeviceItems ?? [];

  useEffect(() => {
    if (!p.menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (headerRef.current?.contains(t)) return;
      p.setMenuOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [p.menuOpen, p.setMenuOpen]);

  const breadcrumbSegments = (): { label: string; rel: string }[] => {
    if (p.currentRel === p.COMPUTER_VIEW) return [];
    if (p.currentRel === p.DISK0_VIEW) return [];
    if (p.currentRel === p.RECENT_VIEW) {
      return [{ label: L("Недавние", "Recent"), rel: p.RECENT_VIEW }];
    }
    const parts = p.currentRel.split("/").filter(Boolean);
    return parts.map((name, i) => ({
      label: name,
      rel: parts.slice(0, i + 1).join("/")
    }));
  };

  const crumbs = breadcrumbSegments();

  return (
    <div
      className="nautilus-fs-shell flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[#2e2e2e] text-[13px] text-[#ececec] antialiased"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div ref={headerRef}>
      {/* Menu bar */}
      <div
        className="nautilus-menubar flex shrink-0 items-center gap-0 border-b border-black/50 bg-[#242424] px-1 py-0.5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {(
          [
            { id: "file", ru: "Файл", en: "File" },
            { id: "view", ru: "Вид", en: "View" },
            { id: "go", ru: "Переход", en: "Go" },
            { id: "help", ru: "Справка", en: "Help" }
          ] as const
        ).map((m) => (
          <div key={m.id} className="relative">
            <button
              type="button"
              className={`nautilus-menubar-btn rounded px-2.5 py-1 text-[13px] ${
                p.menuOpen === m.id ? "bg-white/10" : "hover:bg-white/8"
              }`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => p.setMenuOpen(p.menuOpen === m.id ? null : m.id)}
            >
              {L(m.ru, m.en)}
            </button>
            {p.menuOpen === m.id ? (
              <div
                className="nautilus-menu-dropdown absolute left-0 top-full z-[200] min-w-[200px] rounded border border-black/40 bg-[#353535] py-1 shadow-lg"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {m.id === "file" ? (
                  <>
                    <button
                      type="button"
                      className="nautilus-menu-item"
                      onClick={() => {
                        p.setMenuOpen(null);
                        if (p.newFolderTargetRel() === null) return;
                        p.onNewFolder();
                      }}
                    >
                      {L("Создать папку", "New Folder")}
                    </button>
                    <button
                      type="button"
                      className="nautilus-menu-item"
                      onClick={() => {
                        p.setMenuOpen(null);
                        p.onUploadClick();
                      }}
                    >
                      {L("Загрузить файлы…", "Upload Files…")}
                    </button>
                    <button
                      type="button"
                      className="nautilus-menu-item"
                      onClick={() => {
                        p.setMenuOpen(null);
                        void p.onRefresh();
                      }}
                    >
                      {L("Обновить", "Refresh")}
                    </button>
                    <div className="my-1 border-t border-white/10" />
                    <button
                      type="button"
                      className="nautilus-menu-item"
                      onClick={() => {
                        p.setMenuOpen(null);
                        p.onCloseWindow();
                      }}
                    >
                      {L("Закрыть", "Close")}
                    </button>
                  </>
                ) : m.id === "view" ? (
                  <>
                    <button
                      type="button"
                      className="nautilus-menu-item"
                      onClick={() => {
                        p.setViewMode("grid");
                        p.setMenuOpen(null);
                      }}
                    >
                      {L("Значки", "Icon View")}
                    </button>
                    <button
                      type="button"
                      className="nautilus-menu-item"
                      onClick={() => {
                        p.setViewMode("list");
                        p.setMenuOpen(null);
                      }}
                    >
                      {L("Список", "List View")}
                    </button>
                  </>
                ) : m.id === "go" ? (
                  <>
                    <button
                      type="button"
                      className="nautilus-menu-item"
                      disabled={p.navPastLen === 0}
                      onClick={() => {
                        p.goBack();
                        p.setMenuOpen(null);
                      }}
                    >
                      {L("Назад", "Back")}
                    </button>
                    <button
                      type="button"
                      className="nautilus-menu-item"
                      disabled={p.navFutureLen === 0}
                      onClick={() => {
                        p.goForward();
                        p.setMenuOpen(null);
                      }}
                    >
                      {L("Вперёд", "Forward")}
                    </button>
                    <button
                      type="button"
                      className="nautilus-menu-item"
                      onClick={() => {
                        p.goUp();
                        p.setMenuOpen(null);
                      }}
                    >
                      {L("Вверх", "Up")}
                    </button>
                    <div className="my-1 border-t border-white/10" />
                    <button
                      type="button"
                      className="nautilus-menu-item"
                      onClick={() => {
                        p.navigateTo(p.DISK0_VIEW);
                        p.setMenuOpen(null);
                      }}
                    >
                      {L("Домашняя папка", "Home")}
                    </button>
                    <button
                      type="button"
                      className="nautilus-menu-item"
                      onClick={() => {
                        p.navigateTo(p.COMPUTER_VIEW);
                        p.setMenuOpen(null);
                      }}
                    >
                      {L("Компьютер", "Computer")}
                    </button>
                  </>
                ) : m.id === "help" ? (
                  <div className="px-3 py-2 text-xs text-white/50">
                    {L("ZeroDay Files — игровой проводник", "ZeroDay Files — in-game file manager")}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="nautilus-toolbar relative flex shrink-0 items-center gap-1 border-b border-black/35 bg-[#2e2e2e] px-1.5 py-1">
        <button
          type="button"
          className="nautilus-tool-btn"
          disabled={p.navPastLen === 0}
          title={L("Назад", "Back")}
          onClick={() => p.goBack()}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M10 3 5 8l5 5 1.5-1.5L8 8l3.5-3.5z" />
          </svg>
        </button>
        <button
          type="button"
          className="nautilus-tool-btn"
          disabled={p.navFutureLen === 0}
          title={L("Вперёд", "Forward")}
          onClick={() => p.goForward()}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M6 3 11 8l-5 5-1.5-1.5L8 8 4.5 4.5z" />
          </svg>
        </button>
        <button
          type="button"
          className="nautilus-tool-btn"
          title={L("Вверх", "Up")}
          onClick={() => p.goUp()}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 3 3 8h3v5h4V8h3z" />
          </svg>
        </button>

        <div className="nautilus-pathbar mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded border border-black/40 bg-[#1e1e1e] px-1 py-0.5">
          <button
            type="button"
            className="nautilus-path-crumb flex shrink-0 items-center rounded px-1 py-0.5 hover:bg-white/10"
            title={L("Домашняя папка", "Home")}
            onClick={() => p.navigateTo(p.DISK0_VIEW)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="opacity-90" aria-hidden>
              <path d="M8 2 2 7v7h4v-4h4v4h4V7z" />
            </svg>
          </button>
          {p.currentRel === p.COMPUTER_VIEW ? (
            <span className="truncate px-1 text-xs text-white/70">{L("Компьютер", "Computer")}</span>
          ) : null}
          {crumbs.map((c, i) => (
            <span key={`${c.rel}-${i}`} className="flex shrink-0 items-center gap-0.5">
              <span className="text-white/35">/</span>
              <button
                type="button"
                className="nautilus-path-crumb max-w-[140px] truncate rounded px-1.5 py-0.5 text-xs hover:bg-white/10"
                onClick={() => p.navigateTo(c.rel)}
              >
                {c.label}
              </button>
            </span>
          ))}
        </div>

        <div className="relative flex shrink-0 items-center">
          <svg
            className="pointer-events-none absolute left-1.5 top-1/2 z-[1] -translate-y-1/2 opacity-45"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden
          >
            <path d="M11 10a4 4 0 1 0-1.3 1.3l3 3 1-1zm-4 1a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
          </svg>
          <input
            className="nautilus-search w-[140px] rounded border border-black/40 bg-[#1e1e1e] py-1 pl-7 pr-2 text-xs outline-none focus:border-[#3584e4]/80 sm:w-[180px]"
            value={p.searchQuery}
            onChange={(e) => p.onSearchChange(e.target.value)}
            placeholder={L("Поиск", "Search")}
            autoComplete="off"
          />
        </div>

        <button
          type="button"
          className={`nautilus-tool-btn ${p.viewMode === "grid" ? "bg-white/15" : ""}`}
          title={L("Значки", "Icons")}
          onClick={() => p.setViewMode("grid")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M2 2h5v5H2zm7 0h5v5H9zM2 9h5v5H2zm7 0h5v5H9z" />
          </svg>
        </button>
        <button
          type="button"
          className={`nautilus-tool-btn ${p.viewMode === "list" ? "bg-white/15" : ""}`}
          title={L("Список", "List")}
          onClick={() => p.setViewMode("list")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M2 3h12v2H2zm0 4h12v2H2zm0 4h12v2H2z" />
          </svg>
        </button>

        <button
          type="button"
          className="nautilus-tool-btn"
          title={L("Меню", "Menu")}
          onClick={() => p.setMenuOpen(p.menuOpen === "overflow" ? null : "overflow")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M3 4h10v1.5H3zm0 3.25h10v1.5H3zm0 3.25h10v1.5H3z" />
          </svg>
        </button>
        {p.menuOpen === "overflow" ? (
          <div
            className="nautilus-menu-dropdown absolute right-1 top-full z-[200] mt-0.5 min-w-[200px] rounded border border-black/40 bg-[#353535] py-1 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-white/40">
              {L("Путь", "Path")}
            </div>
            <div className="max-w-[280px] break-all px-3 pb-2 text-[11px] text-white/60">
              {p.virtualLocationPath}
            </div>
          </div>
        ) : null}
      </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-row">
        <aside className="nautilus-sidebar w-[208px] shrink-0 overflow-y-auto border-r border-black/45 bg-[#252525] py-2 text-[13px]">
          <div className="nautilus-side-heading px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-white/45">
            {L("Мой компьютер", "My Computer")}
          </div>
          {p.sidebarComputerItems.map((item) => {
            return (
              <button
                key={`${item.rel}-${item.label}`}
                type="button"
                className={`nautilus-side-row flex w-full items-center gap-2 px-3 py-1.5 text-left ${
                  p.isNautilusSidebarActive(item.rel) ? "nautilus-side-row--active" : "hover:bg-white/6"
                }`}
                onClick={() => p.navigateTo(item.rel)}
              >
                <span className="nautilus-side-ico flex h-[18px] w-[18px] shrink-0 items-center justify-center opacity-90">
                  <img
                    src={sidebarComputerIconUrl(item, p)}
                    alt=""
                    className="nautilus-side-theme-icon"
                    draggable={false}
                  />
                </span>
                <span className="min-w-0 truncate">{item.label}</span>
              </button>
            );
          })}

          {sidebarDeviceItems.length > 0 ? (
            <>
              <div className="nautilus-side-heading mt-3 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                {L("Устройства", "Devices")}
              </div>
              {sidebarDeviceItems.map((item, idx) => {
                const active = item.canHighlight && p.isNautilusSidebarActive(item.rel);
                return (
                  <button
                    key={`dev-${idx}-${item.label}`}
                    type="button"
                    className={`nautilus-side-row flex w-full items-center gap-2 px-3 py-1.5 text-left ${
                      active ? "nautilus-side-row--active" : "hover:bg-white/6"
                    }`}
                    onClick={() => p.navigateTo(item.rel)}
                  >
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center opacity-90" aria-hidden>
                      <img
                        src={breezePlaceUrl("drive-harddisk")}
                        alt=""
                        className="nautilus-side-theme-icon"
                        draggable={false}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span className="flex shrink-0 items-center justify-center" aria-hidden>
                      <img
                        src={breezePlaceUrl("media-eject")}
                        alt=""
                        className="nautilus-side-eject-icon"
                        draggable={false}
                      />
                    </span>
                  </button>
                );
              })}
            </>
          ) : null}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#2e2e2e]">
          <div className="min-h-0 flex-1 overflow-y-auto">{p.children}</div>
          <footer className="nautilus-statusbar flex shrink-0 items-center justify-between gap-3 border-t border-black/40 bg-[#2a2a2a] px-3 py-1.5 text-[12px] text-white/75">
            <span className="min-w-0 flex-1 truncate">{p.nautilusStatusText}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-white/40 sm:inline">{L("Масштаб", "Zoom")}</span>
              <input
                type="range"
                min={0.75}
                max={1.5}
                step={0.05}
                value={p.iconZoom}
                onChange={(e) => p.setIconZoom(Number(e.target.value))}
                className="nautilus-zoom-slider w-24"
              />
            </div>
          </footer>
        </div>
      </div>

      {p.fileInput}
    </div>
  );
}
