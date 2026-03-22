/**
 * Хуки для админ-панели
 */
import { useState, useCallback } from 'react';
import { useAuthStore } from './useAuthStore';
import * as adminApi from '../api/admin';
import type { AdminStats, UserWithRoles, AdminLog, BetaApplication, PaginatedResponse } from '../types';

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getAdminStatsApi();
      setStats(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, fetchStats };
}

export function useAdminUsers() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0,
  });

  const fetchUsers = useCallback(async (params?: { page?: number; search?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getAdminUsersApi({
        page: params?.page || pagination.page,
        per_page: pagination.per_page,
        search: params?.search,
      });
      setUsers(data.items);
      setPagination({
        page: data.page,
        per_page: data.per_page,
        total: data.total,
        total_pages: data.total_pages,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.per_page]);

  const updateUser = useCallback(async (userId: string, updates: { level?: number; xp?: number; reputation?: number }) => {
    await adminApi.updateAdminUserApi(userId, updates);
    await fetchUsers();
  }, [fetchUsers]);

  const banUser = useCallback(async (userId: string, banned: boolean) => {
    await adminApi.toggleBanUserApi(userId, banned);
    await fetchUsers();
  }, [fetchUsers]);

  const changeRole = useCallback(async (userId: string, role: string) => {
    await adminApi.changeUserRoleApi(userId, role);
    await fetchUsers();
  }, [fetchUsers]);

  return { users, loading, error, pagination, fetchUsers, updateUser, banUser, changeRole };
}

export function useAdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 50,
    total: 0,
    total_pages: 0,
  });

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getAdminLogsApi({ page, per_page: pagination.per_page });
      setLogs(data.items);
      setPagination(prev => ({ ...prev, page: data.page, total: data.total, total_pages: data.total_pages }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [pagination.per_page]);

  return { logs, loading, error, pagination, fetchLogs };
}

export function useBetaApplications() {
  const [applications, setApplications] = useState<BetaApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0,
  });

  const fetchApplications = useCallback(async (params?: { page?: number; status?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getBetaApplicationsApi({
        page: params?.page || pagination.page,
        per_page: pagination.per_page,
        status: params?.status,
      });
      setApplications(data.items);
      setPagination({
        page: data.page,
        per_page: data.per_page,
        total: data.total,
        total_pages: data.total_pages,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.per_page]);

  const updateStatus = useCallback(async (id: string, status: 'approved' | 'rejected') => {
    await adminApi.updateBetaApplicationStatusApi(id, status);
    await fetchApplications();
  }, [fetchApplications]);

  return { applications, loading, error, pagination, fetchApplications, updateStatus };
}
