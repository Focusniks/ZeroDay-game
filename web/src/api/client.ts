/**
 * HTTP-клиент для взаимодействия с backend API
 * Использует axios с интерцепторами для автоподстановки JWT-токена
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Установить JWT-токен для всех последующих запросов */
export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('zeroday_web_token', token);
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
    localStorage.removeItem('zeroday_web_token');
  }
}

/** Восстановить токен из localStorage при загрузке */
export function restoreAuthToken(): string | null {
  const token = localStorage.getItem('zeroday_web_token');
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
  return token;
}

// Интерцептор ответов: обработка 401 (неавторизован)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Токен истёк или невалиден — очищаем
      setAuthToken(null);
      localStorage.removeItem('zeroday_web_user');
      // Перенаправляем на логин, если не на главной
      if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
