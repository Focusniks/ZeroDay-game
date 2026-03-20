import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { FsEntry } from "../lib/gameFs";
import type { GameLanguage } from "../lib/gameConfig";
import {
  effectiveDesktopUserId,
  loadDesktopIconLayout,
  saveDesktopIconLayout,
  type DesktopIconCell,
  type DesktopIconCells
} from "../lib/desktopIconLayoutStorage";

export const DESKTOP_COMPUTER_CELL_KEY = "__desktop_computer__";
export const DESKTOP_TRASH_CELL_KEY = "__desktop_trash__";

// Left edge of the desktop icon grid (0 means icons can reach the very left corner).
const DESK_LEFT = 0;
const DESK_TOP = 0;
const DESK_RIGHT_PAD = 0;
const DESK_BOTTOM_PAD = 0;
const TASKBAR_H = 48;
const CELL_W = 96;
const CELL_H = 78;

function getGrid() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const usableW = vw - DESK_LEFT - DESK_RIGHT_PAD;
  const usableH = vh - TASKBAR_H - DESK_TOP - DESK_BOTTOM_PAD;
  const cols = Math.max(1, Math.floor(usableW / CELL_W));
  const rows = Math.max(1, Math.floor(usableH / CELL_H));
  return { cols, rows };
}

const cellKey = (col: number, row: number) => `${col}:${row}`;

function findNearestFreeCell(
  desiredCol: number,
  desiredRow: number,
  ignoreRelPath: string | null,
  occupied: Map<string, string>
) {
  const { cols, rows } = getGrid();
  const dc = Math.min(Math.max(0, desiredCol), cols - 1);
  const dr = Math.min(Math.max(0, desiredRow), rows - 1);

  let best: { col: number; row: number } | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const key = cellKey(col, row);
      const occ = occupied.get(key);
      if (occ && occ !== ignoreRelPath) continue;
      const dist = (col - dc) * (col - dc) + (row - dr) * (row - dr);
      if (dist < bestDist) {
        bestDist = dist;
        best = { col, row };
      }
    }
  }

  return best;
}

function getDefaultSpecialCells(): { computer: DesktopIconCell; trash: DesktopIconCell } {
  const { cols, rows } = getGrid();
  const computer = { col: 0, row: 0 };
  const trash =
    rows > 1 ? { col: 0, row: 1 } : cols > 1 ? { col: 1, row: 0 } : { col: 0, row: 0 };
  return { computer, trash };
}

function getSpecialCellsCurrent(cells: DesktopIconCells) {
  const defaults = getDefaultSpecialCells();
  return {
    computer: cells[DESKTOP_COMPUTER_CELL_KEY] ?? defaults.computer,
    trash: cells[DESKTOP_TRASH_CELL_KEY] ?? defaults.trash
  };
}

type Options = {
  authUserId: string | undefined | null;
  desktopItems: FsEntry[];
  desktopListReady: boolean;
  desktopCreateDesiredCell: { col: number; row: number } | null;
  setDesktopCreateDesiredCell: Dispatch<SetStateAction<{ col: number; row: number } | null>>;
  addToast: (message: string) => void;
  lang: GameLanguage;
};

/**
 * Desktop icon grid state + localStorage sync + FS reconciliation.
 * Save is suppressed for one commit after each storage-user change so we never write another user's cells.
 */
export function useDesktopIconLayout({
  authUserId,
  desktopItems,
  desktopListReady,
  desktopCreateDesiredCell,
  setDesktopCreateDesiredCell,
  addToast,
  lang
}: Options) {
  const addToastRef = useRef(addToast);
  const langRef = useRef(lang);
  addToastRef.current = addToast;
  langRef.current = lang;

  const storageUserId = effectiveDesktopUserId(authUserId);

  const [cells, setCells] = useState<DesktopIconCells>(() => loadDesktopIconLayout(storageUserId));

  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  const skipNextSaveRef = useRef(false);

  useLayoutEffect(() => {
    skipNextSaveRef.current = true;
    setCells(loadDesktopIconLayout(storageUserId));
  }, [storageUserId]);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    saveDesktopIconLayout(storageUserId, cells);
  }, [storageUserId, cells]);

  useEffect(() => {
    if (!desktopListReady) return;

    const prev = cellsRef.current;
    const current = new Set(desktopItems.map((d) => d.relPath));
    const next: DesktopIconCells = { ...prev };

    let changed = false;
    for (const k of Object.keys(next)) {
      if (k === DESKTOP_COMPUTER_CELL_KEY || k === DESKTOP_TRASH_CELL_KEY) continue;
      if (!current.has(k)) {
        delete next[k];
        changed = true;
      }
    }

    const { cols, rows } = getGrid();

    const occupied = new Map<string, string>();
    const special = getSpecialCellsCurrent(next);
    occupied.set(cellKey(special.computer.col, special.computer.row), DESKTOP_COMPUTER_CELL_KEY);
    occupied.set(cellKey(special.trash.col, special.trash.row), DESKTOP_TRASH_CELL_KEY);
    for (const [rel, cell] of Object.entries(next)) {
      if (rel === DESKTOP_COMPUTER_CELL_KEY || rel === DESKTOP_TRASH_CELL_KEY) continue;
      occupied.set(cellKey(cell.col, cell.row), rel);
    }

    let overflowCount = 0;
    let placedFromDesiredCell = false;
    for (const d of desktopItems) {
      if (next[d.relPath]) continue;
      let placed = false;

      if (desktopCreateDesiredCell && !placedFromDesiredCell) {
        const best = findNearestFreeCell(
          desktopCreateDesiredCell.col,
          desktopCreateDesiredCell.row,
          null,
          occupied
        );
        if (best) {
          next[d.relPath] = best;
          occupied.set(cellKey(best.col, best.row), d.relPath);
          placed = true;
          changed = true;
          placedFromDesiredCell = true;
        }
      }

      if (placed) continue;
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const key = cellKey(col, row);
          if (occupied.has(key)) continue;
          next[d.relPath] = { col, row };
          occupied.set(key, d.relPath);
          placed = true;
          changed = true;
          break;
        }
        if (placed) break;
      }
      if (!placed) overflowCount++;
    }

    if (changed) setCells(next);
    if (overflowCount > 0) {
      const l = langRef.current;
      addToastRef.current(l === "ru" ? "Нет места на рабочем столе" : "No space on the desktop");
    }
    if (placedFromDesiredCell) setDesktopCreateDesiredCell(null);
  }, [desktopItems, desktopListReady, desktopCreateDesiredCell, setDesktopCreateDesiredCell]);

  return {
    desktopIconCells: cells,
    setDesktopIconCells: setCells,
    desktopIconCellsRef: cellsRef,
    DESK_LEFT,
    DESK_TOP,
    CELL_W,
    CELL_H,
    getDefaultSpecialCells,
    getSpecialCellsCurrent: (c: DesktopIconCells) => getSpecialCellsCurrent(c),
    cellKey,
    findNearestFreeCell
  };
}
