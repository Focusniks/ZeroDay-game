/**
 * API-функции для авторизации
 * Интеграция с backend/src/auth.rs
 */
import { apiClient, setAuthToken } from './client';
import type { AuthResponse, User } from '../types';

/** Вход в систему */
export async function loginApi(login: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { login, password });
  setAuthToken(data.token, data.refresh_token);
  return data;
}

/** Получить текущего пользователя по токену */
export async function getMeApi(): Promise<User> {
  const { data } = await apiClient.get<{ ok: boolean; user: User }>('/auth/me');
  return data.user;
}

/** Регистрация */
export async function registerApi(username: string, email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', { username, email, password });
  setAuthToken(data.token, data.refresh_token);
  return data;
}

/** Сменить пароль */
export async function changePasswordApi(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

/** Обновить токены */
export async function refreshTokenApi(refreshToken: string): Promise<{ token: string; refresh_token: string }> {
  const { data } = await apiClient.post<{ token: string; refresh_token: string }>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  setAuthToken(data.token, data.refresh_token);
  return data;
}

/** Выход из системы */
export async function logoutApi(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    setAuthToken(null, null);
    localStorage.removeItem('zeroday_web_user');
  }
}
