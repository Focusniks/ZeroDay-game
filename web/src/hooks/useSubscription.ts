/**
 * Хук для управления модульной подпиской
 */
import { useState, useCallback, useEffect } from 'react';
import {
  getSubscriptionModulesApi,
  getMySubscriptionApi,
  createSubscriptionApi,
  addModuleApi,
  removeModuleApi,
  cancelSubscriptionApi,
  renewSubscriptionApi,
} from '../api/subscription';
import type {
  SubscriptionModule,
  UserSubscription,
  UserSubscriptionModule,
  ModuleGroup,
  BillingPeriod,
  SubscriptionModuleCategory,
} from '../types/subscription';

const MODULE_CATEGORIES: Record<string, { name: string; icon: string; description: string }> = {
  cosmetics: {
    name: 'Косметика',
    icon: 'Palette',
    description: 'Персонализация внешнего вида',
  },
  storage: {
    name: 'Хранилище',
    icon: 'HardDrive',
    description: 'Дополнительное место в облаке',
  },
  access: {
    name: 'Доступ',
    icon: 'Lock',
    description: 'Доступ к эксклюзивному контенту',
  },
  features: {
    name: 'Функции',
    icon: 'Zap',
    description: 'Расширенные возможности',
  },
};

export function useSubscription() {
  const [modules, setModules] = useState<SubscriptionModule[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загрузка данных
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [modulesData, subscriptionData] = await Promise.allSettled([
        getSubscriptionModulesApi(),
        getMySubscriptionApi(),
      ]);

      if (modulesData.status === 'fulfilled') {
        setModules(modulesData.value);
      } else {
        console.warn('Failed to load modules:', modulesData.reason);
        setModules([]);
      }

      if (subscriptionData.status === 'fulfilled') {
        setSubscription(subscriptionData.value);
      } else {
        console.warn('Failed to load subscription:', subscriptionData.reason);
        setSubscription(null);
      }
    } catch (err) {
      console.error('Failed to load subscription data:', err);
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Создание подписки
  const createSubscription = useCallback(
    async (billingPeriod: BillingPeriod, moduleIds: string[], autoRenew = true) => {
      setLoading(true);
      try {
        const newSubscription = await createSubscriptionApi({
          billing_period: billingPeriod,
          auto_renew: autoRenew,
          module_ids: moduleIds,
        });
        setSubscription(newSubscription);
        return { success: true };
      } catch (err) {
        console.error('Failed to create subscription:', err);
        return { success: false, error: (err as Error).message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Добавление модуля
  const addModule = useCallback(async (moduleId: string) => {
    setLoading(true);
    try {
      const result = await addModuleApi({ module_id: moduleId });
      // Обновляем подписку после добавления модуля
      await loadData();
      return { success: true, price_change: result.price_change };
    } catch (err) {
      console.error('Failed to add module:', err);
      return { success: false, error: (err as Error).message };
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  // Удаление модуля
  const removeModule = useCallback(async (moduleId: string) => {
    setLoading(true);
    try {
      const result = await removeModuleApi({ module_id: moduleId });
      // Обновляем подписку после удаления модуля
      await loadData();
      return { success: true, price_change: result.price_change };
    } catch (err) {
      console.error('Failed to remove module:', err);
      return { success: false, error: (err as Error).message };
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  // Отмена подписки
  const cancelSubscription = useCallback(async () => {
    setLoading(true);
    try {
      await cancelSubscriptionApi();
      await loadData();
      return { success: true };
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      return { success: false, error: (err as Error).message };
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  // Продление подписки
  const renewSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const updated = await renewSubscriptionApi();
      setSubscription(updated);
      return { success: true };
    } catch (err) {
      console.error('Failed to renew subscription:', err);
      return { success: false, error: (err as Error).message };
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  // Переключение модуля (добавление/удаление)
  const toggleModule = useCallback(
    async (moduleId: string, currentlySelected: boolean) => {
      if (currentlySelected) {
        return removeModule(moduleId);
      } else {
        return addModule(moduleId);
      }
    },
    [addModule, removeModule]
  );

  // Получить модули, сгруппированные по категориям
  const getGroupedModules = useCallback(
    (selectedModules?: UserSubscriptionModule[]): ModuleGroup[] => {
      const groups: ModuleGroup[] = [];

      Object.entries(MODULE_CATEGORIES).forEach(([category, info]) => {
        const categoryModules = modules
          .filter((m) => m.category === category)
          .map((m) => {
            const selected = selectedModules?.find((sm) => sm.id === m.id);
            return {
              ...m,
              selected: !!selected,
              price_monthly: selected?.price_monthly || m.base_price_monthly,
              price_yearly: selected?.price_yearly || m.base_price_yearly,
            };
          });

        if (categoryModules.length > 0) {
          groups.push({
            category: category as SubscriptionModuleCategory,
            name: info.name,
            icon: info.icon,
            description: info.description,
            modules: categoryModules,
          });
        }
      });

      return groups;
    },
    [modules]
  );

  // Рассчитать общую стоимость
  const calculateTotal = useCallback(
    (period: BillingPeriod, selectedModuleIds?: string[]): number => {
      if (subscription && !selectedModuleIds) {
        return period === 'yearly' ? subscription.total_yearly_price : subscription.total_monthly_price;
      }

      const selectedIds = selectedModuleIds || subscription?.modules.map((m) => m.id) || [];
      return selectedIds.reduce((total, moduleId) => {
        const module = modules.find((m) => m.id === moduleId);
        if (module) {
          return total + (period === 'yearly' ? module.base_price_yearly : module.base_price_monthly);
        }
        return total;
      }, 0);
    },
    [subscription, modules]
  );

  return {
    modules,
    subscription,
    loading,
    error,
    loadData,
    createSubscription,
    addModule,
    removeModule,
    cancelSubscription,
    renewSubscription,
    toggleModule,
    getGroupedModules,
    calculateTotal,
  };
}
