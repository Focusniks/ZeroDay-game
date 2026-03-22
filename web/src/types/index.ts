/** Пользователь из backend API */
export interface User {
  id: string;
  username: string;
  email: string;
  ip_address: string;
  level: number;
  xp: number;
  reputation: number;
  disk_capacity_mb: number;
  role?: string;
  created_at?: string;
  last_login?: string;
  is_banned?: boolean;
}

/** Ответ авторизации */
export interface AuthResponse {
  token: string;
  user: User;
}

/** Заявка на бета-тест */
export interface BetaApplication {
  id: string;
  email: string;
  source: string;
  status: 'new' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

/** Статистика для админ-панели */
export interface AdminStats {
  total_users: number;
  new_users_today: number;
  new_users_week: number;
  new_users_month: number;
  total_beta_applications: number;
  pending_beta_applications: number;
  online_users: number;
}

/** Лог действий администратора */
export interface AdminLog {
  id: string;
  admin_id: string;
  admin_username: string;
  action: string;
  target_user_id?: string;
  target_username?: string;
  details?: string;
  created_at: string;
}

/** Пагинация */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

/** Источники, откуда узнали об игре */
export const BETA_SOURCES = [
  'YouTube',
  'Twitch',
  'Twitter/X',
  'Reddit',
  'Discord',
  'TikTok',
  'Друг посоветовал',
  'Игровой форум',
  'Поисковая система (Google/Яндекс)',
  'Новостной сайт об играх',
  'Другое',
] as const;

export type BetaSource = (typeof BETA_SOURCES)[number];
