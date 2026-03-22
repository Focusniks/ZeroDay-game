/**
 * Типы для модульной системы подписок
 */

/** Категория модуля подписки */
export type SubscriptionModuleCategory = 'cosmetics' | 'storage' | 'access' | 'features';

/** Модуль подписки из каталога */
export interface SubscriptionModule {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: SubscriptionModuleCategory;
  base_price_monthly: number;
  base_price_yearly: number;
  discount_percent: number;
  available: boolean;
  created_at: string;
}

/** Модуль в подписке пользователя */
export interface UserSubscriptionModule {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: SubscriptionModuleCategory;
  price_monthly: number;
  price_yearly: number;
  discount_percent: number;
  available: boolean;
  selected: boolean;
}

/** Статус подписки */
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';

/** Биллинг период */
export type BillingPeriod = 'monthly' | 'yearly';

/** Активная подписка пользователя */
export interface UserSubscription {
  id: string;
  status: SubscriptionStatus;
  total_monthly_price: number;
  total_yearly_price: number;
  billing_period: BillingPeriod;
  auto_renew: boolean;
  started_at: string;
  expires_at: string | null;
  modules: UserSubscriptionModule[];
}

/** Группа модулей для отображения */
export interface ModuleGroup {
  category: SubscriptionModuleCategory;
  name: string;
  icon: string;
  description: string;
  modules: UserSubscriptionModule[];
}

/** Запрос на создание подписки */
export interface CreateSubscriptionPayload {
  billing_period: BillingPeriod;
  auto_renew?: boolean;
  module_ids: string[];
}

/** Запрос на добавление/удаление модуля */
export interface ModuleActionPayload {
  module_id: string;
}

/** Ответ API с подпиской */
export interface SubscriptionResponse {
  ok: boolean;
  subscription: UserSubscription | null;
  message?: string;
  price_change?: number;
}

/** Ответ API со списком модулей */
export interface ModulesResponse {
  ok: boolean;
  modules: SubscriptionModule[];
}
