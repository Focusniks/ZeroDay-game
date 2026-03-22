/**
 * Админ-панель
 */
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  FileText,
  Activity,
  Shield,
  Search,
  Ban,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../hooks/useAuthStore';
import { Header } from '../components/Header';
import { formatDate } from '../utils/format';
import { formatNumber } from '../utils/format';

type Tab = 'users' | 'applications' | 'stats';

export function AdminPanelPage() {
  const { user, isAuthenticated, isAdmin, loading, init } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadData();
    }
  }, [activeTab, isAuthenticated, isAdmin]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      // Заглушка - в реальности здесь будут API-вызовы
      // const usersData = await getAdminUsersApi({});
      // setUsers(usersData.items);
      setUsers([]);
      // const appsData = await getBetaApplicationsApi({});
      // setApplications(appsData.items);
      setApplications([]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-neon-cyan/20 border-t-neon-cyan rounded-full"
        />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  const tabs = [
    { id: 'users' as Tab, label: 'Пользователи', icon: Users },
    { id: 'applications' as Tab, label: 'Заявки', icon: FileText },
    { id: 'stats' as Tab, label: 'Статистика', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-cyber-black">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Заголовок */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-display font-bold text-white mb-2 flex items-center gap-3">
            <Shield size={28} className="text-neon-purple" />
            Панель администратора
          </h1>
          <p className="text-cyber-muted">
            Управление пользователями и контентом
          </p>
        </motion.div>

        {/* Табы */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30'
                  : 'bg-cyber-card/50 text-cyber-muted border border-transparent hover:bg-cyber-card hover:text-white'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Контент */}
        {activeTab === 'users' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-2xl overflow-hidden"
          >
            {/* Поиск */}
            <div className="p-4 border-b border-cyber-border/20">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск пользователей..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white placeholder-cyber-muted/50 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                />
              </div>
            </div>

            {/* Таблица */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-cyber-darker/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-cyber-muted uppercase tracking-wider">
                      Пользователь
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-cyber-muted uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-cyber-muted uppercase tracking-wider">
                      Уровень
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-cyber-muted uppercase tracking-wider">
                      Дата регистрации
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-cyber-muted uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyber-border/20">
                  {loadingData ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="inline-block w-8 h-8 border-3 border-neon-cyan/20 border-t-neon-cyan rounded-full"
                        />
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-cyber-muted">
                        Пользователи не найдены
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan font-bold text-sm">
                              {u.username[0]?.toUpperCase()}
                            </div>
                            <span className="text-white font-medium">{u.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-cyber-muted">{u.email}</td>
                        <td className="px-4 py-3 text-white">{u.level}</td>
                        <td className="px-4 py-3 text-cyber-muted">
                          {formatDate(u.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button className="p-1.5 rounded-lg text-cyber-muted hover:text-accent-danger hover:bg-accent-danger/10 transition-all">
                              <Ban size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Пагинация */}
            <div className="p-4 border-t border-cyber-border/20 flex items-center justify-between">
              <span className="text-sm text-cyber-muted">
                Показано {users.length} из {formatNumber(users.length)} пользователей
              </span>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg bg-cyber-darker text-cyber-muted hover:text-white disabled:opacity-50" disabled>
                  <ChevronLeft size={18} />
                </button>
                <button className="px-3 py-1 rounded-lg bg-neon-cyan/10 text-neon-cyan">1</button>
                <button className="p-2 rounded-lg bg-cyber-darker text-cyber-muted hover:text-white disabled:opacity-50" disabled>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'applications' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-2xl overflow-hidden"
          >
            <div className="p-6">
              {loadingData ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-8 h-8 border-3 border-neon-cyan/20 border-t-neon-cyan rounded-full"
                  />
                </div>
              ) : applications.length === 0 ? (
                <div className="text-center py-12 text-cyber-muted">
                  Заявок на бета-тест пока нет
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-cyber-darker/50 border border-cyber-border/20"
                    >
                      <div>
                        <div className="text-white font-medium">{app.email}</div>
                        <div className="text-sm text-cyber-muted">Источник: {app.source}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 rounded-lg text-accent-success hover:bg-accent-success/10 transition-all">
                          <CheckCircle size={18} />
                        </button>
                        <button className="p-2 rounded-lg text-accent-danger hover:bg-accent-danger/10 transition-all">
                          <XCircle size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {[
              { label: 'Всего пользователей', value: formatNumber(0), icon: Users, color: 'neon-cyan' },
              { label: 'Новых сегодня', value: formatNumber(0), icon: Activity, color: 'neon-green' },
              { label: 'Заявок на бета', value: formatNumber(0), icon: FileText, color: 'neon-purple' },
              { label: 'Онлайн', value: formatNumber(0), icon: Activity, color: 'accent-warning' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-xl p-6"
              >
                <div className={`w-12 h-12 rounded-lg bg-${stat.color}/10 border border-${stat.color}/30 flex items-center justify-center mb-4`}>
                  <stat.icon size={24} className={`text-${stat.color}`} />
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-cyber-muted">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
