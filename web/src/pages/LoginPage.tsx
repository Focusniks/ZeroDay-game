/**
 * Страница авторизации
 * Только вход, без регистрации (регистрация доступна в игре)
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuthStore';
import { Header } from '../components/Header';
import { MatrixRain } from '../components/MatrixRain';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error, clearError } = useAuthStore();
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await login(loginInput, password);
      navigate('/profile');
    } catch {
      // Ошибка уже установлена в store
    }
  };

  return (
    <div className="min-h-screen bg-cyber-black flex flex-col overflow-hidden">
      <Header />
      <MatrixRain />

      {/* Фоновые эффекты */}
      <div className="fixed inset-0 bg-gradient-to-b from-cyber-black via-cyber-dark/30 to-cyber-black" />
      <div className="fixed inset-0 bg-grid-pattern opacity-20" />

      {/* Контент */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md"
        >
          {/* Карточка */}
          <div className="relative bg-cyber-card/50 backdrop-blur-xl border border-cyber-border/30 rounded-2xl overflow-hidden">
            {/* Градиентная линия сверху */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />

            <div className="p-8">
              {/* Заголовок */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-display font-bold text-white mb-2">
                  Вход в <span className="text-neon-cyan">ZeroDay</span>
                </h1>
                <p className="text-sm text-cyber-muted">
                  Регистрация доступна только в самой игре
                </p>
              </div>

              {/* Форма */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Логин */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Логин или Email
                  </label>
                  <input
                    type="text"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white placeholder-cyber-muted/50 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                    placeholder="username или email@example.com"
                  />
                </div>

                {/* Пароль */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Пароль
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-3 pr-12 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white placeholder-cyber-muted/50 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-cyber-muted hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Ошибка */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-accent-danger/10 border border-accent-danger/30 text-accent-danger text-sm"
                  >
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Кнопка */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-neon-cyan text-cyber-black font-bold hover:bg-neon-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-cyber-black/30 border-t-cyber-black rounded-full"
                      />
                      Вход...
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      Войти
                    </>
                  )}
                </button>
              </form>

              {/* Footer */}
              <div className="mt-6 pt-6 border-t border-cyber-border/20 text-center">
                <p className="text-sm text-cyber-muted">
                  Ещё нет аккаунта?{' '}
                  <Link
                    to="/"
                    className="text-neon-cyan hover:underline"
                  >
                    Узнать больше об игре
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Декоративные элементы */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-neon-cyan/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-neon-purple/5 rounded-full blur-3xl pointer-events-none" />
        </motion.div>
      </div>
    </div>
  );
}
