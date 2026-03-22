/**
 * Profile Page - Переработанный профиль пользователя с табами
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Calendar,
  Award,
  TrendingUp,
  Shield,
  CreditCard,
  Package,
  Star,
  Settings,
  Bell,
  Trophy,
  Wallet,
  Loader2,
  Check,
  X,
  Edit2,
  Save,
  ChevronRight,
  TrendingDown,
  Clock,
  Gift,
  Crown,
  Zap,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Tabs } from '../components/ui/Tabs';
import { Pagination } from '../components/ui/Pagination';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/Modal';
import { SkeletonStats, SkeletonList } from '../components/ui/Skeleton';
import { useAuthStore } from '../hooks/useAuthStore';
import {
  getMyDealsApi,
  getWalletBalanceApi,
  getWalletTransactionsApi,
  depositFundsApi,
} from '../api/marketplace';
import type {
  Deal,
  DealStatus,
  WalletTransaction,
  WalletBalance,
  PaginatedResponse,
} from '../types/marketplace';
import { formatDate } from '../utils/format';

const DEAL_STATUS_LABELS: Record<DealStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { label: 'Ожидает', variant: 'warning' },
  accepted: { label: 'Принято', variant: 'info' },
  paid: { label: 'Оплачено', variant: 'info' },
  completed: { label: 'Завершено', variant: 'success' },
  cancelled: { label: 'Отменено', variant: 'danger' },
  disputed: { label: 'Спор', variant: 'danger' },
};

// Mock achievements data
const ACHIEVEMENTS = [
  { id: '1', name: 'Первый шаг', description: 'Зарегистрировался в игре', icon: '🎯', progress: 100, unlocked: true, category: 'progression' },
  { id: '2', name: 'Хакер', description: 'Взломай свой первый сервер', icon: '💻', progress: 75, unlocked: false, category: 'progression' },
  { id: '3', name: 'Коллекционер', description: 'Собери 10 предметов', icon: '📦', progress: 60, unlocked: false, category: 'collection' },
  { id: '4', name: 'Торговец', description: 'Продай что-либо на маркетплейсе', icon: '🛒', progress: 100, unlocked: true, category: 'marketplace' },
  { id: '5', name: 'VIP', description: 'Приобрети VIP подписку', icon: '👑', progress: 0, unlocked: false, category: 'subscription' },
  { id: '6', name: 'Богач', description: 'Накопи 10000 игровой валюты', icon: '💰', progress: 45, unlocked: false, category: 'economy' },
];

// Mock subscriptions data
const MOCK_SUBSCRIPTION = {
  id: 'sub_1',
  plan: 'premium' as const,
  status: 'active' as const,
  started_at: '2024-01-15',
  expires_at: '2025-02-15',
  auto_renew: true,
  price: 299,
  period: 'monthly' as const,
};

export function ProfilePage() {
  const { user, isAuthenticated, loading, init } = useAuthStore();

  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [dealsPage, setDealsPage] = useState(1);
  const [dealsTotalPages, setDealsTotalPages] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [loadingData, setLoadingData] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Edit profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  const [editedEmail, setEditedEmail] = useState('');

  // Notifications settings (mock)
  const [notifications, setNotifications] = useState({
    email_deals: true,
    email_news: false,
    push_deals: true,
    push_news: true,
  });

  // Modals
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState(500);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadProfileData();
      setEditedUsername(user.username || '');
      setEditedEmail(user.email || '');
    }
  }, [isAuthenticated, user]);

  const loadProfileData = async () => {
    setLoadingData(true);
    try {
      const [dealsRes, walletRes, txRes] = await Promise.allSettled([
        getMyDealsApi({}, 1, 10),
        getWalletBalanceApi(),
        getWalletTransactionsApi(1, 10),
      ]);

      // Handle deals response
      if (dealsRes.status === 'fulfilled') {
        setDeals(dealsRes.value.items);
        setDealsTotalPages(dealsRes.value.total_pages);
      } else {
        console.warn('Failed to load deals:', dealsRes.reason);
        setDeals([]);
        setDealsTotalPages(1);
      }

      // Handle wallet balance response
      if (walletRes.status === 'fulfilled') {
        setBalance(walletRes.value);
      } else {
        console.warn('Failed to load wallet balance:', walletRes.reason);
        setBalance({ balance: 0, currency: 'RUB' });
      }

      // Handle transactions response
      if (txRes.status === 'fulfilled') {
        setTransactions(txRes.value.items);
        setTxTotalPages(txRes.value.total_pages);
      } else {
        console.warn('Failed to load transactions:', txRes.reason);
        setTransactions([]);
        setTxTotalPages(1);
      }
    } catch (error) {
      console.error('Failed to load profile data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSaveProfile = async () => {
    setProcessing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setEditingProfile(false);
    setProcessing(false);
  };

  const handleDeposit = async () => {
    setProcessing(true);
    try {
      await depositFundsApi(depositAmount);
      await loadProfileData();
      setDepositModalOpen(false);
    } catch (error) {
      console.warn('Failed to deposit:', error);
      // Wallet deposit endpoint might not exist yet
      alert('Пополнение временно недоступно. Функционал кошелька находится в разработке.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-neon-cyan" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const tabs = [
    { id: 'overview', label: 'Обзор', icon: <User size={16} /> },
    { id: 'purchases', label: 'Покупки', icon: <Package size={16} /> },
    { id: 'subscriptions', label: 'Подписки', icon: <Crown size={16} /> },
    { id: 'settings', label: 'Настройки', icon: <Settings size={16} /> },
    { id: 'achievements', label: 'Достижения', icon: <Trophy size={16} /> },
    { id: 'wallet', label: 'Кошелёк', icon: <Wallet size={16} />, badge: balance ? Math.floor(balance.balance) : 0 },
  ];

  return (
    <div className="min-h-screen bg-cyber-black">
      <Header />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-2xl overflow-hidden mb-8"
        >
          <div className="h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />

          <div className="p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border-2 border-neon-cyan/30 flex items-center justify-center text-neon-cyan text-3xl font-bold">
                {user.username?.[0]?.toUpperCase() || 'U'}
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-3xl font-display font-bold text-white mb-2">
                  {user.username || 'Пользователь'}
                </h1>
                <div className="flex flex-col sm:flex-row items-center gap-4 text-cyber-muted">
                  <div className="flex items-center gap-2">
                    <Mail size={16} />
                    <span>{user.email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    <span>С нами с {formatDate(user.created_at || new Date().toISOString())}</span>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex gap-4">
                <div className="text-center px-4">
                  <div className="text-2xl font-bold text-neon-cyan">{user.level ?? 1}</div>
                  <div className="text-xs text-cyber-muted">Уровень</div>
                </div>
                <div className="text-center px-4 border-l border-cyber-border/30">
                  <div className="text-2xl font-bold text-white">{(user.xp ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-cyber-muted">Опыт</div>
                </div>
                <div className="text-center px-4 border-l border-cyber-border/30">
                  <div className="text-2xl font-bold text-white">{(user.reputation ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-cyber-muted">Репутация</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-cyber-card/50 border border-cyber-border/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-neon-cyan/20 flex items-center justify-center">
                        <Award size={20} className="text-neon-cyan" />
                      </div>
                      <span className="text-sm text-cyber-muted">Уровень</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{user.level ?? 1}</div>
                  </div>

                  <div className="bg-cyber-card/50 border border-cyber-border/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-neon-green/20 flex items-center justify-center">
                        <TrendingUp size={20} className="text-neon-green" />
                      </div>
                      <span className="text-sm text-cyber-muted">Опыт</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{(user.xp ?? 0).toLocaleString()}</div>
                  </div>

                  <div className="bg-cyber-card/50 border border-cyber-border/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-accent-warning/20 flex items-center justify-center">
                        <Shield size={20} className="text-accent-warning" />
                      </div>
                      <span className="text-sm text-cyber-muted">Репутация</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{(user.reputation ?? 0).toLocaleString()}</div>
                  </div>

                  <div className="bg-cyber-card/50 border border-cyber-border/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-neon-purple/20 flex items-center justify-center">
                        <Wallet size={20} className="text-neon-purple" />
                      </div>
                      <span className="text-sm text-cyber-muted">Баланс</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{(balance?.balance ?? 0).toLocaleString()} ₽</div>
                  </div>
                </div>

                {/* Account Info */}
                <div className="bg-cyber-card/50 border border-cyber-border/30 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Информация об аккаунте</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-cyber-darker/50">
                      <span className="text-cyber-muted">IP адрес</span>
                      <span className="font-mono text-white">{user.ip_address || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-cyber-darker/50">
                      <span className="text-cyber-muted">Место на диске</span>
                      <span className="font-mono text-white">{user.disk_capacity_mb ?? 0} MB</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-cyber-darker/50">
                      <span className="text-cyber-muted">Роль</span>
                      <Badge variant="info">{user.role || 'user'}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-cyber-darker/50">
                      <span className="text-cyber-muted">Статус</span>
                      <Badge variant={user.is_banned ? 'danger' : 'success'} dot>
                        {user.is_banned ? 'Заблокирован' : 'Активен'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Purchases Tab */}
            {activeTab === 'purchases' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">История покупок</h3>
                  <Badge variant="default">{deals.length} сделок</Badge>
                </div>

                {loadingData ? (
                  <SkeletonList items={3} />
                ) : deals.length === 0 ? (
                  <div className="text-center py-16 bg-cyber-card/30 rounded-xl">
                    <Package size={48} className="mx-auto text-cyber-muted mb-4" />
                    <h4 className="text-lg font-semibold text-white mb-2">Нет покупок</h4>
                    <p className="text-cyber-muted">Ваши покупки появятся здесь</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {deals.map((deal) => (
                      <div
                        key={deal.id}
                        className="bg-cyber-card/50 border border-cyber-border/30 rounded-xl p-5"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-cyber-darker/50 flex items-center justify-center">
                            <Package size={24} className="text-cyber-muted" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-white">{deal.lot.title}</h4>
                              <Badge variant={DEAL_STATUS_LABELS[deal.status].variant}>
                                {DEAL_STATUS_LABELS[deal.status].label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-cyber-muted">
                              <span>{deal.seller_username}</span>
                              <span className="flex items-center gap-1">
                                <Clock size={14} />
                                {formatDate(deal.created_at)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-neon-cyan">{deal.total_price} ₽</div>
                            <div className="text-sm text-cyber-muted">x{deal.quantity}</div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {dealsTotalPages > 1 && (
                      <div className="mt-6">
                        <Pagination
                          currentPage={dealsPage}
                          totalPages={dealsTotalPages}
                          onPageChange={setDealsPage}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Subscriptions Tab */}
            {activeTab === 'subscriptions' && (
              <div className="space-y-6">
                {/* Current Subscription */}
                <div className="bg-gradient-to-r from-neon-cyan/10 to-neon-purple/10 border border-neon-cyan/30 rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-xl bg-cyber-card/50 flex items-center justify-center">
                      <Zap size={28} className="text-neon-cyan" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-white">Premium</h3>
                        <Badge variant="success" dot>Активна</Badge>
                      </div>
                      <p className="text-sm text-cyber-muted">
                        Действительна до {new Date(MOCK_SUBSCRIPTION.expires_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2 text-cyber-muted">
                      <Clock size={16} />
                      Автопродление включено
                    </div>
                    <div className="flex items-center gap-2 text-cyber-muted">
                      <CreditCard size={16} />
                      299 ₽/месяц
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button className="px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30 transition-colors">
                      Управление
                    </button>
                    <button className="px-4 py-2 rounded-lg bg-accent-danger/10 text-accent-danger border border-accent-danger/30 hover:bg-accent-danger/20 transition-colors">
                      Отменить
                    </button>
                  </div>
                </div>

                {/* Plan Benefits */}
                <div className="bg-cyber-card/50 border border-cyber-border/30 rounded-xl p-6">
                  <h4 className="font-semibold text-white mb-4">Преимущества Premium</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      'Увеличенный инвентарь на 200%',
                      'Приоритет в очереди',
                      'Расширенная поддержка',
                      'Доступ к эксклюзивным событиям',
                      'Кастомные скины',
                      'Ежемесячные бонусы',
                    ].map((benefit, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Check size={16} className="text-neon-cyan flex-shrink-0" />
                        <span className="text-cyber-muted">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Available Plans */}
                <div>
                  <h4 className="font-semibold text-white mb-4">Доступные планы</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { name: 'Basic', price: 99, color: 'gray' },
                      { name: 'Premium', price: 299, color: 'cyan' },
                      { name: 'VIP', price: 599, color: 'warning' },
                    ].map((plan) => (
                      <div
                        key={plan.name}
                        className={`p-5 rounded-xl border ${
                          plan.name === 'Premium'
                            ? 'bg-neon-cyan/10 border-neon-cyan/50'
                            : 'bg-cyber-card/30 border-cyber-border/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-white">{plan.name}</span>
                          {plan.name === 'Premium' && (
                            <Badge variant="info" size="sm">Текущий</Badge>
                          )}
                        </div>
                        <div className="text-2xl font-bold text-white mb-1">
                          {plan.price} ₽
                          <span className="text-sm font-normal text-cyber-muted">/мес</span>
                        </div>
                        <button
                          disabled={plan.name === 'Premium'}
                          className={`w-full mt-4 py-2 rounded-lg font-medium transition-colors ${
                            plan.name === 'Premium'
                              ? 'bg-cyber-darker/50 text-cyber-muted cursor-not-allowed'
                              : 'bg-cyber-card border border-cyber-border text-white hover:border-neon-cyan/50'
                          }`}
                        >
                          {plan.name === 'Premium' ? 'Активен' : 'Подписаться'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                {/* Profile Edit */}
                <div className="bg-cyber-card/50 border border-cyber-border/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">Редактирование профиля</h3>
                    <button
                      onClick={() => editingProfile ? handleSaveProfile() : setEditingProfile(true)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                        editingProfile
                          ? 'bg-neon-cyan text-cyber-black'
                          : 'bg-cyber-card border border-cyber-border text-white hover:border-neon-cyan/50'
                      }`}
                    >
                      {editingProfile ? (
                        <>
                          <Save size={16} />
                          Сохранить
                        </>
                      ) : (
                        <>
                          <Edit2 size={16} />
                          Редактировать
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-cyber-muted mb-2">Имя пользователя</label>
                      <input
                        type="text"
                        value={editedUsername}
                        onChange={(e) => setEditedUsername(e.target.value)}
                        disabled={!editingProfile}
                        className="w-full px-4 py-2.5 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-cyber-muted mb-2">Email</label>
                      <input
                        type="email"
                        value={editedEmail}
                        onChange={(e) => setEditedEmail(e.target.value)}
                        disabled={!editingProfile}
                        className="w-full px-4 py-2.5 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Notifications */}
                <div className="bg-cyber-card/50 border border-cyber-border/30 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Bell size={20} className="text-neon-cyan" />
                    <h3 className="text-lg font-semibold text-white">Уведомления</h3>
                  </div>

                  <div className="space-y-4">
                    {[
                      { key: 'email_deals', label: 'Уведомления о сделках на email', sublabel: 'Получать email при изменении статуса сделки' },
                      { key: 'email_news', label: 'Новости и обновления', sublabel: 'Получать email о новых функциях и событиях' },
                      { key: 'push_deals', label: 'Push-уведомления о сделках', sublabel: 'Мгновенные уведомления в браузере' },
                      { key: 'push_news', label: 'Push-уведомления о новостях', sublabel: 'Уведомления о важных событиях' },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center justify-between p-4 rounded-lg bg-cyber-darker/50 cursor-pointer hover:bg-cyber-darker transition-colors"
                      >
                        <div>
                          <div className="text-white">{item.label}</div>
                          <div className="text-sm text-cyber-muted">{item.sublabel}</div>
                        </div>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={notifications[item.key as keyof typeof notifications]}
                            onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-cyber-border rounded-full peer-checked:bg-neon-cyan transition-colors"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform"></div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Security */}
                <div className="bg-cyber-card/50 border border-cyber-border/30 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-6">Безопасность</h3>
                  <div className="space-y-4">
                    <button className="w-full flex items-center justify-between p-4 rounded-lg bg-cyber-darker/50 hover:bg-cyber-darker transition-colors">
                      <span className="text-white">Изменить пароль</span>
                      <ChevronRight size={18} className="text-cyber-muted" />
                    </button>
                    <button className="w-full flex items-center justify-between p-4 rounded-lg bg-cyber-darker/50 hover:bg-cyber-darker transition-colors">
                      <span className="text-white">Двухфакторная аутентификация</span>
                      <Badge variant="warning" size="sm">Выключено</Badge>
                    </button>
                    <button className="w-full flex items-center justify-between p-4 rounded-lg bg-cyber-darker/50 hover:bg-cyber-darker transition-colors text-accent-danger">
                      <span>Удалить аккаунт</span>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Achievements Tab */}
            {activeTab === 'achievements' && (
              <div className="space-y-6">
                {/* Progress */}
                <div className="bg-cyber-card/50 border border-cyber-border/30 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Trophy size={24} className="text-accent-warning" />
                    <h3 className="text-lg font-semibold text-white">Прогресс достижений</h3>
                  </div>
                  <div className="h-3 bg-cyber-darker rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple rounded-full transition-all"
                      style={{ width: '35%' }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm text-cyber-muted">
                    <span>2 из 6 разблокировано</span>
                    <span>35%</span>
                  </div>
                </div>

                {/* Achievements Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ACHIEVEMENTS.map((achievement) => (
                    <div
                      key={achievement.id}
                      className={`p-5 rounded-xl border transition-all ${
                        achievement.unlocked
                          ? 'bg-gradient-to-br from-accent-warning/10 to-accent-warning/5 border-accent-warning/30'
                          : 'bg-cyber-card/30 border-cyber-border/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                          achievement.unlocked ? 'bg-accent-warning/20' : 'bg-cyber-darker/50'
                        }`}>
                          {achievement.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-white">{achievement.name}</h4>
                            {achievement.unlocked && (
                              <Badge variant="success" size="sm" dot>Разблокировано</Badge>
                            )}
                          </div>
                          <p className="text-sm text-cyber-muted mt-1">{achievement.description}</p>

                          {/* Progress bar */}
                          {!achievement.unlocked && (
                            <div className="mt-3">
                              <div className="h-2 bg-cyber-darker rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-neon-cyan rounded-full"
                                  style={{ width: `${achievement.progress}%` }}
                                />
                              </div>
                              <div className="text-xs text-cyber-muted mt-1">{achievement.progress}%</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wallet Tab */}
            {activeTab === 'wallet' && (
              <div className="space-y-6">
                {/* Balance Card */}
                <div className="bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-cyber-card/50 flex items-center justify-center">
                        <Wallet size={28} className="text-neon-cyan" />
                      </div>
                      <div>
                        <p className="text-sm text-cyber-muted">Баланс кошелька</p>
                        <p className="text-3xl font-bold text-white">
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
                </div>

                {/* Transaction History */}
                <div className="bg-cyber-card/50 border border-cyber-border/30 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">История транзакций</h3>

                  {loadingData ? (
                    <SkeletonList items={5} />
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-12">
                      <CreditCard size={48} className="mx-auto text-cyber-muted mb-4" />
                      <p className="text-cyber-muted">Нет транзакций</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center gap-4 p-4 rounded-lg bg-cyber-darker/50"
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            tx.amount > 0
                              ? 'bg-neon-green/20 text-neon-green'
                              : 'bg-accent-danger/20 text-accent-danger'
                          }`}>
                            {tx.amount > 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                          </div>
                          <div className="flex-1">
                            <div className="text-white">{tx.description}</div>
                            <div className="text-sm text-cyber-muted">
                              {new Date(tx.created_at).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                          <div className={`font-bold ${tx.amount > 0 ? 'text-neon-green' : 'text-accent-danger'}`}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount} ₽
                          </div>
                        </div>
                      ))}

                      {txTotalPages > 1 && (
                        <div className="mt-4">
                          <Pagination
                            currentPage={txPage}
                            totalPages={txTotalPages}
                            onPageChange={setTxPage}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Deposit Modal */}
      <Modal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        title="Пополнение баланса"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-2">
            {[100, 300, 500, 1000].map((amount) => (
              <button
                key={amount}
                onClick={() => setDepositAmount(amount)}
                className={`py-3 rounded-lg font-medium transition-colors ${
                  depositAmount === amount
                    ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50'
                    : 'bg-cyber-darker/50 text-cyber-muted hover:text-white'
                }`}
              >
                {amount} ₽
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Сумма</label>
            <input
              type="number"
              min={1}
              value={depositAmount}
              onChange={(e) => setDepositAmount(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full px-4 py-3 rounded-xl bg-cyber-darker border border-cyber-border/50 text-white text-lg text-center focus:outline-none focus:border-neon-cyan/50"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setDepositModalOpen(false)}
              className="flex-1 py-3 rounded-xl bg-cyber-card border border-cyber-border/50 text-white"
            >
              Отмена
            </button>
            <button
              onClick={handleDeposit}
              disabled={processing}
              className="flex-1 py-3 rounded-xl bg-neon-cyan text-cyber-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processing ? <Loader2 size={18} className="animate-spin" /> : `Пополнить ${depositAmount} ₽`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
