/**
 * Главная промо-страница ZeroDay
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Terminal,
  FolderOpen,
  Globe,
  Code2,
  Palette,
  Languages,
  Users,
  Cpu,
  ChevronDown,
  Mail,
  CheckCircle,
} from 'lucide-react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { MatrixRain } from '../components/MatrixRain';
import { FeatureCard } from '../components/FeatureCard';
import { Modal } from '../components/Modal';
import { BETA_SOURCES } from '../types';
import { submitBetaApplicationApi } from '../api/admin';

export function HomePage() {
  const [betaModalOpen, setBetaModalOpen] = useState(false);
  const [betaForm, setBetaForm] = useState({ email: '', source: '' });
  const [betaSubmitting, setBetaSubmitting] = useState(false);
  const [betaSuccess, setBetaSuccess] = useState(false);
  const [betaError, setBetaError] = useState('');

  const handleBetaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBetaSubmitting(true);
    setBetaError('');

    try {
      await submitBetaApplicationApi(betaForm.email, betaForm.source);
      setBetaSuccess(true);
      setBetaForm({ email: '', source: '' });
    } catch (err: unknown) {
      setBetaError(
        (err as { message?: string })?.message || 'Ошибка отправки заявки'
      );
    } finally {
      setBetaSubmitting(false);
    }
  };

  const features = [
    {
      icon: <Terminal size={24} />,
      title: 'Реалистичный терминал',
      description:
        'Полнофункциональный эмулятор терминала с подсветкой синтаксиса, автодополнением и поддержкой кастомных команд.',
    },
    {
      icon: <FolderOpen size={24} />,
      title: 'Файловая система',
      description:
        'Исследуй виртуальную файловую систему с директориями, файлами и полным управлением — создавай, редактируй, удаляй.',
    },
    {
      icon: <Globe size={24} />,
      title: 'Внутриигровой браузер',
      description:
        'Уникальный браузер ZeroBrowser с симуляцией реальных веб-сайтов: хостинги, ISP, криптобиржи и секретные порталы.',
    },
    {
      icon: <Code2 size={24} />,
      title: 'HackScript',
      description:
        'Пиши собственные скрипты на кастомном языке программирования для автоматизации взлома и создания инструментов.',
    },
    {
      icon: <Palette size={24} />,
      title: 'Кастомизация',
      description:
        'Настраивай рабочий стол: обои, темы, иконки, звуки. Создай уникальную атмосферу киберпанка.',
    },
    {
      icon: <Languages size={24} />,
      title: 'Мультиязычность',
      description:
        'Полная поддержка русского и английского языков. Переключайся в любой момент без потери данных.',
    },
    {
      icon: <Users size={24} />,
      title: 'Онлайн-взаимодействие',
      description:
        'Общайся с другими игроками через встроенный мессенджер, отправляй файлы и создавай группы.',
    },
    {
      icon: <Cpu size={24} />,
      title: 'Система взлома',
      description:
        'Проходи CTF-челленджи, решай головоломки и контракты. Зарабатывай опыт и открывай новые возможности.',
    },
  ];

  return (
    <div className="min-h-screen bg-cyber-black">
      <Header />
      <MatrixRain />

      {/* Hero секция */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Фоновые эффекты */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyber-black via-cyber-dark/50 to-cyber-black" />
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />

        {/* Градиентные круги */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          {/* Логотип */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border-2 border-neon-cyan/40 flex items-center justify-center font-mono font-bold text-neon-cyan text-3xl shadow-lg shadow-neon-cyan/20">
                  0D
                </div>
                <div className="absolute inset-0 rounded-2xl bg-neon-cyan/10 blur-xl" />
              </div>
            </div>
          </motion.div>

          {/* Заголовок */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl sm:text-6xl md:text-7xl font-display font-bold text-white mb-6 leading-tight"
          >
            ZERO<span className="text-neon-cyan">DAY</span>
            <br />
            <span className="text-3xl sm:text-4xl md:text-5xl text-cyber-muted">
              Exploit Network
            </span>
          </motion.h1>

          {/* Слоган */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg sm:text-xl text-cyber-muted max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Многопользовательский хакерский симулятор нового поколения.
            Взламывай виртуальные сети, пиши эксплойты и стань легендой
            киберпространства.
          </motion.p>

          {/* CTA кнопки */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <button
              onClick={() => setBetaModalOpen(true)}
              className="group relative px-8 py-3.5 rounded-xl bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 font-semibold overflow-hidden transition-all duration-300 hover:bg-neon-cyan/20 hover:border-neon-cyan/50 hover:shadow-lg hover:shadow-neon-cyan/20"
            >
              <span className="relative z-10 flex items-center gap-2">
                Записаться на бета-тест
                <ChevronDown
                  size={18}
                  className="group-hover:translate-y-0.5 transition-transform"
                />
              </span>
            </button>
          </motion.div>

          {/* Скролл индикатор */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-6 h-10 rounded-full border-2 border-cyber-border/50 flex items-start justify-center p-2"
            >
              <motion.div className="w-1 h-2 rounded-full bg-neon-cyan/50" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Об игре */}
      <section className="relative py-24 bg-cyber-dark/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-display font-bold text-white mb-4">
              Об <span className="text-neon-cyan">игре</span>
            </h2>
            <p className="text-lg text-cyber-muted max-w-3xl mx-auto">
              Zero Day — это полноценный киберпанк-симулятор, где ты управляешь
              собственным рабочим столом, исследуешь виртуальные сети и
              взаимодействуешь с другими игроками в реальном времени.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="space-y-6 text-cyber-muted">
                <p className="text-lg leading-relaxed">
                  Представь себе операционную систему будущего: терминал с
                  подсветкой синтаксиса, файловый менеджер в стиле Nautilus,
                  браузер с симуляцией реальных веб-сайтов и собственный
                  мессенджер для общения с другими игроками.
                </p>
                <p className="text-lg leading-relaxed">
                  Но главное — это возможность писать собственные скрипты на
                  языке HackScript и автоматизировать процесс взлома. Решай
                  CTF-челленджи, заключай контракты и зарабатывай игровую
                  валюту.
                </p>
                <p className="text-lg leading-relaxed">
                  Каждый сервер — это уникальная сеть с своими уязвимостями,
                  сайтами и историями. Исследуй, взламывай, учись.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              {/* Декоративная рамка */}
              <div className="relative rounded-2xl overflow-hidden border border-cyber-border/30 bg-cyber-card/30 p-8">
                {/* Заголовок "окна" */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-accent-danger/50" />
                    <div className="w-3 h-3 rounded-full bg-accent-warning/50" />
                    <div className="w-3 h-3 rounded-full bg-accent-success/50" />
                  </div>
                  <div className="flex-1 h-6 rounded bg-cyber-darker/50 flex items-center px-3">
                    <span className="text-xs text-cyber-muted font-mono">
                      user@zeroday:~$
                    </span>
                  </div>
                </div>

                {/* Код */}
                <pre className="font-mono text-sm text-neon-green space-y-2 overflow-x-auto">
                  <code className="block">
                    <span className="text-cyber-muted">$</span>{' '}
                    <span className="text-neon-cyan">connect</span>{' '}
                    <span className="text-neon-purple">--target</span>{' '}
                    network.corp.local
                  </code>
                  <code className="block text-cyber-muted">
                    {'[>]'} Establishing connection...
                  </code>
                  <code className="block text-cyber-muted">
                    {'[>]'} Connection established.
                  </code>
                  <code className="block">
                    <span className="text-cyber-muted">$</span>{' '}
                    <span className="text-neon-cyan">scan</span>{' '}
                    <span className="text-neon-purple">--ports</span> 1-1000
                  </code>
                  <code className="block text-cyber-muted">
                    {'[>]'} Scanning...
                  </code>
                  <code className="block text-neon-green">
                    {'[+]'} Found 3 open ports: 22, 80, 443
                  </code>
                  <code className="block">
                    <span className="text-cyber-muted">$</span>{' '}
                    <span className="text-neon-cyan">exploit</span>{' '}
                    <span className="text-neon-purple">--payload</span>{' '}
                    reverse_shell
                  </code>
                  <code className="block text-neon-green">
                    {'[+]'} Access gained! Type 'help' for commands.
                  </code>
                </pre>
              </div>

              {/* Glow эффект */}
              <div className="absolute -inset-1 bg-gradient-to-r from-neon-cyan/10 to-neon-purple/10 rounded-2xl blur-xl -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Особенности */}
      <section id="features" className="relative py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-display font-bold text-white mb-4">
              Ключевые <span className="text-neon-cyan">особенности</span>
            </h2>
            <p className="text-lg text-cyber-muted max-w-2xl mx-auto">
              Всё, что нужно для погружения в мир киберпанка и хакерства
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={index * 0.1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA секция */}
      <section id="beta" className="relative py-24 bg-gradient-to-b from-cyber-dark/50 to-cyber-black">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl sm:text-5xl font-display font-bold text-white mb-4">
              Присоединяйся к <span className="text-neon-cyan">бета-тесту</span>
            </h2>
            <p className="text-lg text-cyber-muted mb-8 max-w-2xl mx-auto">
              Стань одним из первых, кто испытает Zero Day. Оставь заявку и
              получи ранний доступ к игре.
            </p>

            <button
              onClick={() => setBetaModalOpen(true)}
              className="group relative px-10 py-4 rounded-xl bg-neon-cyan text-cyber-black font-bold text-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-neon-cyan/30"
            >
              <span className="relative z-10 flex items-center gap-2">
                <Mail size={20} />
                Записаться на бета-тест
              </span>
            </button>
          </motion.div>
        </div>
      </section>

      <Footer />

      {/* Модальное окно бета-теста */}
      <Modal
        isOpen={betaModalOpen}
        onClose={() => {
          setBetaModalOpen(false);
          setBetaSuccess(false);
          setBetaError('');
        }}
        title="Запись на бета-тест"
      >
        {betaSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <CheckCircle
              size={64}
              className="mx-auto mb-4 text-accent-success"
            />
            <h3 className="text-xl font-display font-semibold text-white mb-2">
              Заявка отправлена!
            </h3>
            <p className="text-cyber-muted">
              Мы свяжемся с тобой, когда начнётся бета-тестирование.
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleBetaSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Email
              </label>
              <input
                type="email"
                value={betaForm.email}
                onChange={(e) =>
                  setBetaForm({ ...betaForm, email: e.target.value })
                }
                required
                className="w-full px-4 py-2.5 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white placeholder-cyber-muted/50 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                placeholder="hacker@zeroday.net"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Как ты о нас узнал?
              </label>
              <select
                value={betaForm.source}
                onChange={(e) =>
                  setBetaForm({ ...betaForm, source: e.target.value })
                }
                required
                className="w-full px-4 py-2.5 rounded-lg bg-cyber-darker border border-cyber-border/50 text-white focus:outline-none focus:border-neon-cyan/50 transition-colors"
              >
                <option value="">Выбери вариант</option>
                {BETA_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            {betaError && (
              <p className="text-accent-danger text-sm">{betaError}</p>
            )}

            <button
              type="submit"
              disabled={betaSubmitting}
              className="w-full py-3 rounded-lg bg-neon-cyan text-cyber-black font-semibold hover:bg-neon-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {betaSubmitting ? 'Отправка...' : 'Отправить заявку'}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
