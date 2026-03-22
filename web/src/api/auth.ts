/**
 * API-функции для авторизации
 * Интеграция с backend/src/auth.rs
 */
import { apiClient, setAuthToken } from './client';
import type { AuthResponse, User } from '../types';

/** Вход в систему */
export async function loginApi(login: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { login, password });
  setAuthToken(data.token);
  return data;
}

/** Получить текущего пользователя по токену */
export async function getMeApi(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}

/** Регистрация */
export async function registerApi(username: string, email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', { username, email, password });
  setAuthToken(data.token);
  return data;
}

/** Сменить пароль */
export async function changePasswordApi(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

/** Выход из системы */
export function logoutApi(): void {
  setAuthToken(null);
  localStorage.removeItem('zeroday_web_user');
}
