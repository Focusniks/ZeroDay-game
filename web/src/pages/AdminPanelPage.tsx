/**
 * Админ-панель - комплексная панель управления
 */
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  TrendingUp,
  TrendingDown,
  Clock,
  Wifi,
  WifiOff,
  AlertTriangle,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  LogOut,
  BarChart3,
  PieChart,
  Activity as ActivityIcon,
  UserCheck,
  UserX,
  Crown,
  Zap,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell } from 'recharts';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAdminStats, useAdminUsers, useAdminLogs, useBetaApplications } from '../hooks/useAdmin';
import { Header } from '../components/Header';
import { formatDate, formatNumber } from '../utils/format';
import { Modal } from '../components/Modal';
import type { UserWithRoles } from '../types';

type Tab = 'dashboard' | 'users' | 'applications' | 'logs';

const ROLES = [
  { value: 'user', label: 'Пользователь', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'beta_tester', label: 'Бета-тестер', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'admin', label: 'Администратор', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { value: 'moderator', label: 'Модератор', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
];

const CHART_COLORS = ['#00D9FF', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

export function AdminPanelPage() {
  const { isAuthenticated, isAdmin, loading: authLoading, init } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const { stats, loading: statsLoading, fetchStats } = useAdminStats();
  const { users, loading: usersLoading, pagination, fetchUsers, updateUser, banUser, changeRole } = useAdminUsers();
  const { logs, loading: logsLoading, fetchLogs } = useAdminLogs();
  const { applications, loading: appsLoading, fetchApplications, updateStatus } = useBetaApplications();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchStats();
      if (activeTab === 'users') fetchUsers();
      if (activeTab === 'logs') fetchLogs();
      if (activeTab === 'applications') fetchApplications();
    }
  }, [isAuthenticated, isAdmin, activeTab]);

  const handleSearch = useCallback(() => {
    fetchUsers({ search: searchQuery });
  }, [searchQuery, fetchUsers]);

  const handleEditUser = async (userId: string, updates: { level?: number; xp?: number; reputation?: number }) => {
    setActionLoading(true);
    try {
      await updateUser(userId, updates);
      setEditModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to update user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBanUser = async (userId: string, banned: boolean) => {
    setActionLoading(true);
    try {
      await banUser(userId, banned);
      setBanModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to ban user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeRole = async (userId: string, role: string) => {
    setActionLoading(true);
    try {
      await changeRole(userId, role);
      setRoleModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to change role:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateApp = async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(true);
    try {
      await updateStatus(id, status);
    } catch (error) {
      console.error('Failed to update application:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const selectedUserData = users.find(u => u.id === selectedUser);

  if (authLoading) {
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
    return null;
  }

  const tabs = [
    { id: 'dashboard' as Tab, label: 'Панель', icon: BarChart3 },
    { id: 'users' as Tab, label: 'Пользователи', icon: Users },
    { id: 'applications' as Tab, label: 'Заявки', icon: FileText },
    { id: 'logs' as Tab, label: 'Логи', icon: ActivityIcon },
  ];

  const getRoleBadge = (role: string) => {
    const roleData = ROLES.find(r => r.value === role);
    return roleData ? (
      <span className={`px-2 py-0.5 text-xs rounded border ${roleData.color}`}>
        {roleData.label}
      </span>
    ) : null;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'ban_user': return <UserX size={14} className="text-red-400" />;
      case 'unban_user': return <UserCheck size={14} className="text-green-400" />;
      case 'change_role': return <Crown size={14} className="text-yellow-400" />;
      case 'update_user': return <Edit size={14} className="text-blue-400" />;
      case 'update_beta_application': return <Zap size={14} className="text-purple-400" />;
      default: return <ActivityIcon size={14} className="text-gray-400" />;
    }
  };

  // Подготовка данных для графиков
  const userGrowthData = stats ? [
    { label: 'Сегодня', value: stats.new_users_today },
    { label: 'Неделя', value: stats.new_users_week },
    { label: 'Месяц', value: stats.new_users_month },
    { label: 'Всего', value: stats.total_users },
  ] : [];

  const statusDistributionData = stats ? [
    { name: 'Новые', value: stats.new_users_today, color: '#00D9FF' },
    { name: 'Онлайн', value: stats.online_users, color: '#10B981' },
    { name: 'Забанены', value: stats.banned_users, color: '#EF4444' },
    { name: 'Админы', value: stats.active_admins, color: '#8B5CF6' },
  ] : [];

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
            <span className="text-sm font-normal text-cyber-muted bg-cyber-card/50 px-3 py-1 rounded-full">
              ZeroDay Control Center
            </span>
          </h1>
          <p className="text-cyber-muted">
            Управление пользователями, контентом и мониторинг системы
          </p>
        </motion.div>

        {/* Табы */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20 text-white border border-neon-cyan/30 shadow-lg shadow-neon-cyan/10'
                  : 'bg-cyber-card/50 text-cyber-muted border border-transparent hover:bg-cyber-card hover:text-white'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard */}
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Статистические карточки */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Всего пользователей"
                  value={stats?.total_users || 0}
                  icon={Users}
                  color="cyan"
                  trend={stats ? `+${stats.new_users_today} сегодня` : undefined}
                />
                <StatCard
                  title="Онлайн сейчас"
                  value={stats?.online_users || 0}
                  icon={Wifi}
                  color="green"
                />
                <StatCard
                  title="Заявки на бета"
                  value={stats?.pending_beta_applications || 0}
                  icon={FileText}
                  color="purple"
                />
                <StatCard
                  title="Активные админы"
                  value={stats?.active_admins || 0}
                  icon={Shield}
                  color="orange"
                />
              </div>

              {/* Графики */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* График роста */}
                <div className="bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-2xl p-6">
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <TrendingUp size={20} className="text-neon-cyan" />
                    Рост пользователей
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={userGrowthData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
                        <YAxis stroke="#9ca3af" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f1419',
                            border: '1px solid #1f2937',
                            borderRadius: '8px',
                            color: '#fff',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#00D9FF"
                          strokeWidth={3}
                          dot={{ fill: '#00D9FF', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#00D9FF' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Распределение */}
                <div className="bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-2xl p-6">
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <PieChart size={20} className="text-neon-purple" />
                    Статус пользователей
                  </h3>
                  <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={statusDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {statusDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f1419',
                            border: '1px solid #1f2937',
                            borderRadius: '8px',
                            color: '#fff',
                          }}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-4">
                    {statusDistributionData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-cyber-muted">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Последние действия */}
              <div className="bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-2xl p-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <Clock size={20} className="text-neon-cyan" />
                  Последние действия администраторов
                </h3>
                <button
                  onClick={() => setActiveTab('logs')}
                  className="text-sm text-neon-cyan hover:text-neon-cyan/80 transition-colors"
                >
                  Смотреть все логи →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Пользователи */}
        <AnimatePresence mode="wait">
          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-2xl overflow-hidden"
            >
              {/* Поиск */}
              <div className="p-4 border-b border-cyber-border/20">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Поиск по имени или email..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-cyber-darker border border-cyber-border/50 text-white placeholder-cyber-muted/50 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    className="px-4 py-2.5 rounded-xl bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 transition-all"
                  >
                    Найти
                  </button>
                </div>
              </div>

              {/* Таблица */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-cyber-darker/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-cyber-muted uppercase tracking-wider">Пользователь</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-cyber-muted uppercase tracking-wider">Роль</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-cyber-muted uppercase tracking-wider">Уровень</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-cyber-muted uppercase tracking-wider">IP</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-cyber-muted uppercase tracking-wider">Статус</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-cyber-muted uppercase tracking-wider">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-border/20">
                    {usersLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="inline-block w-8 h-8 border-3 border-neon-cyan/20 border-t-neon-cyan rounded-full"
                          />
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-cyber-muted">
                          Пользователи не найдены
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan font-bold">
                                {u.username[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div className="text-white font-medium">{u.username}</div>
                                <div className="text-xs text-cyber-muted">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {getRoleBadge(u.role)}
                          </td>
                          <td className="px-4 py-3 text-white">Lv.{u.level}</td>
                          <td className="px-4 py-3 text-cyber-muted font-mono text-sm">{u.ip_address}</td>
                          <td className="px-4 py-3">
                            {u.is_banned ? (
                              <span className="flex items-center gap-1 text-red-400 text-sm">
                                <Ban size={14} /> Забанен
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-green-400 text-sm">
                                <Wifi size={14} /> Активен
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => { setSelectedUser(u.id); setEditModalOpen(true); }}
                                className="p-2 rounded-lg text-cyber-muted hover:text-blue-400 hover:bg-blue-400/10 transition-all"
                                title="Редактировать"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => { setSelectedUser(u.id); setRoleModalOpen(true); }}
                                className="p-2 rounded-lg text-cyber-muted hover:text-yellow-400 hover:bg-yellow-400/10 transition-all"
                                title="Изменить роль"
                              >
                                <Crown size={16} />
                              </button>
                              <button
                                onClick={() => { setSelectedUser(u.id); setBanModalOpen(true); }}
                                className="p-2 rounded-lg text-cyber-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                                title={u.is_banned ? 'Разбанить' : 'Забанить'}
                              >
                                {u.is_banned ? <UserCheck size={16} /> : <Ban size={16} />}
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
                  Показано {users.length} из {pagination.total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchUsers({ page: pagination.page - 1 })}
                    disabled={pagination.page <= 1}
                    className="p-2 rounded-lg bg-cyber-darker text-cyber-muted hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-white px-3">Страница {pagination.page} из {pagination.total_pages}</span>
                  <button
                    onClick={() => fetchUsers({ page: pagination.page + 1 })}
                    disabled={pagination.page >= pagination.total_pages}
                    className="p-2 rounded-lg bg-cyber-darker text-cyber-muted hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Заявки */}
        <AnimatePresence mode="wait">
          {activeTab === 'applications' && (
            <motion.div
              key="applications"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-cyber-border/20">
                <h3 className="text-lg font-medium text-white">Заявки на бета-тестирование</h3>
              </div>
              <div className="divide-y divide-cyber-border/20">
                {appsLoading ? (
                  <div className="p-8 text-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-block w-8 h-8 border-3 border-neon-cyan/20 border-t-neon-cyan rounded-full"
                    />
                  </div>
                ) : applications.length === 0 ? (
                  <div className="p-8 text-center text-cyber-muted">Заявок не найдено</div>
                ) : (
                  applications.map((app) => (
                    <div key={app.id} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white font-medium">{app.email}</div>
                          <div className="text-sm text-cyber-muted">Источник: {app.source}</div>
                          <div className="text-xs text-cyber-muted mt-1">
                            {formatDate(app.created_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {app.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleUpdateApp(app.id, 'approved')}
                                disabled={actionLoading}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-all"
                              >
                                <CheckCircle size={14} /> Принять
                              </button>
                              <button
                                onClick={() => handleUpdateApp(app.id, 'rejected')}
                                disabled={actionLoading}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
                              >
                                <XCircle size={14} /> Отклонить
                              </button>
                            </>
                          )}
                          {app.status !== 'pending' && (
                            <span className={`px-3 py-1.5 rounded-lg text-sm ${
                              app.status === 'approved' 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {app.status === 'approved' ? 'Одобрено' : 'Отклонено'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Логи */}
        <AnimatePresence mode="wait">
          {activeTab === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-cyber-border/20">
                <h3 className="text-lg font-medium text-white">Логи администраторов</h3>
              </div>
              <div className="divide-y divide-cyber-border/20 max-h-[500px] overflow-y-auto">
                {logsLoading ? (
                  <div className="p-8 text-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-block w-8 h-8 border-3 border-neon-cyan/20 border-t-neon-cyan rounded-full"
                    />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="p-8 text-center text-cyber-muted">Логов не найдено</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getActionIcon(log.action)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{log.admin_username}</span>
                            <span className="text-cyber-muted">→</span>
                            <span className="text-neon-cyan">{log.action.replace(/_/g, ' ')}</span>
                          </div>
                          {log.target_username && (
                            <div className="text-sm text-cyber-muted mt-1">
                              Цель: <span className="text-white">{log.target_username}</span>
                            </div>
                          )}
                          <div className="text-xs text-cyber-muted/60 mt-1">
                            {formatDate(log.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Модальные окна */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setSelectedUser(null); }}
        title="Редактировать пользователя"
      >
        {selectedUserData && (
          <EditUserForm
            user={selectedUserData}
            onSubmit={(updates) => handleEditUser(selectedUser!, updates)}
            onCancel={() => { setEditModalOpen(false); setSelectedUser(null); }}
            loading={actionLoading}
          />
        )}
      </Modal>

      <Modal
        isOpen={banModalOpen}
        onClose={() => { setBanModalOpen(false); setSelectedUser(null); }}
        title={selectedUserData?.is_banned ? 'Разбанить пользователя' : 'Забанить пользователя'}
      >
        {selectedUserData && (
          <BanUserForm
            user={selectedUserData}
            onSubmit={(banned) => handleBanUser(selectedUser!, banned)}
            onCancel={() => { setBanModalOpen(false); setSelectedUser(null); }}
            loading={actionLoading}
          />
        )}
      </Modal>

      <Modal
        isOpen={roleModalOpen}
        onClose={() => { setRoleModalOpen(false); setSelectedUser(null); }}
        title="Изменить роль пользователя"
      >
        {selectedUserData && (
          <RoleChangeForm
            user={selectedUserData}
            onSubmit={(role) => handleChangeRole(selectedUser!, role)}
            onCancel={() => { setRoleModalOpen(false); setSelectedUser(null); }}
            loading={actionLoading}
          />
        )}
      </Modal>
    </div>
  );
}

// Компоненты форм
function StatCard({ title, value, icon: Icon, color, trend }: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'cyan' | 'green' | 'purple' | 'orange';
  trend?: string;
}) {
  const colorClasses = {
    cyan: 'from-neon-cyan/20 to-cyan-500/10 border-neon-cyan/30 text-neon-cyan',
    green: 'from-green-500/20 to-emerald-500/10 border-green-500/30 text-green-400',
    purple: 'from-purple-500/20 to-violet-500/10 border-purple-500/30 text-purple-400',
    orange: 'from-orange-500/20 to-amber-500/10 border-orange-500/30 text-orange-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-5 border backdrop-blur-xl`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-white/70">{title}</span>
        <Icon size={20} />
      </div>
      <div className="text-3xl font-bold text-white mb-1">{formatNumber(value)}</div>
      {trend && <div className="text-xs text-white/50">{trend}</div>}
    </motion.div>
  );
}

function EditUserForm({ user, onSubmit, onCancel, loading }: {
  user: UserWithRoles;
  onSubmit: (updates: { level?: number; xp?: number; reputation?: number }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [level, setLevel] = useState(user.level);
  const [xp, setXp] = useState(user.xp);
  const [reputation, setReputation] = useState(user.reputation);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-cyber-muted mb-1">Уровень</label>
        <input
          type="number"
          value={level}
          onChange={(e) => setLevel(parseInt(e.target.value) || 0)}
          className="w-full px-3 py-2 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50"
          min="1"
        />
      </div>
      <div>
        <label className="block text-sm text-cyber-muted mb-1">Опыт (XP)</label>
        <input
          type="number"
          value={xp}
          onChange={(e) => setXp(parseInt(e.target.value) || 0)}
          className="w-full px-3 py-2 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50"
          min="0"
        />
      </div>
      <div>
        <label className="block text-sm text-cyber-muted mb-1">Репутация</label>
        <input
          type="number"
          value={reputation}
          onChange={(e) => setReputation(parseInt(e.target.value) || 0)}
          className="w-full px-3 py-2 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50"
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSubmit({ level, xp, reputation })}
          disabled={loading}
          className="flex-1 px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30 transition-all disabled:opacity-50"
        >
          {loading ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-cyber-darker text-cyber-muted hover:text-white transition-all"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function BanUserForm({ user, onSubmit, onCancel, loading }: {
  user: UserWithRoles;
  onSubmit: (banned: boolean) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-white">
        {user.is_banned ? (
          <>Вы уверены, что хотите <span className="text-green-400 font-medium">разбанить</span> пользователя <span className="text-neon-cyan">{user.username}</span>?</>
        ) : (
          <>Вы уверены, что хотите <span className="text-red-400 font-medium">забанить</span> пользователя <span className="text-neon-cyan">{user.username}</span>?</>
        )}
      </p>
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSubmit(!user.is_banned)}
          disabled={loading}
          className={`flex-1 px-4 py-2 rounded-lg border transition-all disabled:opacity-50 ${
            user.is_banned
              ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
              : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
          }`}
        >
          {loading ? 'Выполняется...' : user.is_banned ? 'Разбанить' : 'Забанить'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-cyber-darker text-cyber-muted hover:text-white transition-all"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function RoleChangeForm({ user, onSubmit, onCancel, loading }: {
  user: UserWithRoles;
  onSubmit: (role: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [selectedRole, setSelectedRole] = useState(user.role);

  return (
    <div className="space-y-4">
      <p className="text-white">
        Изменить роль для <span className="text-neon-cyan">{user.username}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.filter(r => r.value !== 'banned').map((role) => (
          <button
            key={role.value}
            onClick={() => setSelectedRole(role.value)}
            className={`px-4 py-2 rounded-lg border text-sm transition-all ${
              selectedRole === role.value
                ? role.color + ' border-current'
                : 'bg-cyber-darker text-cyber-muted border-cyber-border/50 hover:border-cyber-border'
            }`}
          >
            {role.label}
          </button>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSubmit(selectedRole)}
          disabled={loading}
          className="flex-1 px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30 transition-all disabled:opacity-50"
        >
          {loading ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-cyber-darker text-cyber-muted hover:text-white transition-all"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
