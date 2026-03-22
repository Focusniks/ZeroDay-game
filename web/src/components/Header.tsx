/**
 * Шапка сайта с навигацией
 */
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Shield, User, LogOut } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuthStore';
import { cn } from '../utils/cn';

export function Header() {
  const location = useLocation();
  const { isAuthenticated, isAdmin, user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Закрываем мобильное меню при смене роута
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: '/', label: 'Главная' },
    { to: '/marketplace', label: 'Маркетплейс' },
    { to: '/subscription', label: 'Подписка' },
  ];

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-cyber-black/90 backdrop-blur-xl border-b border-cyber-border/50 shadow-lg shadow-black/20'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Логотип */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 flex items-center justify-center font-mono font-bold text-neon-cyan text-sm group-hover:border-neon-cyan/60 transition-colors">
                0D
              </div>
              <div className="absolute inset-0 rounded-lg bg-neon-cyan/10 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="font-display font-bold text-lg text-white hidden sm:block">
              Zero<span className="text-neon-cyan">Day</span>
            </span>
          </Link>

          {/* Навигация (десктоп) */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  location.pathname === link.to
                    ? 'text-neon-cyan bg-neon-cyan/10'
                    : 'text-cyber-muted hover:text-white hover:bg-white/5'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Действия (десктоп) */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-cyber-muted hover:text-white hover:bg-white/5 transition-all"
                >
                  <User size={16} />
                  <span>{user?.username}</span>
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-neon-purple hover:bg-neon-purple/10 transition-all"
                  >
                    <Shield size={14} />
                    <span>Админ</span>
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-cyber-muted hover:text-accent-danger hover:bg-accent-danger/10 transition-all"
                >
                  <LogOut size={14} />
                  <span>Выйти</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 hover:border-neon-cyan/50 transition-all duration-200"
              >
                Войти
              </Link>
            )}
          </div>

          {/* Бургер-меню (мобильное) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-cyber-muted hover:text-white hover:bg-white/5 transition-all"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Мобильное меню */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-cyber-dark/95 backdrop-blur-xl border-b border-cyber-border/50"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'block px-4 py-3 rounded-lg text-sm font-medium transition-all',
                    location.pathname === link.to
                      ? 'text-neon-cyan bg-neon-cyan/10'
                      : 'text-cyber-muted hover:text-white hover:bg-white/5'
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-cyber-border/30">
                {isAuthenticated ? (
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-3 rounded-lg text-sm text-accent-danger hover:bg-accent-danger/10 transition-all"
                  >
                    Выйти
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="block px-4 py-3 rounded-lg text-sm font-semibold text-neon-cyan bg-neon-cyan/10 text-center"
                  >
                    Войти
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
