import { getDefaultTimezoneId } from "../data/timezones";
import type { GameLanguage } from "./gameConfig";

export function gameLocale(lang: GameLanguage): string {
  return lang === "ru" ? "ru-RU" : "en-US";
}

function isValidIanaTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Effective IANA zone from saved config (falls back if missing or invalid). */
export function resolveGameTimeZone(configTz: string | undefined | null): string {
  const t = configTz?.trim();
  if (t && isValidIanaTimeZone(t)) return t;
  return getDefaultTimezoneId();
}

/** Calendar date (Y-M-D) in the given IANA timezone for this instant. */
export function getZonedYmd(ms: number, timeZone: string): { y: number; m0: number; d: number } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const s = dtf.format(new Date(ms));
  const [y, m, d] = s.split("-").map(Number);
  return { y, m0: m - 1, d };
}

/** Monday=0 .. Sunday=6 in the given timezone (for `ms` instant). */
export function getZonedWeekdayMon0(ms: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });
  const w = dtf.format(new Date(ms));
  const map: Record<string, number> = { Sun: 6, Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5 };
  return map[w] ?? 0;
}

/**
 * Some UTC instant on the given calendar day in `timeZone` (for weekday / anchors).
 */
export function findUtcMsForZonedDate(y: number, m0: number, day: number, timeZone: string): number {
  let lo = Date.UTC(y, m0, day - 1, 0, 0, 0);
  let hi = Date.UTC(y, m0, day + 1, 23, 59, 59, 999);
  for (let i = 0; i < 48 && hi - lo > 2; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const z = getZonedYmd(mid, timeZone);
    const key = z.y * 500 + z.m0 * 40 + z.d;
    const want = y * 500 + m0 * 40 + day;
    if (key < want) lo = mid;
    else hi = mid;
  }
  return hi;
}

export function formatZonedTime(ms: number, timeZone: string, lang: GameLanguage): string {
  const locale = gameLocale(lang);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(ms));
}

/** Same as {@link formatZonedTime} but includes seconds (for calendar popover, etc.). */
export function formatZonedTimeWithSeconds(ms: number, timeZone: string, lang: GameLanguage): string {
  const locale = gameLocale(lang);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(ms));
}

export function formatZonedDateShort(ms: number, timeZone: string, lang: GameLanguage): string {
  const locale = gameLocale(lang);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(ms));
}
