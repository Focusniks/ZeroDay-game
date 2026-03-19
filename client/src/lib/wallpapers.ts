export type WallpaperId = "nebula" | "grid" | "stars" | "mono" | "waves";

export type Wallpaper = {
  id: WallpaperId;
  labelRu: string;
  labelEn: string;
  /**
   * Full `background` CSS value, so we can keep the rest of the page styling intact.
   * (No external images; all CSS gradients.)
   */
  background: string;
};

const WALLPAPERS: Wallpaper[] = [
  {
    id: "nebula",
    labelRu: "Туманность",
    labelEn: "Nebula",
    background: `
      radial-gradient(ellipse 120% 80% at 20% 0%, rgba(45, 212, 191, 0.14), transparent 52%),
      radial-gradient(ellipse 100% 60% at 100% 100%, rgba(99, 102, 241, 0.18), transparent 48%),
      linear-gradient(165deg, #070a12 0%, #131a28 40%, #05060a 100%)
    `.trim()
  },
  {
    id: "grid",
    labelRu: "Сетка",
    labelEn: "Grid",
    background: `
      linear-gradient(180deg, #060b14 0%, #0d1220 100%),
      repeating-linear-gradient(90deg, rgba(56, 189, 248, 0.10) 0px, rgba(56, 189, 248, 0.10) 1px, transparent 1px, transparent 48px),
      repeating-linear-gradient(0deg, rgba(56, 189, 248, 0.10) 0px, rgba(56, 189, 248, 0.10) 1px, transparent 1px, transparent 48px)
    `.trim()
  },
  {
    id: "stars",
    labelRu: "Звёзды",
    labelEn: "Stars",
    background: `
      radial-gradient(circle at 15% 20%, rgba(56, 189, 248, 0.20), transparent 22%),
      radial-gradient(circle at 80% 10%, rgba(99, 102, 241, 0.18), transparent 20%),
      radial-gradient(circle at 35% 65%, rgba(45, 212, 191, 0.12), transparent 26%),
      radial-gradient(circle, rgba(255,255,255,0.30) 1px, transparent 1px),
      linear-gradient(165deg, #05060a 0%, #101a2e 45%, #060b14 100%)
    `.trim()
  },
  {
    id: "mono",
    labelRu: "Монохром",
    labelEn: "Monochrome",
    background: `
      linear-gradient(165deg, #070a12 0%, #101827 45%, #05060a 100%),
      radial-gradient(ellipse 90% 50% at 30% 10%, rgba(148, 163, 184, 0.12), transparent 55%)
    `.trim()
  },
  {
    id: "waves",
    labelRu: "Волны",
    labelEn: "Waves",
    background: `
      radial-gradient(ellipse 120% 80% at 10% 10%, rgba(59, 130, 246, 0.18), transparent 55%),
      radial-gradient(ellipse 120% 80% at 90% 80%, rgba(45, 212, 191, 0.14), transparent 52%),
      repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 2px, transparent 18px),
      linear-gradient(165deg, #070a12 0%, #151a2a 45%, #05060a 100%)
    `.trim()
  }
];

export const DEFAULT_WALLPAPER: WallpaperId = "nebula";

export function getWallpapers(): Wallpaper[] {
  return WALLPAPERS;
}

export function getWallpaperBackground(id: WallpaperId | string | null | undefined): string {
  const found = WALLPAPERS.find((w) => w.id === id);
  return (found ?? WALLPAPERS[0]!).background;
}

export const CUSTOM_WALLPAPER_PREFIX = "custom:";

export function isCustomWallpaper(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(CUSTOM_WALLPAPER_PREFIX));
}

export function parseCustomWallpaperRelPath(value: string | null | undefined): string | null {
  if (!isCustomWallpaper(value)) return null;
  const rel = value!.slice(CUSTOM_WALLPAPER_PREFIX.length);
  return rel.trim().length ? rel : null;
}

export function mimeFromRelPath(relPath: string): string {
  const lower = relPath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

