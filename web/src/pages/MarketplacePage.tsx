/**
 * Marketplace Page - Торговая площадка
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Plus,
  ShoppingCart,
  X,
  Star,
  User,
  Clock,
  Package,
  ChevronDown,
  Trash2,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Header } from '../components/Header';
import { Modal } from '../components/Modal';
import { Tabs } from '../components/ui/Tabs';
import { Pagination } from '../components/ui/Pagination';
import { Badge } from '../components/ui/Badge';
import { SkeletonList, SkeletonTable, SkeletonStats } from '../components/ui/Skeleton';
import { useAuthStore } from '../hooks/useAuthStore';
import {
  getLotsApi,
  createDealApi,
  getCartApi,
  addToCartApi,
  removeFromCartApi,
  clearCartApi,
  getMyDealsApi,
  acceptDealApi,
  completeDealApi,
  cancelDealApi,
} from '../api/marketplace';
import type {
  Lot,
  LotCategory,
  LotFilters,
  Cart,
  CartItem,
  Deal,
  DealStatus,
  PaginatedResponse,
} from '../types/marketplace';

const CATEGORIES: { value: LotCategory | ''; label: string }[] = [
  { value: '', label: 'Все категории' },
  { value: 'currency', label: 'Валюта' },
  { value: 'items', label: 'Предметы' },
  { value: 'accounts', label: 'Аккаунты' },
  { value: 'services', label: 'Услуги' },
  { value: 'cards', label: 'Карты/Ключи' },
  { value: 'other', label: 'Прочее' },
];

const DEAL_STATUS_LABELS: Record<DealStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { label: 'Ожидает', variant: 'warning' },
  accepted: { label: 'Принято', variant: 'info' },
  paid: { label: 'Оплачено', variant: 'info' },
  completed: { label: 'Завершено', variant: 'success' },
  cancelled: { label: 'Отменено', variant: 'danger' },
  disputed: { label: 'Спор', variant: 'danger' },
};

export function MarketplacePage() {
  const { user, isAuthenticated } = useAuthStore();

  // State
  const [lots, setLots] = useState<Lot[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [loadingCart, setLoadingCart] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLots, setTotalLots] = useState(0);

  // Filters
  const [filters, setFilters] = useState<LotFilters>({
    category: undefined,
    search: '',
    sort_by: 'created_at',
    sort_order: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [createLotModalOpen, setCreateLotModalOpen] = useState(false);
  const [lotDetailModal, setLotDetailModal] = useState<Lot | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Tabs
  const [activeTab, setActiveTab] = useState('browse');

  // Create lot form
  const [newLot, setNewLot] = useState({
    title: '',
    description: '',
    category: 'items' as LotCategory,
    price: 0,
    quantity: 1,
    unit: '',
  });
  const [creatingLot, setCreatingLot] = useState(false);

  // Load lots
  useEffect(() => {
    loadLots();
  }, [page, filters]);

  // Load cart and deals when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadCart();
      loadDeals();
    }
  }, [isAuthenticated]);

  const loadLots = async () => {
    setLoading(true);
    try {
      const response = await getLotsApi(filters, page, 20);
      setLots(response.items);
      setTotalPages(response.total_pages);
      setTotalLots(response.total);
    } catch (error) {
      console.error('Failed to load lots:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCart = async () => {
    setLoadingCart(true);
    try {
      const cartData = await getCartApi();
      setCart(cartData);
    } catch (error) {
      console.warn('Failed to load cart:', error);
      // Cart endpoint might not exist yet - use empty cart
      setCart({ items: [], total: 0 });
    } finally {
      setLoadingCart(false);
    }
  };

  const loadDeals = async () => {
    setLoadingDeals(true);
    try {
      const response = await getMyDealsApi({}, 1, 20);
      setDeals(response.items);
    } catch (error) {
      console.warn('Failed to load deals:', error);
      // Deals endpoint might not exist yet - use empty array
      setDeals([]);
    } finally {
      setLoadingDeals(false);
    }
  };

  const handleAddToCart = async (lot: Lot) => {
    try {
      await addToCartApi(lot.id, quantity);
      await loadCart();
      setLotDetailModal(null);
      setQuantity(1);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  };

  const handleRemoveFromCart = async (lotId: string) => {
    try {
      await removeFromCartApi(lotId);
      await loadCart();
    } catch (error) {
      console.error('Failed to remove from cart:', error);
    }
  };

  const handleClearCart = async () => {
    try {
      await clearCartApi();
      await loadCart();
    } catch (error) {
      console.error('Failed to clear cart:', error);
    }
  };

  const handleBuyNow = async (lot: Lot) => {
    try {
      await createDealApi(lot.id, quantity);
      await loadDeals();
      setLotDetailModal(null);
      setQuantity(1);
      setActiveTab('deals');
    } catch (error) {
      console.error('Failed to create deal:', error);
    }
  };

  const handleAcceptDeal = async (dealId: string) => {
    try {
      await acceptDealApi(dealId);
      await loadDeals();
    } catch (error) {
      console.error('Failed to accept deal:', error);
    }
  };

  const handleCompleteDeal = async (dealId: string) => {
    try {
      await completeDealApi(dealId);
      await loadDeals();
    } catch (error) {
      console.error('Failed to complete deal:', error);
    }
  };

  const handleCancelDeal = async (dealId: string) => {
    try {
      await cancelDealApi(dealId);
      await loadDeals();
    } catch (error) {
      console.error('Failed to cancel deal:', error);
    }
  };

  const cartTotal = cart?.items.reduce((sum, item) => sum + item.lot.price * item.quantity, 0) || 0;

  const tabs = [
    { id: 'browse', label: 'Лоты', icon: <Package size={16} /> },
    { id: 'deals', label: 'Мои сделки', icon: <MessageSquare size={16} />, badge: (deals || []).filter(d => d.status === 'pending' || d.status === 'accepted').length },
    ...(isAuthenticated ? [{ id: 'create', label: 'Создать лот', icon: <Plus size={16} /> }] : []),
  ];

  return (
    <div className="min-h-screen bg-cyber-black">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-display font-bold text-white">
              Торговая <span className="text-neon-cyan">площадка</span>
            </h1>
            <p className="text-cyber-muted mt-1">
              {totalLots} лотов доступно
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted" />
              <input
                type="text"
                placeholder="Поиск лотов..."
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10 pr-4 py-2.5 w-64 rounded-xl bg-cyber-card border border-cyber-border/50 text-white placeholder-cyber-muted/50 focus:outline-none focus:border-neon-cyan/50 transition-colors"
              />
            </div>

            {/* Filters toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-xl border transition-all ${
                showFilters
                  ? 'bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan'
                  : 'bg-cyber-card border-cyber-border/50 text-cyber-muted hover:text-white'
              }`}
            >
              <Filter size={18} />
            </button>

            {/* Cart button */}
            {isAuthenticated && (
              <button
                onClick={() => setCartModalOpen(true)}
                className="relative p-2.5 rounded-xl bg-cyber-card border border-cyber-border/50 text-cyber-muted hover:text-white transition-all"
              >
                <ShoppingCart size={18} />
                {cart && cart.items.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-neon-cyan text-cyber-black text-xs font-bold flex items-center justify-center">
                    {cart.items.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </motion.div>

        {/* Filters panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-cyber-card/50 border border-cyber-border/30 rounded-2xl"
          >
            <div className="flex flex-wrap gap-4">
              <select
                value={filters.category || ''}
                onChange={(e) => setFilters({ ...filters, category: e.target.value as LotCategory | '' || undefined })}
                className="px-4 py-2 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>

              <select
                value={filters.sort_by || 'created_at'}
                onChange={(e) => setFilters({ ...filters, sort_by: e.target.value as LotFilters['sort_by'] })}
                className="px-4 py-2 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50"
              >
                <option value="created_at">По дате</option>
                <option value="price">По цене</option>
              </select>

              <select
                value={filters.sort_order || 'desc'}
                onChange={(e) => setFilters({ ...filters, sort_order: e.target.value as 'asc' | 'desc' })}
                className="px-4 py-2 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50"
              >
                <option value="desc">По убыванию</option>
                <option value="asc">По возрастанию</option>
              </select>

              <button
                onClick={() => {
                  setFilters({ category: undefined, search: '', sort_by: 'created_at', sort_order: 'desc' });
                  setPage(1);
                }}
                className="px-4 py-2 rounded-lg bg-cyber-darker border border-cyber-border/50 text-cyber-muted hover:text-white transition-colors"
              >
                Сбросить
              </button>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(id) => {
            setActiveTab(id);
            if (id === 'create') setCreateLotModalOpen(true);
          }}
        />

        {/* Content */}
        {activeTab === 'browse' && (
          <>
            {/* Lots Grid */}
            {loading ? (
              <SkeletonList items={8} />
            ) : lots?.length === 0 ? (
              <div className="text-center py-16">
                <Package size={48} className="mx-auto text-cyber-muted mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Лоты не найдены</h3>
                <p className="text-cyber-muted">Попробуйте изменить параметры поиска</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {lots.map((lot, index) => (
                  <motion.div
                    key={lot.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-cyber-card/50 border border-cyber-border/30 rounded-2xl p-4 hover:border-neon-cyan/30 transition-all cursor-pointer group"
                    onClick={() => setLotDetailModal(lot)}
                  >
                    {/* Image placeholder */}
                    <div className="w-full h-32 rounded-xl bg-cyber-darker/50 mb-4 flex items-center justify-center">
                      <Package size={32} className="text-cyber-muted" />
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-white mb-1 truncate group-hover:text-neon-cyan transition-colors">
                      {lot.title}
                    </h3>

                    {/* Category */}
                    <Badge variant="default" size="sm">
                      {CATEGORIES.find(c => c.value === lot.category)?.label || lot.category}
                    </Badge>

                    {/* Price */}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xl font-bold text-neon-cyan">
                        {lot.price} ₽
                      </span>
                      {lot.quantity > 1 && (
                        <span className="text-sm text-cyber-muted">
                          x{lot.quantity} {lot.unit}
                        </span>
                      )}
                    </div>

                    {/* Seller */}
                    <div className="mt-3 pt-3 border-t border-cyber-border/20 flex items-center gap-2">
                      <User size={14} className="text-cyber-muted" />
                      <span className="text-sm text-cyber-muted truncate">{lot.seller_username}</span>
                      <div className="flex items-center gap-1 ml-auto">
                        <Star size={12} className="text-accent-warning fill-accent-warning" />
                        <span className="text-sm text-cyber-muted">{lot.seller_rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}

        {activeTab === 'deals' && (
          <div>
            {loadingDeals ? (
              <SkeletonTable rows={5} />
            ) : deals.length === 0 ? (
              <div className="text-center py-16">
                <MessageSquare size={48} className="mx-auto text-cyber-muted mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Нет сделок</h3>
                <p className="text-cyber-muted">Купите лот, чтобы начать сделку</p>
              </div>
            ) : (
              <div className="space-y-4">
                {deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="bg-cyber-card/50 border border-cyber-border/30 rounded-2xl p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-cyber-darker/50 flex items-center justify-center">
                        <Package size={24} className="text-cyber-muted" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white">{deal.lot.title}</h3>
                          <Badge variant={DEAL_STATUS_LABELS[deal.status].variant}>
                            {DEAL_STATUS_LABELS[deal.status].label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-cyber-muted">
                          <span>
                            {user?.id === deal.buyer_id ? `Продавец: ${deal.seller_username}` : `Покупатель: ${deal.buyer_username}`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {new Date(deal.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-bold text-neon-cyan">{deal.total_price} ₽</div>
                        <div className="text-sm text-cyber-muted">
                          x{deal.quantity} {deal.lot.unit}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t border-cyber-border/20 flex items-center gap-2 justify-end">
                      {deal.status === 'pending' && user?.id === deal.seller_id && (
                        <button
                          onClick={() => handleAcceptDeal(deal.id)}
                          className="px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30 transition-colors"
                        >
                          Принять
                        </button>
                      )}

                      {deal.status === 'accepted' && user?.id === deal.buyer_id && (
                        <button
                          onClick={() => handleCompleteDeal(deal.id)}
                          className="px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30 transition-colors"
                        >
                          Подтвердить получение
                        </button>
                      )}

                      {(deal.status === 'pending' || deal.status === 'accepted') && (
                        <button
                          onClick={() => handleCancelDeal(deal.id)}
                          className="px-4 py-2 rounded-lg bg-accent-danger/10 text-accent-danger border border-accent-danger/30 hover:bg-accent-danger/20 transition-colors"
                        >
                          Отменить
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart Modal */}
      <Modal
        isOpen={cartModalOpen}
        onClose={() => setCartModalOpen(false)}
        title="Корзина"
      >
        {loadingCart ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-neon-cyan" />
          </div>
        ) : cart && cart.items.length > 0 ? (
          <div className="space-y-4">
            {cart.items.map((item) => (
              <div key={item.lot_id} className="flex items-center gap-4 p-4 bg-cyber-darker/50 rounded-xl">
                <div className="w-12 h-12 rounded-lg bg-cyber-card flex items-center justify-center">
                  <Package size={20} className="text-cyber-muted" />
                </div>

                <div className="flex-1">
                  <h4 className="font-medium text-white">{item.lot.title}</h4>
                  <p className="text-sm text-cyber-muted">
                    {item.quantity} x {item.lot.price} ₽
                  </p>
                </div>

                <div className="text-right">
                  <div className="font-bold text-neon-cyan">
                    {item.lot.price * item.quantity} ₽
                  </div>
                  <button
                    onClick={() => handleRemoveFromCart(item.lot_id)}
                    className="text-accent-danger hover:text-accent-danger/80 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-cyber-border/30 flex items-center justify-between">
              <span className="text-lg font-semibold text-white">Итого:</span>
              <span className="text-2xl font-bold text-neon-cyan">{cartTotal} ₽</span>
            </div>

            <button
              onClick={handleClearCart}
              className="w-full py-3 rounded-xl bg-accent-danger/10 text-accent-danger border border-accent-danger/30 hover:bg-accent-danger/20 transition-colors"
            >
              Очистить корзину
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <ShoppingCart size={48} className="mx-auto text-cyber-muted mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Корзина пуста</h3>
            <p className="text-cyber-muted">Добавьте лоты для покупки</p>
          </div>
        )}
      </Modal>

      {/* Lot Detail Modal */}
      <Modal
        isOpen={!!lotDetailModal}
        onClose={() => {
          setLotDetailModal(null);
          setQuantity(1);
        }}
        title={lotDetailModal?.title || ''}
      >
        {lotDetailModal && (
          <div className="space-y-6">
            {/* Image */}
            <div className="w-full h-48 rounded-xl bg-cyber-darker/50 flex items-center justify-center">
              <Package size={64} className="text-cyber-muted" />
            </div>

            {/* Info */}
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="default">
                  {CATEGORIES.find(c => c.value === lotDetailModal.category)?.label || lotDetailModal.category}
                </Badge>
                <p className="mt-2 text-cyber-muted">{lotDetailModal.description}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-neon-cyan">{lotDetailModal.price} ₽</div>
                {lotDetailModal.quantity > 1 && (
                  <div className="text-sm text-cyber-muted">
                    В наличии: {lotDetailModal.quantity} {lotDetailModal.unit}
                  </div>
                )}
              </div>
            </div>

            {/* Seller */}
            <div className="p-4 bg-cyber-darker/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyber-card flex items-center justify-center">
                  <User size={20} className="text-cyber-muted" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white">{lotDetailModal.seller_username}</div>
                  <div className="flex items-center gap-2 text-sm text-cyber-muted">
                    <Star size={14} className="text-accent-warning fill-accent-warning" />
                    <span>{lotDetailModal.seller_rating.toFixed(1)}</span>
                    <span>({lotDetailModal.seller_reviews_count} отзывов)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quantity */}
            {lotDetailModal.quantity > 1 && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">Количество</label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white hover:border-neon-cyan/50 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={lotDetailModal.quantity}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(lotDetailModal.quantity, parseInt(e.target.value) || 1))}
                    className="w-20 px-4 py-2 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white text-center focus:outline-none focus:border-neon-cyan/50"
                  />
                  <button
                    onClick={() => setQuantity(Math.min(lotDetailModal.quantity, quantity + 1))}
                    className="w-10 h-10 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white hover:border-neon-cyan/50 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => handleAddToCart(lotDetailModal)}
                    className="flex-1 py-3 rounded-xl bg-cyber-card border border-cyber-border/50 text-white hover:border-neon-cyan/50 transition-colors"
                  >
                    В корзину
                  </button>
                  <button
                    onClick={() => handleBuyNow(lotDetailModal)}
                    className="flex-1 py-3 rounded-xl bg-neon-cyan text-cyber-black font-bold hover:bg-neon-cyan/90 transition-colors"
                  >
                    Купить сейчас
                  </button>
                </>
              ) : (
                <p className="flex-1 text-center text-cyber-muted py-3">
                  Войдите для покупки
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create Lot Modal */}
      <Modal
        isOpen={createLotModalOpen}
        onClose={() => setCreateLotModalOpen(false)}
        title="Создать лот"
      >
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Название</label>
            <input
              type="text"
              value={newLot.title}
              onChange={(e) => setNewLot({ ...newLot, title: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white placeholder-cyber-muted/50 focus:outline-none focus:border-neon-cyan/50"
              placeholder="Например: 1000 голды"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Описание</label>
            <textarea
              value={newLot.description}
              onChange={(e) => setNewLot({ ...newLot, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white placeholder-cyber-muted/50 focus:outline-none focus:border-neon-cyan/50 resize-none"
              placeholder="Подробное описание вашего товара..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Категория</label>
            <select
              value={newLot.category}
              onChange={(e) => setNewLot({ ...newLot, category: e.target.value as LotCategory })}
              className="w-full px-4 py-2.5 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50"
            >
              {CATEGORIES.filter(c => c.value).map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Цена (₽)</label>
              <input
                type="number"
                min={1}
                value={newLot.price || ''}
                onChange={(e) => setNewLot({ ...newLot, price: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50"
                placeholder="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Количество</label>
              <input
                type="number"
                min={1}
                value={newLot.quantity || ''}
                onChange={(e) => setNewLot({ ...newLot, quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2.5 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50"
                placeholder="1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Единица измерения (необязательно)</label>
            <input
              type="text"
              value={newLot.unit}
              onChange={(e) => setNewLot({ ...newLot, unit: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white placeholder-cyber-muted/50 focus:outline-none focus:border-neon-cyan/50"
              placeholder="напр. голд, штук"
            />
          </div>

          <button
            type="button"
            onClick={() => setCreateLotModalOpen(false)}
            className="w-full py-3 rounded-xl bg-cyber-card border border-cyber-border/50 text-white hover:border-neon-cyan/50 transition-colors"
          >
            Создать лот
          </button>
        </form>
      </Modal>
    </div>
  );
}
