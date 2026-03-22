/**
 * HTTP-клиент для взаимодействия с backend API
 * Использует axios с интерцепторами для автоподстановки JWT-токена
 * и автоматического обновления токенов
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

// Флаг для предотвращения множественных запросов на обновление
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/** Установить JWT-токен для всех последующих запросов */
export function setAuthToken(token: string | null, refreshToken: string | null = null) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('zeroday_web_token', token);
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
    localStorage.removeItem('zeroday_web_token');
  }
  
  if (refreshToken) {
    localStorage.setItem('zeroday_web_refresh_token', refreshToken);
  } else {
    localStorage.removeItem('zeroday_web_refresh_token');
  }
}

/** Восстановить токен из localStorage при загрузке */
export function restoreAuthToken(): { token: string | null; refreshToken: string | null } {
  const token = localStorage.getItem('zeroday_web_token');
  const refreshToken = localStorage.getItem('zeroday_web_refresh_token');
  
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
  
  return { token, refreshToken };
}

/** Получить refresh токен */
export function getRefreshToken(): string | null {
  return localStorage.getItem('zeroday_web_refresh_token');
}

// Интерцептор ответов: обработка 401 (неавторизован) и автоматическое обновление
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        
        const response = await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        
        const { token, refresh_token } = response.data;
        
        setAuthToken(token, refresh_token);
        
        processQueue(null, token);
        
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        setAuthToken(null, null);
        localStorage.removeItem('zeroday_web_user');
        
        if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    // Другие ошибки 401 - разлогиниваем
    if (error.response?.status === 401) {
      setAuthToken(null, null);
      localStorage.removeItem('zeroday_web_user');
      
      if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);
