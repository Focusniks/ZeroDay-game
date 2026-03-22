/**
 * API функции для маркетплейса
 */
import { apiClient } from './client';
import type {
  Lot,
  Cart,
  CartItem,
  Deal,
  Review,
  WalletTransaction,
  WalletBalance,
  Subscription,
  SubscriptionPlanInfo,
  Product,
  CreateLotPayload,
  LotFilters,
  DealFilters,
  PaginatedResponse,
} from '../types/marketplace';

// ============ Лоты ============

/** Получить список лотов с фильтрами */
export async function getLotsApi(
  filters: LotFilters = {},
  page = 1,
  perPage = 20
): Promise<PaginatedResponse<Lot>> {
  const { data } = await apiClient.get<PaginatedResponse<Lot>>('/marketplace/lots', {
    params: { ...filters, page, per_page: perPage },
  });
  return data;
}

/** Получить лот по ID */
export async function getLotApi(lotId: string): Promise<Lot> {
  const { data } = await apiClient.get<Lot>(`/marketplace/lots/${lotId}`);
  return data;
}

/** Создать лот */
export async function createLotApi(payload: CreateLotPayload): Promise<Lot> {
  const { data } = await apiClient.post<Lot>('/marketplace/lots', payload);
  return data;
}

/** Получить мои лоты */
export async function getMyLotsApi(
  page = 1,
  perPage = 20
): Promise<PaginatedResponse<Lot>> {
  const { data } = await apiClient.get<PaginatedResponse<Lot>>('/marketplace/my/lots', {
    params: { page, per_page: perPage },
  });
  return data;
}

// ============ Корзина ============

/** Получить корзину */
export async function getCartApi(): Promise<Cart> {
  const { data } = await apiClient.get<Cart>('/marketplace/cart');
  return data;
}

/** Добавить в корзину */
export async function addToCartApi(lotId: string, quantity = 1): Promise<Cart> {
  const { data } = await apiClient.post<Cart>('/marketplace/cart/add', { lot_id: lotId, quantity });
  return data;
}

/** Удалить из корзины */
export async function removeFromCartApi(lotId: string): Promise<Cart> {
  const { data } = await apiClient.post<Cart>('/marketplace/cart/remove', { lot_id: lotId });
  return data;
}

/** Очистить корзину */
export async function clearCartApi(): Promise<void> {
  await apiClient.post('/marketplace/cart/clear');
}

// ============ Сделки ============

/** Создать запрос на покупку (открыть сделку) */
export async function createDealApi(lotId: string, quantity: number): Promise<Deal> {
  const { data } = await apiClient.post<Deal>(`/marketplace/lots/${lotId}/request`, { quantity });
  return data;
}

/** Получить мои сделки как покупатель */
export async function getMyDealsApi(
  filters: DealFilters = {},
  page = 1,
  perPage = 20
): Promise<PaginatedResponse<Deal>> {
  const { data } = await apiClient.get<PaginatedResponse<Deal>>('/marketplace/my/deals', {
    params: { ...filters, page, per_page: perPage },
  });
  return data;
}

/** Подтвердить сделку (продавец) */
export async function acceptDealApi(dealId: string): Promise<Deal> {
  const { data } = await apiClient.post<Deal>(`/marketplace/deals/${dealId}/accept`);
  return data;
}

/** Отменить сделку */
export async function cancelDealApi(dealId: string): Promise<Deal> {
  const { data } = await apiClient.post<Deal>(`/marketplace/deals/${dealId}/cancel`);
  return data;
}

/** Завершить сделку (после подтверждения получения) */
export async function completeDealApi(dealId: string): Promise<Deal> {
  const { data } = await apiClient.post<Deal>(`/marketplace/deals/${dealId}/complete`);
  return data;
}

/** Открыть спор по сделке */
export async function disputeDealApi(dealId: string, reason: string): Promise<Deal> {
  const { data } = await apiClient.post<Deal>(`/marketplace/deals/${dealId}/dispute`, { reason });
  return data;
}

// ============ Отзывы ============

/** Получить отзывы о пользователе */
export async function getUserReviewsApi(
  userId: string,
  page = 1,
  perPage = 10
): Promise<PaginatedResponse<Review>> {
  const { data } = await apiClient.get<PaginatedResponse<Review>>(`/marketplace/users/${userId}/reviews`, {
    params: { page, per_page: perPage },
  });
  return data;
}

/** Оставить отзыв о сделке */
export async function createReviewApi(
  dealId: string,
  rating: number,
  comment: string
): Promise<Review> {
  const { data } = await apiClient.post<Review>(`/marketplace/deals/${dealId}/review`, {
    rating,
    comment,
  });
  return data;
}

// ============ Кошелёк ============

/** Получить баланс кошелька */
export async function getWalletBalanceApi(): Promise<WalletBalance> {
  const { data } = await apiClient.get<WalletBalance>('/marketplace/wallet/balance');
  return data;
}

/** Получить историю транзакций */
export async function getWalletTransactionsApi(
  page = 1,
  perPage = 20
): Promise<PaginatedResponse<WalletTransaction>> {
  const { data } = await apiClient.get<PaginatedResponse<WalletTransaction>>('/marketplace/wallet/transactions', {
    params: { page, per_page: perPage },
  });
  return data;
}

/** Пополнить баланс (имитация) */
export async function depositFundsApi(amount: number): Promise<WalletTransaction> {
  const { data } = await apiClient.post<WalletTransaction>('/marketplace/wallet/deposit', { amount });
  return data;
}

// ============ Подписки ============

/** Получить доступные планы подписок */
export async function getSubscriptionPlansApi(): Promise<SubscriptionPlanInfo[]> {
  const { data } = await apiClient.get<SubscriptionPlanInfo[]>('/marketplace/subscriptions/plans');
  return data;
}

/** Получить мою активную подписку */
export async function getMySubscriptionApi(): Promise<Subscription | null> {
  const { data } = await apiClient.get<Subscription | null>('/marketplace/subscriptions/current');
  return data;
}

/** Оформить подписку */
export async function subscribeApi(plan: string, period: 'monthly' | 'yearly'): Promise<Subscription> {
  const { data } = await apiClient.post<Subscription>('/marketplace/subscriptions', { plan, period });
  return data;
}

/** Отменить подписку */
export async function cancelSubscriptionApi(): Promise<Subscription> {
  const { data } = await apiClient.post<Subscription>('/marketplace/subscriptions/cancel');
  return data;
}

/** Продлить подписку */
export async function renewSubscriptionApi(): Promise<Subscription> {
  const { data } = await apiClient.post<Subscription>('/marketplace/subscriptions/renew');
  return data;
}

// ============ Товары ============

/** Получить каталог товаров */
export async function getProductsApi(): Promise<Product[]> {
  const { data } = await apiClient.get<Product[]>('/marketplace/products');
  return data;
}

/** Купить товар */
export async function purchaseProductApi(productId: string): Promise<{ success: boolean; message: string }> {
  const { data } = await apiClient.post<{ success: boolean; message: string }>('/marketplace/products/purchase', {
    product_id: productId,
  });
  return data;
}
