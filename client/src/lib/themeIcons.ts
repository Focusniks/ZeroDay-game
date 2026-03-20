/** Resolve URL for assets in `client/public/` (respects Vite `base`). */
export function publicAssetUrl(pathFromPublicRoot: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const p = pathFromPublicRoot.replace(/^\//, "");
  return `${base}${p}`;
}

/** File under `public/theme-icons/` e.g. `terminal.svg`. */
export function themeIconUrl(file: string): string {
  const f = file.replace(/^\//, "");
  return publicAssetUrl(`theme-icons/${f}`);
}

/** Breeze place icon: `computer`, `folder`, `user-trash`, … under `public/theme-icons/breeze/places/`. */
export function breezePlaceUrl(name: string): string {
  const baseName = name.endsWith(".svg") ? name.slice(0, -4) : name;
  return publicAssetUrl(`theme-icons/breeze/places/${baseName}.svg`);
}
