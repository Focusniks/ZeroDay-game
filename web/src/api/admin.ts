/**
 * API-функции для админ-панели
 */
import { apiClient } from './client';
import type { AdminStats, AdminLog, BetaApplication, PaginatedResponse, User, UserWithRoles } from '../types';

/** Получить статистику */
export async function getAdminStatsApi(): Promise<AdminStats> {
  const response = await apiClient.get<{ ok: boolean; stats: AdminStats }>('/admin/stats');
  return response.data.stats;
}

/** Получить список пользователей */
export async function getAdminUsersApi(params: {
  page?: number;
  per_page?: number;
  search?: string;
  sort?: string;
}): Promise<PaginatedResponse<UserWithRoles>> {
  const response = await apiClient.get<{ ok: boolean; users: PaginatedResponse<UserWithRoles> }>('/admin/users', { params });
  return response.data.users;
}

/** Обновить пользователя */
export async function updateAdminUserApi(
  userId: string, 
  updates: { level?: number; xp?: number; reputation?: number; disk_capacity_mb?: number }
): Promise<UserWithRoles> {
  const response = await apiClient.patch<{ ok: boolean; user: UserWithRoles }>(`/admin/users/${userId}`, updates);
  return response.data.user;
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
  const response = await apiClient.get<{ ok: boolean; applications: PaginatedResponse<BetaApplication> }>(
    '/admin/beta-applications', 
    { params }
  );
  return response.data.applications;
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
  const response = await apiClient.get<{ ok: boolean; logs: PaginatedResponse<AdminLog> }>('/admin/logs', { params });
  return response.data.logs;
}

/** Отправить заявку на бета-тест (публичный эндпоинт) */
export async function submitBetaApplicationApi(email: string, source: string): Promise<void> {
  await apiClient.post('/beta-apply', { email, source });
}
