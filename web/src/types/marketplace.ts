/**
 * Типы для маркетплейса
 */

/** Категория лота */
export type LotCategory = 
  | 'currency'      // Игровая валюта
  | 'items'         // Предметы
  | 'accounts'      // Аккаунты
  | 'services'      // Услуги
  | 'cards'         // Карты/ключи
  | 'other';        // Прочее

/** Статус лота */
export type LotStatus = 'active' | 'sold' | 'cancelled';

/** Лот на продажу */
export interface Lot {
  id: string;
  seller_id: string;
  seller_username: string;
  seller_rating: number;
  seller_reviews_count: number;
  title: string;
  description: string;
  category: LotCategory;
  price: number;          // Цена в рублях
  quantity: number;        // Количество (для валюты/предметов)
  unit?: string;          // Единица измерения (напр. "голд", "штук")
  image_url?: string;
  status: LotStatus;
  created_at: string;
  updated_at: string;
}

/** Запрос на создание лота */
export interface CreateLotPayload {
  title: string;
  description: string;
  category: LotCategory;
  price: number;
  quantity?: number;
  unit?: string;
  image_url?: string;
}

/** Корзина */
export interface CartItem {
  lot_id: string;
  lot: Lot;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  total: number;
}

/** Заказ/Сделка */
export type DealStatus = 
  | 'pending'      // Ожидает подтверждения продавца
  | 'accepted'     // Продавец принял
  | 'paid'         // Покупатель оплатил
  | 'completed'    // Сделка завершена
  | 'cancelled'    // Отменена
  | 'disputed';    // Спор

export interface Deal {
  id: string;
  lot_id: string;
  lot: Lot;
  buyer_id: string;
  buyer_username: string;
  seller_id: string;
  seller_username: string;
  quantity: number;
  total_price: number;
  status: DealStatus;
  created_at: string;
  updated_at: string;
}

/** Отзыв */
export interface Review {
  id: string;
  deal_id: string;
  author_id: string;
  author_username: string;
  target_user_id: string;
  rating: number;          // 1-5
  comment: string;
  created_at: string;
}

/** История транзакций кошелька */
export type TransactionType = 
  | 'deposit'       // Пополнение
  | 'purchase'      // Покупка
  | 'sale'          // Продажа
  | 'refund';       // Возврат

export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface WalletTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;         // Положительное для пополнения, отрицательное для расхода
  balance_after: number;
  description: string;
  status: TransactionStatus;
  created_at: string;
}

/** Баланс кошелька */
export interface WalletBalance {
  balance: number;
  currency: string;
}

/** Подписка */
export type SubscriptionPlan = 
  | 'basic'         // Базовый
  | 'premium'       // Премиум
  | 'vip';          // VIP

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string;
  auto_renew: boolean;
  price: number;           // Цена за период
  period: 'monthly' | 'yearly';
}

/** Тарифный план подписки */
export interface SubscriptionPlanInfo {
  id: SubscriptionPlan;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  color: string;           // Цвет для отображения
}

/** Платный товар/услуга */
export type ProductType = 
  | 'account_upgrade'   // Улучшение аккаунта
  | 'currency_pack'     // Пакет валюты
  | 'item_pack'         // Пакет предметов
  | 'feature_unlock'    // Разблокировка функций
  | 'cosmetics';        // Косметика

export interface Product {
  id: string;
  type: ProductType;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  features?: string[];
  available: boolean;
}

/** Достижение */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  progress: number;        // Текущий прогресс (0-100)
  unlocked: boolean;
  unlocked_at?: string;
  reward?: number;         // Награда в валюте
}

/** Пагинированный ответ */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

/** Фильтры для лотов */
export interface LotFilters {
  category?: LotCategory;
  search?: string;
  min_price?: number;
  max_price?: number;
  sort_by?: 'created_at' | 'price' | 'rating';
  sort_order?: 'asc' | 'desc';
}

/** Фильтры для сделок */
export interface DealFilters {
  status?: DealStatus;
  role?: 'buyer' | 'seller';
}
