/**
 * API-функции для админ-панели
 */
import { apiClient } from './client';
import type { AdminStats, AdminLog, BetaApplication, PaginatedResponse, User } from '../types';

/** Получить статистику */
export async function getAdminStatsApi(): Promise<AdminStats> {
  const { data } = await apiClient.get<AdminStats>('/admin/stats');
  return data;
}

/** Получить список пользователей */
export async function getAdminUsersApi(params: {
  page?: number;
  per_page?: number;
  search?: string;
  sort?: string;
}): Promise<PaginatedResponse<User>> {
  const { data } = await apiClient.get<PaginatedResponse<User>>('/admin/users', { params });
  return data;
}

/** Обновить пользователя */
export async function updateAdminUserApi(userId: string, updates: Partial<User>): Promise<User> {
  const { data } = await apiClient.patch<User>(`/admin/users/${userId}`, updates);
  return data;
}

/** Забанить/разбанить пользователя */
export async function toggleBanUserApi(userId: string, banned: boolean): Promise<void> {
  await apiClient.post(`/admin/users/${userId}/ban`, { banned });
}

/** Изменить роль пользователя */
export async function changeUserRoleApi(userId: string, role: string): Promise<void> {
  await apiClient.post(`/admin/users/${userId}/role`, { role });
}

/** Получить заявки на бета-тест */
export async function getBetaApplicationsApi(params: {
  page?: number;
  per_page?: number;
  status?: string;
}): Promise<PaginatedResponse<BetaApplication>> {
  const { data } = await apiClient.get<PaginatedResponse<BetaApplication>>('/admin/beta-applications', { params });
  return data;
}

/** Обновить статус заявки на бета-тест */
export async function updateBetaApplicationStatusApi(
  id: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  await apiClient.patch(`/admin/beta-applications/${id}`, { status });
}

/** Получить логи администраторов */
export async function getAdminLogsApi(params: {
  page?: number;
  per_page?: number;
}): Promise<PaginatedResponse<AdminLog>> {
  const { data } = await apiClient.get<PaginatedResponse<AdminLog>>('/admin/logs', { params });
  return data;
}

/** Отправить заявку на бета-тест (публичный эндпоинт) */
export async function submitBetaApplicationApi(email: string, source: string): Promise<void> {
  await apiClient.post('/beta-apply', { email, source });
}
