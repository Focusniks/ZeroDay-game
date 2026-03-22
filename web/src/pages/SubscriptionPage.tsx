/**
 * Subscription Page - Модульная система подписок
 * Пользователь выбирает только нужные ему модули
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  Loader2,
  Wallet,
  Sparkles,
  HardDrive,
  Lock,
  Zap,
  Palette,
  Shield,
  Clock,
  TrendingUp,
  Plus,
  Minus,
  CreditCard,
} from 'lucide-react';
import { Header } from '../components/Header';
import { Modal } from '../components/Modal';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../hooks/useAuthStore';
import { useSubscription } from '../hooks/useSubscription';
import type { BillingPeriod, SubscriptionModule, UserSubscriptionModule } from '../types/subscription';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  cosmetics: <Palette size={20} />,
  storage: <HardDrive size={20} />,
  access: <Lock size={20} />,
  features: <Zap size={20} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  cosmetics: 'from-pink-500/20 to-purple-500/20 border-pink-500/30 text-pink-400',
  storage: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400',
  access: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400',
  features: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400',
};

export function SubscriptionPage() {
  const { isAuthenticated } = useAuthStore();
  const {
    subscription,
    loading,
    createSubscription,
    toggleModule,
    cancelSubscription,
    renewSubscription,
    getGroupedModules,
    calculateTotal,
  } = useSubscription();

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'create' | 'cancel' | 'renew' | null>(null);

  // Инициализация выбранных модулей из активной подписки
  useState(() => {
    if (subscription?.modules) {
      setSelectedModules(subscription.modules.map((m) => m.id));
    }
  });

  // Сгруппированные модули
  const groupedModules = useMemo(() => {
    return getGroupedModules(subscription?.modules);
  }, [getGroupedModules, subscription?.modules]);

  // Общая стоимость
  const totalCost = useMemo(() => {
    return calculateTotal(billingPeriod, selectedModules);
  }, [calculateTotal, billingPeriod, selectedModules]);

  // Обработка переключения модуля
  const handleToggleModule = async (moduleId: string, currentlySelected: boolean) => {
    if (!isAuthenticated) return;

    if (subscription) {
      // Если есть активная подписка, сразу применяем изменения
      setProcessing(true);
      await toggleModule(moduleId, currentlySelected);
      setProcessing(false);
    } else {
      // Иначе просто меняем выбор для создания подписки
      setSelectedModules((prev) =>
        currentlySelected ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
      );
    }
  };

  // Подтверждение действия
  const handleConfirm = async () => {
    setProcessing(true);

    try {
      if (modalAction === 'create') {
        await createSubscription(billingPeriod, selectedModules);
      } else if (modalAction === 'cancel') {
        await cancelSubscription();
      } else if (modalAction === 'renew') {
        await renewSubscription();
      }
    } finally {
      setProcessing(false);
      setConfirmModalOpen(false);
      setModalAction(null);
    }
  };

  const openConfirmModal = (action: 'create' | 'cancel' | 'renew') => {
    setModalAction(action);
    setConfirmModalOpen(true);
  };

  const getModalTitle = () => {
    switch (modalAction) {
      case 'create':
        return 'Оформление подписки';
      case 'cancel':
        return 'Отмена подписки';
      case 'renew':
        return 'Продление подписки';
      default:
        return '';
    }
  };

  const getModalMessage = () => {
    switch (modalAction) {
      case 'create':
        return `Вы выбрали ${selectedModules.length} модулей. Общая стоимость: ${totalCost} ₽/${billingPeriod === 'monthly' ? 'мес' : 'год'}`;
      case 'cancel':
        return 'Вы уверены, что хотите отменить подписку? Доступ к модулям сохранится до конца оплаченного периода.';
      case 'renew':
        return `Продлить подписку на ${billingPeriod === 'monthly' ? 'месяц' : 'год'} за ${totalCost} ₽?`;
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <Loader2 size={40} className="text-neon-cyan animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-black">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-display font-bold text-white">
            Конструктор <span className="text-neon-cyan">подписки</span>
          </h1>
          <p className="text-cyber-muted mt-1">
            Выбирайте только то, что нужно вам. Платите за конкретные функции.
          </p>
        </motion.div>

        {/* Active Subscription Banner */}
        {subscription && subscription.status === 'active' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-gradient-to-r from-neon-cyan/10 to-purple-500/10 border border-neon-cyan/30 rounded-2xl"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-neon-cyan/20 flex items-center justify-center">
                  <Sparkles size={24} className="text-neon-cyan" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold text-white">Ваша подписка активна</p>
                    <Badge variant="success">Активна</Badge>
                  </div>
                  <p className="text-sm text-cyber-muted">
                    До {new Date(subscription.expires_at!).toLocaleDateString('ru-RU')}
                    {subscription.auto_renew && ' • Автопродление включено'}
                  </p>
                  <p className="text-sm text-neon-cyan font-medium mt-1">
                    {subscription.modules.length} модулей • {totalCost} ₽/{billingPeriod === 'monthly' ? 'мес' : 'год'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!subscription.auto_renew && (
                  <Button
                    variant="outline"
                    onClick={() => openConfirmModal('renew')}
                    disabled={processing}
                  >
                    Продлить
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={() => openConfirmModal('cancel')}
                  disabled={processing}
                >
                  Отменить
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Billing Period Toggle */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex gap-2 p-1 bg-cyber-darker/50 rounded-xl">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-cyber-card text-white border border-neon-cyan/30'
                  : 'text-cyber-muted hover:text-white'
              }`}
            >
              Ежемесячно
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                billingPeriod === 'yearly'
                  ? 'bg-cyber-card text-white border border-neon-cyan/30'
                  : 'text-cyber-muted hover:text-white'
              }`}
            >
              Ежегодно
              <span className="text-xs text-green-400">-17%</span>
            </button>
          </div>

          {selectedModules.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-4 px-6 py-3 bg-cyber-card/50 rounded-xl border border-cyber-border/30"
            >
              <div>
                <p className="text-sm text-cyber-muted">Выбрано модулей</p>
                <p className="text-lg font-bold text-white">{selectedModules.length}</p>
              </div>
              <div className="w-px h-10 bg-cyber-border" />
              <div>
                <p className="text-sm text-cyber-muted">Итого</p>
                <p className="text-lg font-bold text-neon-cyan">{totalCost} ₽</p>
              </div>
              {!subscription && selectedModules.length > 0 && (
                <>
                  <div className="w-px h-10 bg-cyber-border" />
                  <button
                    onClick={() => openConfirmModal('create')}
                    className="px-6 py-2 rounded-lg bg-neon-cyan text-cyber-black font-bold hover:bg-neon-cyan/90 transition-colors"
                  >
                    Оформить
                  </button>
                </>
              )}
            </motion.div>
          )}
        </div>

        {/* Module Groups */}
        <div className="space-y-8">
          {groupedModules.map((group, groupIndex) => (
            <motion.div
              key={group.category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIndex * 0.1 }}
            >
              {/* Group Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${CATEGORY_COLORS[group.category]}`}>
                  {CATEGORY_ICONS[group.category]}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{group.name}</h2>
                  <p className="text-sm text-cyber-muted">{group.description}</p>
                </div>
              </div>

              {/* Modules Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.modules.map((module, moduleIndex) => (
                  <ModuleCard
                    key={module.id}
                    module={module}
                    selected={module.selected}
                    billingPeriod={billingPeriod}
                    disabled={!isAuthenticated && !module.selected}
                    onToggle={() => handleToggleModule(module.id, module.selected)}
                    delay={groupIndex * 0.1 + moduleIndex * 0.05}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {groupedModules.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Sparkles size={48} className="mx-auto text-cyber-muted mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Модули загружаются</h3>
            <p className="text-cyber-muted">Пожалуйста, подождите...</p>
          </motion.div>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setModalAction(null);
        }}
        title={getModalTitle()}
      >
        <div className="space-y-6">
          <p className="text-cyber-muted">{getModalMessage()}</p>

          {modalAction === 'create' && (
            <div className="p-4 bg-cyber-darker/50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cyber-muted">Период</span>
                <span className="text-white font-medium capitalize">
                  {billingPeriod === 'monthly' ? 'Ежемесячно' : 'Ежегодно'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cyber-muted">Модули</span>
                <span className="text-white font-medium">{selectedModules.length} шт.</span>
              </div>
              <div className="border-t border-cyber-border mt-3 pt-3 flex items-center justify-between">
                <span className="text-white font-medium">Итого</span>
                <span className="text-2xl font-bold text-neon-cyan">{totalCost} ₽</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setConfirmModalOpen(false);
                setModalAction(null);
              }}
              disabled={processing}
              className="flex-1 py-3 rounded-xl bg-cyber-card border border-cyber-border/50 text-white hover:border-neon-cyan/50 transition-colors disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirm}
              disabled={processing}
              className={`flex-1 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                modalAction === 'cancel'
                  ? 'bg-accent-danger text-white hover:bg-accent-danger/90'
                  : 'bg-neon-cyan text-cyber-black hover:bg-neon-cyan/90'
              }`}
            >
              {processing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {modalAction === 'create' && 'Оформить подписку'}
                  {modalAction === 'cancel' && 'Подтвердить отмену'}
                  {modalAction === 'renew' && 'Продлить'}
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Компонент карточки модуля
function ModuleCard({
  module,
  selected,
  billingPeriod,
  disabled,
  onToggle,
  delay = 0,
}: {
  module: SubscriptionModule | UserSubscriptionModule;
  selected: boolean;
  billingPeriod: BillingPeriod;
  disabled: boolean;
  onToggle: () => void;
  delay?: number;
}) {
  const isUserModule = 'selected' in module;
  const price = billingPeriod === 'monthly'
    ? (isUserModule ? (module as UserSubscriptionModule).price_monthly : (module as SubscriptionModule).base_price_monthly)
    : (isUserModule ? (module as UserSubscriptionModule).price_yearly : (module as SubscriptionModule).base_price_yearly);
  const originalPrice =
    billingPeriod === 'monthly' ? (module as SubscriptionModule).base_price_monthly : (module as SubscriptionModule).base_price_yearly;
  const hasDiscount = module.discount_percent > 0 && billingPeriod === 'yearly';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`relative p-5 rounded-2xl border transition-all cursor-pointer ${
        selected
          ? 'bg-neon-cyan/10 border-neon-cyan/50 shadow-lg shadow-neon-cyan/10'
          : 'bg-cyber-card/50 border-cyber-border/30 hover:border-cyber-border/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={!disabled ? onToggle : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${CATEGORY_COLORS[module.category]}`}>
          {module.icon ? (
            <span className="text-lg">{module.icon}</span>
          ) : (
            CATEGORY_ICONS[module.category]
          )}
        </div>

        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          selected
            ? 'bg-neon-cyan border-neon-cyan'
            : 'border-cyber-border'
        }`}>
          {selected && <Check size={14} className="text-cyber-black" />}
        </div>
      </div>

      {/* Info */}
      <h3 className="font-bold text-white mb-1">{module.name}</h3>
      <p className="text-sm text-cyber-muted mb-4 line-clamp-2">{module.description}</p>

      {/* Price */}
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-neon-cyan">{price} ₽</span>
        {hasDiscount && originalPrice > price && (
          <span className="text-sm text-cyber-muted line-through">{originalPrice} ₽</span>
        )}
        <span className="text-sm text-cyber-muted">/{billingPeriod === 'monthly' ? 'мес' : 'год'}</span>
      </div>

      {/* Discount Badge */}
      {hasDiscount && (
        <div className="absolute top-3 right-3">
          <Badge variant="success" className="text-xs">
            -{module.discount_percent}%
          </Badge>
        </div>
      )}
    </motion.div>
  );
}
