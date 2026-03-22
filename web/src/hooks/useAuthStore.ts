/**
 * Zustand-хранилище для авторизации
 * Управляет состоянием пользователя, токеном и загрузкой
 */
import { create } from 'zustand';
import type { User } from '../types';
import { loginApi, getMeApi, logoutApi } from '../api/auth';
import { restoreAuthToken, setAuthToken } from '../api/client';

interface AuthState {
  /** Текущий пользователь */
  user: User | null;
  /** Загрузка (инициализация / запрос) */
  loading: boolean;
  /** Авторизован ли пользователь */
  isAuthenticated: boolean;
  /** Является ли пользователь администратором */
  isAdmin: boolean;
  /** Ошибка авторизации */
  error: string | null;

  /** Инициализация — восстановление сессии из localStorage */
  init: () => Promise<void>;
  /** Вход */
  login: (login: string, password: string) => Promise<void>;
  /** Выход */
  logout: () => void;
  /** Обновить данные пользователя */
  refreshUser: () => Promise<void>;
  /** Очистить ошибку */
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  isAuthenticated: false,
  isAdmin: false,
  error: null,

  init: async () => {
    const token = restoreAuthToken();
    if (!token) {
      set({ loading: false, isAuthenticated: false, user: null });
      return;
    }

    try {
      const user = await getMeApi();
      set({
        user,
        isAuthenticated: true,
        isAdmin: user.role === 'admin',
        loading: false,
      });
    } catch {
      // Токен невалиден
      setAuthToken(null);
      set({ loading: false, isAuthenticated: false, user: null });
    }
  },

  login: async (login: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const { user } = await loginApi(login, password);
      set({
        user,
        isAuthenticated: true,
        isAdmin: user.role === 'admin',
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Ошибка авторизации. Проверьте логин и пароль.';
      set({ loading: false, error: message });
      throw new Error(message);
    }
  },

  logout: () => {
    logoutApi();
    set({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      error: null,
    });
  },

  refreshUser: async () => {
    try {
      const user = await getMeApi();
      set({
        user,
        isAuthenticated: true,
        isAdmin: user.role === 'admin',
      });
    } catch {
      get().logout();
    }
  },

  clearError: () => set({ error: null }),
}));
