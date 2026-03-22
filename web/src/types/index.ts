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
  role: string;
  created_at?: string;
  last_login?: string;
  is_banned?: boolean;
}

/** Ответ авторизации */
export interface AuthResponse {
  token: string;
  refresh_token?: string;
  user: User;
  expires_in?: number;
}

/** Заявка на бета-тест */
export interface BetaApplication {
  id: string;
  email: string;
  source: string;
  status: 'new' | 'pending' | 'approved' | 'rejected';
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
  banned_users: number;
  active_admins: number;
}

/** Лог действий администратора */
export interface AdminLog {
  id: string;
  admin_id: string;
  admin_username: string;
  action: string;
  target_user_id?: string;
  target_username?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
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

/** Пользователь с ролями для админки */
export interface UserWithRoles extends User {
  roles: string[];
  is_banned: boolean;
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

/** Доступные роли пользователей */
export type UserRole = 'user' | 'beta_tester' | 'admin' | 'moderator' | 'banned';

/** Данные для графиков */
export interface ChartDataPoint {
  label: string;
  value: number;
  date?: string;
}

/** Статистика пользователя для профиля */
export interface UserStats {
  total_xp: number;
  total_reputation: number;
  level: number;
  xp_to_next_level: number;
  games_played?: number;
  challenges_completed?: number;
  rank?: number;
}

/** Активность пользователя */
export interface UserActivity {
  id: string;
  activity_type: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}
