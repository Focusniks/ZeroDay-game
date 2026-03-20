/**
 * Bundled Oxygen-style system sounds (KDE Plasma 6 Oxygen theme, VSTHEMES.ORG).
 * Files live in `client/public/sounds/oxygen/` so every build ships the same assets.
 */

const BASE = `${import.meta.env.BASE_URL}sounds/oxygen/`.replace(/\/{2,}/g, "/");

/** Global gain on top of per-sound levels (~÷5 vs 1.0, extra headroom). */
const OS_SOUND_LEVEL_SCALE = 0.18;

function resolveUrl(file: string): string {
  const path = file.replace(/^\/+/, "");
  return BASE.endsWith("/") ? `${BASE}${path}` : `${BASE}/${path}`;
}

/** Play a WAV from `public/sounds/oxygen/`. Fails silently if autoplay blocks. */
export function playOsSound(file: string, volume = 0.72): void {
  if (typeof Audio === "undefined") return;
  try {
    const a = new Audio(resolveUrl(file));
    a.volume = Math.min(1, Math.max(0, volume * OS_SOUND_LEVEL_SCALE));
    void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

export function playWindowClose(): void {
  playOsSound("window-close.wav");
}

export function playWindowMinimize(): void {
  playOsSound("window-minimized.wav");
}

export function playWindowMaximize(): void {
  playOsSound("window-maximized.wav");
}

/** Restore from maximized / “unshade” metaphor */
export function playWindowRestore(): void {
  playOsSound("window-unshaded.wav", 0.65);
}

export function playWindowMoveEnd(): void {
  playOsSound("window-move-end.wav", 0.55);
}

export function playDialogQuestion(): void {
  playOsSound("dialog-question.wav", 0.6);
}

export function playDialogDanger(): void {
  playOsSound("dialog-error.wav", 0.55);
}

export function playDialogInfo(): void {
  playOsSound("dialog-information.wav", 0.55);
}

export function playTrashEmpty(): void {
  playOsSound("trash-empty.wav", 0.7);
}

export function playDesktopLogin(): void {
  playOsSound("desktop-login-short.wav", 0.55);
}

export function playDesktopLogout(): void {
  playOsSound("desktop-logout.wav", 0.55);
}

export function playOutcomeSuccess(): void {
  playOsSound("outcome-success.wav", 0.5);
}

export function playOutcomeFailure(): void {
  playOsSound("outcome-failure.wav", 0.5);
}
