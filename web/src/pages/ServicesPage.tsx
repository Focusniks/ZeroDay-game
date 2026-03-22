/**
 * Services Page - Платные услуги и подписки
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Star,
  Zap,
  Crown,
  Check,
  X,
  Loader2,
  Wallet,
  Gift,
  Sparkles,
  Shield,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Header } from '../components/Header';
import { Modal } from '../components/Modal';
import { Badge } from '../components/ui/Badge';
import { SkeletonStats } from '../components/ui/Skeleton';
import { useAuthStore } from '../hooks/useAuthStore';
import {
  getSubscriptionPlansApi,
  getMySubscriptionApi,
  subscribeApi,
  cancelSubscriptionApi,
  renewSubscriptionApi,
  getProductsApi,
  purchaseProductApi,
  getWalletBalanceApi,
  depositFundsApi,
} from '../api/marketplace';
import type {
  SubscriptionPlanInfo,
  Subscription,
  SubscriptionPlan,
  Product,
  WalletBalance,
} from '../types/marketplace';

const PLAN_ICONS: Record<SubscriptionPlan, React.ReactNode> = {
  basic: <Star size={24} />,
  premium: <Zap size={24} />,
  vip: <Crown size={24} />,
};

const PLAN_COLORS: Record<SubscriptionPlan, string> = {
  basic: 'from-gray-500/20 to-gray-600/20 border-gray-500/30',
  premium: 'from-neon-cyan/20 to-neon-purple/20 border-neon-cyan/30',
  vip: 'from-accent-warning/20 to-accent-warning/10 border-accent-warning/30',
};

export function ServicesPage() {
  const { user, isAuthenticated } = useAuthStore();

  // State
  const [plans, setPlans] = useState<SubscriptionPlanInfo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Modals
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanInfo | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState(500);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState('subscriptions');

  useEffect(() => {
    loadData();
  }, [isAuthenticated]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansData, productsData, walletData] = await Promise.allSettled([
        getSubscriptionPlansApi(),
        getProductsApi(),
        isAuthenticated ? getWalletBalanceApi() : Promise.resolve({ balance: 0, currency: 'RUB' }),
      ]);

      // Handle plans response
      if (plansData.status === 'fulfilled') {
        setPlans(plansData.value);
      } else {
        console.warn('Failed to load plans:', plansData.reason);
        setPlans([]);
      }

      // Handle products response
      if (productsData.status === 'fulfilled') {
        setProducts(productsData.value);
      } else {
        console.warn('Failed to load products:', productsData.reason);
        setProducts([]);
      }

      // Handle wallet balance response
      if (walletData.status === 'fulfilled') {
        setBalance(walletData.value);
      } else {
        console.warn('Failed to load wallet balance:', walletData.reason);
        setBalance({ balance: 0, currency: 'RUB' });
      }

      if (isAuthenticated) {
        try {
          const sub = await getMySubscriptionApi();
          setSubscription(sub);
        } catch (subError) {
          console.warn('Failed to load subscription:', subError);
          setSubscription(null);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    setProcessing(true);
    try {
      await subscribeApi(selectedPlan.id, selectedPeriod);
      await loadData();
      setSubscribeModalOpen(false);
    } catch (error) {
      console.error('Failed to subscribe:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    setProcessing(true);
    try {
      await cancelSubscriptionApi();
      await loadData();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleRenewSubscription = async () => {
    setProcessing(true);
    try {
      await renewSubscriptionApi();
      await loadData();
    } catch (error) {
      console.error('Failed to renew subscription:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeposit = async () => {
    setProcessing(true);
    try {
      await depositFundsApi(depositAmount);
      await loadData();
      setDepositModalOpen(false);
    } catch (error) {
      console.error('Failed to deposit:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedProduct) return;
    setProcessing(true);
    try {
      await purchaseProductApi(selectedProduct.id);
      await loadData();
      setProductModalOpen(false);
    } catch (error) {
      console.error('Failed to purchase:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getPlanFeatures = (planId: SubscriptionPlan) => {
    switch (planId) {
      case 'basic':
        return [
          'Увеличенный инвентарь на 50%',
          'Приоритет в очереди',
          'Базовая поддержка',
        ];
      case 'premium':
        return [
          'Увеличенный инвентарь на 200%',
          'Приоритет в очереди',
          'Расширенная поддержка',
          'Доступ к эксклюзивным событиям',
          'Кастомные скины',
        ];
      case 'vip':
        return [
          'Безлимитный инвентарь',
          'Мгновенный вход на сервер',
          'VIP поддержка 24/7',
          'Доступ ко всем событиям',
          'Уникальные VIP скины',
          'Уникальный префикс в чате',
          'Monthly VIP награды',
        ];
      default:
        return [];
    }
  };

  return (
    <div className="min-h-screen bg-cyber-black">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-display font-bold text-white">
            Услуги и <span className="text-neon-cyan">подписки</span>
          </h1>
          <p className="text-cyber-muted mt-1">
            Улучши свой опыт с Premium и VIP подписками
          </p>
        </motion.div>

        {/* Balance Card */}
        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 p-6 bg-gradient-to-r from-cyber-card/80 to-cyber-card/40 border border-cyber-border/30 rounded-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-neon-cyan/20 flex items-center justify-center">
                  <Wallet size={24} className="text-neon-cyan" />
                </div>
                <div>
                  <p className="text-sm text-cyber-muted">Баланс кошелька</p>
                  <p className="text-2xl font-bold text-white">
                    {balance?.balance.toLocaleString() || 0} ₽
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDepositModalOpen(true)}
                className="px-6 py-3 rounded-xl bg-neon-cyan text-cyber-black font-bold hover:bg-neon-cyan/90 transition-all"
              >
                Пополнить
              </button>
            </div>
          </motion.div>
        )}

        {/* Active Subscription */}
        {subscription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`mb-8 p-6 bg-gradient-to-r ${PLAN_COLORS[subscription.plan]} border rounded-2xl`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-cyber-card/50 flex items-center justify-center text-white">
                  {PLAN_ICONS[subscription.plan]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold text-white capitalize">
                      {plans.find(p => p.id === subscription.plan)?.name || subscription.plan}
                    </p>
                    <Badge variant={subscription.status === 'active' ? 'success' : 'warning'}>
                      {subscription.status === 'active' ? 'Активна' : 'Неактивна'}
                    </Badge>
                  </div>
                  <p className="text-sm text-cyber-muted">
                    До {new Date(subscription.expires_at).toLocaleDateString('ru-RU')}
                    {subscription.auto_renew && ' • Автопродление'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {subscription.status === 'active' && !subscription.auto_renew && (
                  <button
                    onClick={handleRenewSubscription}
                    disabled={processing}
                    className="px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30 transition-colors disabled:opacity-50"
                  >
                    Продлить
                  </button>
                )}
                <button
                  onClick={handleCancelSubscription}
                  disabled={processing}
                  className="px-4 py-2 rounded-lg bg-accent-danger/10 text-accent-danger border border-accent-danger/30 hover:bg-accent-danger/20 transition-colors disabled:opacity-50"
                >
                  Отменить
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 p-1 bg-cyber-darker/50 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'subscriptions'
                ? 'bg-cyber-card/80 text-neon-cyan border border-neon-cyan/30'
                : 'text-cyber-muted hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Crown size={18} />
              Подписки
            </span>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'products'
                ? 'bg-cyber-card/80 text-neon-cyan border border-neon-cyan/30'
                : 'text-cyber-muted hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Gift size={18} />
              Товары
            </span>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <SkeletonStats />
        ) : (
          <>
            {/* Subscription Plans */}
            {activeTab === 'subscriptions' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan, index) => (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`relative p-6 bg-gradient-to-b ${PLAN_COLORS[plan.id]} border rounded-2xl overflow-hidden`}
                  >
                    {/* Popular badge */}
                    {plan.id === 'premium' && (
                      <div className="absolute top-4 right-4">
                        <Badge variant="warning" className="flex items-center gap-1">
                          <Sparkles size={12} />
                          Популярный
                        </Badge>
                      </div>
                    )}

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-cyber-card/50 flex items-center justify-center text-white">
                        {PLAN_ICONS[plan.id]}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                        <p className="text-sm text-cyber-muted">{plan.description}</p>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-white">
                          {selectedPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly}
                        </span>
                        <span className="text-cyber-muted">₽</span>
                      </div>
                      <p className="text-sm text-cyber-muted">
                        / {selectedPeriod === 'monthly' ? 'месяц' : 'год'}
                      </p>
                    </div>

                    {/* Period toggle */}
                    <div className="flex gap-2 mb-6 p-1 bg-cyber-darker/50 rounded-lg">
                      <button
                        onClick={() => setSelectedPeriod('monthly')}
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                          selectedPeriod === 'monthly'
                            ? 'bg-cyber-card text-white'
                            : 'text-cyber-muted hover:text-white'
                        }`}
                      >
                        Месяц
                      </button>
                      <button
                        onClick={() => setSelectedPeriod('yearly')}
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                          selectedPeriod === 'yearly'
                            ? 'bg-cyber-card text-white'
                            : 'text-cyber-muted hover:text-white'
                        }`}
                      >
                        Год
                        <span className="block text-xs text-neon-cyan">-20%</span>
                      </button>
                    </div>

                    {/* Features */}
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check size={16} className="text-neon-cyan mt-0.5 flex-shrink-0" />
                          <span className="text-cyber-muted">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Button */}
                    <button
                      onClick={() => {
                        setSelectedPlan(plan);
                        setSubscribeModalOpen(true);
                      }}
                      disabled={subscription?.plan === plan.id && subscription?.status === 'active'}
                      className={`w-full py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        plan.id === 'vip'
                          ? 'bg-accent-warning text-cyber-black hover:bg-accent-warning/90'
                          : plan.id === 'premium'
                          ? 'bg-neon-cyan text-cyber-black hover:bg-neon-cyan/90'
                          : 'bg-cyber-card border border-cyber-border text-white hover:border-neon-cyan/50'
                      }`}
                    >
                      {subscription?.plan === plan.id && subscription?.status === 'active'
                        ? 'Активна'
                        : 'Подписаться'}
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Products */}
            {activeTab === 'products' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-cyber-card/50 border border-cyber-border/30 rounded-2xl p-5 hover:border-neon-cyan/30 transition-all"
                  >
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-cyber-darker/50 flex items-center justify-center mb-4">
                      <Gift size={24} className="text-neon-cyan" />
                    </div>

                    {/* Info */}
                    <h3 className="font-semibold text-white mb-1">{product.name}</h3>
                    <p className="text-sm text-cyber-muted mb-4 line-clamp-2">{product.description}</p>

                    {/* Features */}
                    {product.features && product.features.length > 0 && (
                      <ul className="space-y-1 mb-4">
                        {product.features.slice(0, 3).map((f, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-cyber-muted">
                            <Check size={12} className="text-neon-cyan" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Price & Button */}
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-neon-cyan">{product.price} ₽</span>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setProductModalOpen(true);
                        }}
                        disabled={!product.available || !isAuthenticated}
                        className="px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {isAuthenticated ? 'Купить' : 'Войти'}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Subscribe Modal */}
      <Modal
        isOpen={subscribeModalOpen}
        onClose={() => setSubscribeModalOpen(false)}
        title={`Подписка ${selectedPlan?.name}`}
      >
        {selectedPlan && (
          <div className="space-y-6">
            {/* Price */}
            <div className="text-center p-6 bg-cyber-darker/50 rounded-xl">
              <p className="text-sm text-cyber-muted mb-1">
                {selectedPeriod === 'monthly' ? 'Ежемесячная' : 'Ежегодная'} подписка
              </p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-white">
                  {selectedPeriod === 'monthly' ? selectedPlan.price_monthly : selectedPlan.price_yearly}
                </span>
                <span className="text-xl text-cyber-muted">₽</span>
              </div>
              {selectedPeriod === 'yearly' && (
                <p className="text-sm text-neon-cyan mt-1">
                  Экономия {Math.round(selectedPlan.price_monthly * 12 - selectedPlan.price_yearly)} ₽ в год
                </p>
              )}
            </div>

            {/* Features */}
            <div>
              <p className="font-medium text-white mb-3">Что входит в подписку:</p>
              <ul className="space-y-2">
                {selectedPlan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="text-neon-cyan mt-0.5" />
                    <span className="text-cyber-muted">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setSubscribeModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-cyber-card border border-cyber-border/50 text-white hover:border-neon-cyan/50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSubscribe}
                disabled={processing}
                className="flex-1 py-3 rounded-xl bg-neon-cyan text-cyber-black font-bold hover:bg-neon-cyan/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>Оформить подписку</>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Deposit Modal */}
      <Modal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        title="Пополнение баланса"
      >
        <div className="space-y-6">
          {/* Quick amounts */}
          <div>
            <p className="text-sm font-medium text-white mb-3">Быстрое пополнение:</p>
            <div className="grid grid-cols-4 gap-2">
              {[100, 300, 500, 1000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setDepositAmount(amount)}
                  className={`py-3 rounded-lg font-medium transition-colors ${
                    depositAmount === amount
                      ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50'
                      : 'bg-cyber-darker/50 text-cyber-muted hover:text-white border border-transparent'
                  }`}
                >
                  {amount} ₽
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Сумма пополнения</label>
            <input
              type="number"
              min={1}
              value={depositAmount}
              onChange={(e) => setDepositAmount(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full px-4 py-3 rounded-xl bg-cyber-darker border border-cyber-border/50 text-white text-lg text-center focus:outline-none focus:border-neon-cyan/50"
            />
          </div>

          {/* Info */}
          <div className="p-4 bg-cyber-darker/50 rounded-xl text-sm text-cyber-muted">
            <p className="flex items-center gap-2 mb-2">
              <Shield size={16} className="text-neon-cyan" />
              Безопасное пополнение
            </p>
            <p className="flex items-center gap-2">
              <Clock size={16} className="text-neon-cyan" />
              Мгновенное зачисление
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setDepositModalOpen(false)}
              className="flex-1 py-3 rounded-xl bg-cyber-card border border-cyber-border/50 text-white hover:border-neon-cyan/50 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleDeposit}
              disabled={processing || depositAmount < 1}
              className="flex-1 py-3 rounded-xl bg-neon-cyan text-cyber-black font-bold hover:bg-neon-cyan/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>Пополнить на {depositAmount} ₽</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Product Modal */}
      <Modal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title={selectedProduct?.name || ''}
      >
        {selectedProduct && (
          <div className="space-y-6">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto rounded-2xl bg-cyber-darker/50 flex items-center justify-center">
              <Gift size={40} className="text-neon-cyan" />
            </div>

            {/* Description */}
            <p className="text-center text-cyber-muted">{selectedProduct.description}</p>

            {/* Features */}
            {selectedProduct.features && selectedProduct.features.length > 0 && (
              <div className="p-4 bg-cyber-darker/50 rounded-xl">
                <p className="text-sm font-medium text-white mb-3">Что вы получите:</p>
                <ul className="space-y-2">
                  {selectedProduct.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check size={16} className="text-neon-cyan mt-0.5" />
                      <span className="text-cyber-muted">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Price */}
            <div className="text-center">
              <p className="text-sm text-cyber-muted">Цена:</p>
              <p className="text-3xl font-bold text-neon-cyan">{selectedProduct.price} ₽</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setProductModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-cyber-card border border-cyber-border/50 text-white hover:border-neon-cyan/50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handlePurchase}
                disabled={processing || !selectedProduct.available}
                className="flex-1 py-3 rounded-xl bg-neon-cyan text-cyber-black font-bold hover:bg-neon-cyan/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>Купить</>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
