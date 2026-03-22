/**
 * API функции для модульной системы подписок
 */
import { apiClient } from './client';
import type {
  SubscriptionModule,
  UserSubscription,
  CreateSubscriptionPayload,
  ModuleActionPayload,
  SubscriptionResponse,
  ModulesResponse,
} from '../types/subscription';

/** Получить все доступные модули подписки */
export async function getSubscriptionModulesApi(category?: string): Promise<SubscriptionModule[]> {
  const params = category ? { category } : {};
  const { data } = await apiClient.get<ModulesResponse>('/subscription/modules', { params });
  return data.modules;
}

/** Получить мою активную подписку */
export async function getMySubscriptionApi(): Promise<UserSubscription | null> {
  const { data } = await apiClient.get<SubscriptionResponse>('/subscription/my');
  return data.subscription;
}

/** Создать новую подписку */
export async function createSubscriptionApi(
  payload: CreateSubscriptionPayload
): Promise<UserSubscription> {
  const { data } = await apiClient.post<SubscriptionResponse>('/subscription', payload);
  return data.subscription as UserSubscription;
}

/** Добавить модуль к подписке */
export async function addModuleApi(payload: ModuleActionPayload): Promise<{ ok: boolean; price_change: number }> {
  const { data } = await apiClient.post('/subscription/module', payload);
  return data;
}

/** Удалить модуль из подписки */
export async function removeModuleApi(payload: ModuleActionPayload): Promise<{ ok: boolean; price_change: number }> {
  const { data } = await apiClient.delete('/subscription/module', { data: payload });
  return data;
}

/** Отменить подписку */
export async function cancelSubscriptionApi(): Promise<{ ok: boolean; message: string }> {
  const { data } = await apiClient.post('/subscription/cancel');
  return data;
}

/** Продлить подписку */
export async function renewSubscriptionApi(): Promise<UserSubscription> {
  const { data } = await apiClient.post<SubscriptionResponse>('/subscription/renew');
  return data.subscription as UserSubscription;
}
