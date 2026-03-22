/**
 * Подвал сайта
 */
import { Link } from 'react-router-dom';
import { Github, MessageCircle, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="relative border-t border-cyber-border/30 bg-cyber-black">
      {/* Градиентная линия сверху */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Логотип и описание */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 flex items-center justify-center font-mono font-bold text-neon-cyan text-xs">
                0D
              </div>
              <span className="font-display font-bold text-lg text-white">
                Zero<span className="text-neon-cyan">Day</span>
              </span>
            </div>
            <p className="text-sm text-cyber-muted leading-relaxed">
              Многопользовательский хакерский симулятор нового поколения.
              Исследуй виртуальные сети, взламывай системы и стань лучшим.
            </p>
          </div>

          {/* Навигация */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Навигация
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-sm text-cyber-muted hover:text-neon-cyan transition-colors">
                  Главная
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-sm text-cyber-muted hover:text-neon-cyan transition-colors">
                  Войти
                </Link>
              </li>
              <li>
                <a href="#features" className="text-sm text-cyber-muted hover:text-neon-cyan transition-colors">
                  Возможности
                </a>
              </li>
              <li>
                <a href="#beta" className="text-sm text-cyber-muted hover:text-neon-cyan transition-colors">
                  Бета-тест
                </a>
              </li>
            </ul>
          </div>

          {/* Соцсети */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Сообщество
            </h3>
            <div className="flex gap-3">
              <a
                href="https://discord.gg/zeroday"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-white/5 border border-cyber-border/50 flex items-center justify-center text-cyber-muted hover:text-neon-cyan hover:border-neon-cyan/30 hover:bg-neon-cyan/5 transition-all"
              >
                <MessageCircle size={18} />
              </a>
              <a
                href="https://twitter.com/zerodaygame"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-white/5 border border-cyber-border/50 flex items-center justify-center text-cyber-muted hover:text-neon-cyan hover:border-neon-cyan/30 hover:bg-neon-cyan/5 transition-all"
              >
                <Twitter size={18} />
              </a>
              <a
                href="https://github.com/zeroday-game"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-white/5 border border-cyber-border/50 flex items-center justify-center text-cyber-muted hover:text-neon-cyan hover:border-neon-cyan/30 hover:bg-neon-cyan/5 transition-all"
              >
                <Github size={18} />
              </a>
            </div>
          </div>
        </div>

        {/* Копирайт */}
        <div className="mt-10 pt-6 border-t border-cyber-border/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-cyber-muted">
            © {new Date().getFullYear()} Zero Day: Exploit Network. Все права защищены.
          </p>
          <p className="text-xs text-cyber-muted/50 font-mono">
            v0.1.0-beta
          </p>
        </div>
      </div>
    </footer>
  );
}
