/**
 * Страница профиля пользователя
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Shield,
  Clock,
  TrendingUp,
  Award,
  HardDrive,
  Wifi,
  Activity,
  Edit,
  Key,
  ChevronRight,
  Zap,
  Star,
  Crown,
  Target,
  BarChart3,
  PieChart,
  ArrowUpRight,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell } from 'recharts';
import { useAuthStore } from '../hooks/useAuthStore';
import { Header } from '../components/Header';
import { Modal } from '../components/Modal';
import { formatDate, formatNumber } from '../utils/format';
import { changePasswordApi } from '../api/auth';

const LEVEL_COLORS = ['#00D9FF', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
const STAT_COLORS = ['#00D9FF', '#8B5CF6', '#10B981', '#F59E0B'];

export function ProfilePage() {
  const { user, isAuthenticated, loading: authLoading, refreshUser, init } = useAuthStore();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'achievements' | 'activity'>('stats');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshUser();
    }
  }, [isAuthenticated, refreshUser]);

  if (authLoading || !user) {
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

  // Расчёт опыта для следующего уровня
  const xpForNextLevel = (user.level + 1) * 1000;
  const xpProgress = (user.xp / xpForNextLevel) * 100;

  // Данные для графиков
  const xpHistoryData = [
    { label: 'Начало', value: 0 },
    { label: 'Сейчас', value: user.xp },
    { label: 'Цель', value: xpForNextLevel },
  ];

  const statsDistributionData = [
    { name: 'XP', value: user.xp, color: '#00D9FF' },
    { name: 'Репутация', value: user.reputation, color: '#8B5CF6' },
    { name: 'Уровень', value: user.level * 100, color: '#10B981' },
  ];

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      admin: { label: 'Администратор', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
      beta_tester: { label: 'Бета-тестер', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
      moderator: { label: 'Модератор', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
      user: { label: 'Пользователь', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    };
    return badges[role] || badges.user;
  };

  const roleBadge = getRoleBadge(user.role);

  return (
    <div className="min-h-screen bg-cyber-black">
      <Header />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Профиль карточка */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-cyber-card/80 to-cyber-card/40 backdrop-blur-xl border border-cyber-border/30 rounded-3xl overflow-hidden mb-8"
        >
          {/* Header с градиентом */}
          <div className="h-32 bg-gradient-to-r from-neon-cyan/20 via-neon-purple/20 to-neon-cyan/20 relative">
            <div className="absolute inset-0 bg-grid-pattern opacity-20" />
          </div>

          {/* Контент */}
          <div className="px-6 pb-6 -mt-16 relative">
            {/* Аватар */}
            <div className="flex items-end gap-4 mb-6">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-neon-cyan/30 to-neon-purple/30 border-4 border-cyber-card/80 shadow-2xl flex items-center justify-center">
                <span className="text-4xl font-bold text-white">
                  {user?.username?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-display font-bold text-white">{user.username}</h1>
                  <span className={`px-3 py-1 text-sm rounded-lg border ${roleBadge.color}`}>
                    {roleBadge.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-cyber-muted text-sm">
                  <span className="flex items-center gap-1">
                    <Mail size={14} /> {user.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> {user.created_at ? formatDate(user.created_at) : 'Неизвестно'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 transition-all"
                >
                  <Edit size={16} /> Профиль
                </button>
                <button
                  onClick={() => setPasswordModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyber-darker/50 text-cyber-muted border border-cyber-border/30 hover:bg-cyber-darker hover:text-white transition-all"
                >
                  <Key size={16} /> Пароль
                </button>
              </div>
            </div>

            {/* Уровень и XP */}
            <div className="bg-cyber-darker/50 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-cyan/30 to-neon-purple/30 flex items-center justify-center">
                    <Zap size={24} className="text-neon-cyan" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">Уровень {user.level}</div>
                    <div className="text-sm text-cyber-muted">{formatNumber(user.xp)} / {formatNumber(xpForNextLevel)} XP</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-neon-cyan">{Math.round(xpProgress)}%</div>
                  <div className="text-xs text-cyber-muted">до следующего уровня</div>
                </div>
              </div>
              <div className="h-3 bg-cyber-black/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple rounded-full"
                />
              </div>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox icon={Zap} label="Опыт" value={formatNumber(user.xp)} color="cyan" />
              <StatBox icon={Star} label="Репутация" value={formatNumber(user.reputation)} color="purple" />
              <StatBox icon={HardDrive} label="Диск" value={`${user.disk_capacity_mb} MB`} color="green" />
              <StatBox icon={Wifi} label="IP" value={user.ip_address} color="orange" mono />
            </div>
          </div>
        </motion.div>

        {/* Табы */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'stats' as const, label: 'Статистика', icon: BarChart3 },
            { id: 'achievements' as const, label: 'Достижения', icon: Award },
            { id: 'activity' as const, label: 'Активность', icon: Activity },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
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

        {/* Контент табов */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* График XP */}
          <div className="bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-2xl p-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-neon-cyan" />
              Прогресс опыта
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={xpHistoryData}>
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
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Распределение статов */}
          <div className="bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-2xl p-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <PieChart size={20} className="text-neon-purple" />
              Распределение характеристик
            </h3>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={statsDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statsDistributionData.map((entry, index) => (
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
              {statsDistributionData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-cyber-muted">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Достижения */}
        {activeTab === 'achievements' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {[
              { icon: Zap, title: 'Первая победа', desc: 'Завершите первое задание', earned: true },
              { icon: Shield, title: 'Защитник', desc: 'Успешно защититесь от атаки', earned: user.level >= 5 },
              { icon: Star, title: 'Звезда', desc: 'Получите 1000 репутации', earned: user.reputation >= 1000 },
              { icon: Target, title: 'Снайпер', desc: 'Завершите 10 заданий', earned: user.xp >= 10000 },
              { icon: Award, title: 'Ветеран', desc: 'Играйте 30 дней', earned: false },
              { icon: Crown, title: 'Король', desc: 'Станьте #1 в рейтинге', earned: false },
            ].map((achievement, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border transition-all ${
                  achievement.earned
                    ? 'bg-gradient-to-br from-neon-cyan/10 to-neon-purple/10 border-neon-cyan/30'
                    : 'bg-cyber-card/30 border-cyber-border/20 opacity-50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    achievement.earned
                      ? 'bg-neon-cyan/20 text-neon-cyan'
                      : 'bg-cyber-darker text-cyber-muted'
                  }`}>
                    <achievement.icon size={20} />
                  </div>
                  <div>
                    <div className="font-medium text-white">{achievement.title}</div>
                    <div className="text-xs text-cyber-muted">{achievement.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Активность */}
        {activeTab === 'activity' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-2xl p-6"
          >
            <h3 className="text-lg font-medium text-white mb-4">История активности</h3>
            <div className="space-y-4">
              {[
                { action: 'Вход в систему', time: 'Только что', icon: Wifi },
                { action: 'Обновление профиля', time: '2 часа назад', icon: Edit },
                { action: 'Прохождение задания "Первый взлом"', time: '1 день назад', icon: Target },
                { action: 'Получение награды "Бета-тестер"', time: '3 дня назад', icon: Award },
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                    <item.icon size={18} className="text-neon-cyan" />
                  </div>
                  <div className="flex-1">
                    <div className="text-white">{item.action}</div>
                    <div className="text-xs text-cyber-muted">{item.time}</div>
                  </div>
                  <ChevronRight size={16} className="text-cyber-muted" />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Модалки */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Редактировать профиль"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-muted mb-1">Имя пользователя</label>
            <input
              type="text"
              value={user.username}
              disabled
              className="w-full px-3 py-2 rounded-lg bg-cyber-darker border border-cyber-border/50 text-cyber-muted"
            />
          </div>
          <div>
            <label className="block text-sm text-cyber-muted mb-1">Email</label>
            <input
              type="email"
              value={user.email}
              className="w-full px-3 py-2 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50"
            />
          </div>
          <button
            onClick={() => setEditModalOpen(false)}
            className="w-full px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30 transition-all"
          >
            Сохранить
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={passwordModalOpen}
        onClose={() => { setPasswordModalOpen(false); setPasswordError(''); setPasswordSuccess(false); }}
        title="Изменить пароль"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setChangingPassword(true);
            setPasswordError('');
            setPasswordSuccess(false);
            
            const form = e.target as HTMLFormElement;
            const currentPassword = (form.elements.namedItem('currentPassword') as HTMLInputElement).value;
            const newPassword = (form.elements.namedItem('newPassword') as HTMLInputElement).value;
            const confirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value;
            
            if (newPassword !== confirmPassword) {
              setPasswordError('Пароли не совпадают');
              setChangingPassword(false);
              return;
            }
            
            if (newPassword.length < 8) {
              setPasswordError('Новый пароль должен быть не менее 8 символов');
              setChangingPassword(false);
              return;
            }
            
            try {
              await changePasswordApi(currentPassword, newPassword);
              setPasswordSuccess(true);
              form.reset();
            } catch (err) {
              setPasswordError((err as Error).message || 'Ошибка смены пароля');
            } finally {
              setChangingPassword(false);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm text-cyber-muted mb-1">Текущий пароль</label>
            <input
              type="password"
              name="currentPassword"
              required
              className="w-full px-3 py-2 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50"
            />
          </div>
          <div>
            <label className="block text-sm text-cyber-muted mb-1">Новый пароль</label>
            <input
              type="password"
              name="newPassword"
              required
              minLength={8}
              className="w-full px-3 py-2 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50"
            />
          </div>
          <div>
            <label className="block text-sm text-cyber-muted mb-1">Подтвердите пароль</label>
            <input
              type="password"
              name="confirmPassword"
              required
              className="w-full px-3 py-2 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50"
            />
          </div>
          
          {passwordError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {passwordError}
            </div>
          )}
          
          {passwordSuccess && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
              Пароль успешно изменён!
            </div>
          )}
          
          <button
            type="submit"
            disabled={changingPassword}
            className="w-full px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30 transition-all disabled:opacity-50"
          >
            {changingPassword ? 'Сохранение...' : 'Изменить пароль'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color, mono }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: 'cyan' | 'green' | 'purple' | 'orange';
  mono?: boolean;
}) {
  const colorClasses = {
    cyan: 'text-neon-cyan bg-neon-cyan/10',
    green: 'text-green-400 bg-green-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
  };

  return (
    <div className="bg-cyber-card/50 rounded-xl p-4 border border-cyber-border/20">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={16} />
        </div>
        <span className="text-sm text-cyber-muted">{label}</span>
      </div>
      <div className={`text-xl font-bold text-white ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
