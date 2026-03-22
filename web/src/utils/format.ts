/**
 * Утилиты форматирования
 */

/** Форматирование даты в русском формате */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Форматирование даты и времени */
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Форматирование числа с разделителями */
export function formatNumber(num: number): string {
  return num.toLocaleString('ru-RU');
}

/** Сокращение email для отображения */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const masked = local.length > 3
    ? local.slice(0, 3) + '***'
    : local[0] + '***';
  return `${masked}@${domain}`;
}
