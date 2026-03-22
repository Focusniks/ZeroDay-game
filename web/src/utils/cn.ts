/**
 * Утилита для объединения CSS-классов (аналог clsx/twMerge)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
