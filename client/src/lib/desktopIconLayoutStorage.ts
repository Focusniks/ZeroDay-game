/**
 * Desktop icon positions: dedicated storage format + migration from older keys.
 */

export type DesktopIconCell = { col: number; row: number };
export type DesktopIconCells = Record<string, DesktopIconCell>;

const V3_PREFIX = "zeroday.desktop.layout.v3.";
const LEGACY_PREFIX = "zeroday.desktop.iconCells.";

/** Same source as useAuth — stable user id before React state hydrates. */
export function readStoredUserId(): string | null {
  try {
    const raw = localStorage.getItem("zeroday.user");
    if (!raw) return null;
    const u = JSON.parse(raw) as { id?: unknown };
    return typeof u.id === "string" ? u.id : null;
  } catch {
    return null;
  }
}

export function effectiveDesktopUserId(authUserId: string | undefined | null): string {
  return (authUserId ?? readStoredUserId() ?? "guest").trim() || "guest";
}

export function desktopLayoutStorageKey(userId: string): string {
  return `${V3_PREFIX}${userId}`;
}

function isCellRecord(v: unknown): v is DesktopIconCells {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  for (const x of Object.values(v)) {
    if (!x || typeof x !== "object") return false;
    const o = x as { col?: unknown; row?: unknown };
    if (typeof o.col !== "number" || typeof o.row !== "number") return false;
  }
  return true;
}

function parseStored(raw: string | null): DesktopIconCells | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (o && typeof o === "object" && !Array.isArray(o) && "v" in o && (o as { v: unknown }).v === 3) {
      const cells = (o as { cells?: unknown }).cells;
      if (isCellRecord(cells)) return cells;
      return null;
    }
    if (isCellRecord(o)) return o;
  } catch {
    return null;
  }
  return null;
}

/**
 * Read layout for this account: v3 bucket → legacy flat JSON → guest fallbacks (for first login migration).
 */
export function loadDesktopIconLayout(userId: string): DesktopIconCells {
  const v3 = desktopLayoutStorageKey(userId);
  const legacy = `${LEGACY_PREFIX}${userId}`;
  const guestV3 = desktopLayoutStorageKey("guest");
  const guestLegacy = `${LEGACY_PREFIX}guest`;

  const from =
    parseStored(localStorage.getItem(v3)) ??
    parseStored(localStorage.getItem(legacy)) ??
    (userId !== "guest" ? parseStored(localStorage.getItem(guestV3)) : null) ??
    (userId !== "guest" ? parseStored(localStorage.getItem(guestLegacy)) : null);

  return from ? { ...from } : {};
}

/** Persist only v3 format (single write path). */
export function saveDesktopIconLayout(userId: string, cells: DesktopIconCells): void {
  try {
    const key = desktopLayoutStorageKey(userId);
    const payload = { v: 3 as const, cells };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}
