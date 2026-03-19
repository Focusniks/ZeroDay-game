"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AppHeader from "@/components/ui/AppHeader";

type DownloadTarget = "windows" | "mac" | "linux";
type ModalMode = "download" | "trailer";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function GlassCard({
  className,
  children,
  glow = "cyan",
}: {
  className?: string;
  children: ReactNode;
  glow?: "cyan" | "blue" | "emerald";
}) {
  const glowMap = {
    cyan: "border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.10),rgba(5,6,10,0.35))]",
    blue: "border-blue-400/20 bg-[linear-gradient(180deg,rgba(59,130,246,0.10),rgba(5,6,10,0.35))]",
    emerald:
      "border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(5,6,10,0.35))]",
  } as const;

  return (
    <div
      className={cx(
        "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl",
        glowMap[glow],
        className
      )}
    >
      {children}
    </div>
  );
}

function SectionHead({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/5 px-5 py-1 text-xs uppercase tracking-widest text-cyan-200/90">
        <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.55)]" />
        {kicker}
      </div>
      <h2 className="mt-5 text-3xl font-semibold leading-tight text-zinc-50 md:text-5xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-base leading-relaxed text-zinc-300">{subtitle}</p>
      ) : null}
    </div>
  );
}

function DownloadModal({
  mode,
  open,
  target,
  progress,
  onClose,
  onStartDownload,
  setTarget,
}: {
  mode: ModalMode;
  open: boolean;
  target: DownloadTarget;
  progress: number;
  onClose: () => void;
  onStartDownload: () => void;
  setTarget: (t: DownloadTarget) => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    setTimeout(() => modalRef.current?.focus(), 0);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={modalRef}
            tabIndex={-1}
            className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#070912]/80 p-6 shadow-[0_0_80px_rgba(34,211,238,0.12)] backdrop-blur-2xl"
            initial={{ y: 16, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 14, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                  {mode === "download" ? "Скачать игру" : "Трейлер"}
                </div>
                <h3 className="mt-2 text-2xl font-semibold text-zinc-50">
                  {mode === "download"
                    ? "Выберите платформу и начните загрузку"
                    : "Короткий обзор геймплея (заглушка)"}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-base text-zinc-200 hover:bg-white/10"
              >
                Закрыть
              </button>
            </div>

            {mode === "trailer" ? (
              <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <div className="flex aspect-video items-center justify-center p-10">
                  <div className="text-center">
                    <div className="mx-auto h-14 w-14 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_40px_rgba(34,211,238,0.18)]" />
                    <p className="mt-4 text-base text-zinc-300">
                      Видео ещё в разработке. Здесь будет трейлер.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(["windows", "mac", "linux"] as DownloadTarget[]).map((t) => {
                    const label =
                      t === "windows" ? "Windows" : t === "mac" ? "macOS" : "Linux";
                    return (
                      <button
                        key={t}
                        onClick={() => setTarget(t)}
                        className={cx(
                          "rounded-xl border px-4 py-2 text-base transition",
                          target === t
                            ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                            : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-zinc-400">
                      Платформа:{" "}
                      <span className="text-zinc-200">
                        {target === "windows"
                          ? "Windows 64-bit"
                          : target === "mac"
                            ? "macOS"
                            : "Linux"}
                      </span>
                    </div>
                    <div className="text-sm text-cyan-200">{progress}%</div>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                      initial={false}
                      animate={{ width: `${progress}%` }}
                      transition={{ type: "tween", duration: 0.35 }}
                    />
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      onClick={onStartDownload}
                      className="inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-base font-semibold text-zinc-950 hover:brightness-110 active:brightness-95"
                    >
                      Скачать (заглушка)
                    </button>
                    <p className="text-sm text-zinc-400">
                      Это демонстрация лендинга: реальная загрузка появится в релизе.
                    </p>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function LandingPage() {
  const [modalMode, setModalMode] = useState<ModalMode>("download");
  const [modalOpen, setModalOpen] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<DownloadTarget>("windows");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const timerRef = useRef<number | null>(null);

  const heroStats = useMemo(
    () => [
      { label: "Розыск", value: "1–5 уровней", tone: "cyan" as const },
      { label: "Мир", value: "персистентный, реалтайм", tone: "blue" as const },
      { label: "Скилл-три", value: "сеть / веб / социнж", tone: "emerald" as const },
      { label: "Экономика", value: "CryptoCoin + Marketplace", tone: "cyan" as const },
    ],
    []
  );

  const openModal = (mode: ModalMode) => {
    setModalMode(mode);
    setModalOpen(true);
    setDownloadProgress(0);
  };

  const startDownload = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setDownloadProgress(0);
    timerRef.current = window.setInterval(() => {
      setDownloadProgress((p) => {
        if (p >= 100) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          timerRef.current = null;
          return 100;
        }
        return Math.min(100, p + 8 + Math.random() * 10);
      });
    }, 150);
  };

  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AppHeader
        subtitle="Exploit Network"
        nav={[
          { href: "/#professions", label: "Профессии" },
          { href: "/#world", label: "Мир и риски" },
          { href: "/#economy", label: "Экономика" },
          { href: "/marketplace", label: "Торговая площадка" },
        ]}
      />

      <main className="relative z-10">
        {/* HERO */}
        <section className="zd-section mx-auto max-w-7xl px-4 py-16 lg:py-20">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/5 px-5 py-1 text-xs uppercase tracking-widest text-cyan-200/90">
                Персистентный мир + реалтайм
              </div>

              <h1 className="mt-6 text-4xl font-semibold leading-[1.03] text-zinc-50 sm:text-5xl md:text-6xl">
                <span className="zd-glitch" data-text="Zero Day: Exploit Network">
                  Zero Day: Exploit Network
                </span>
              </h1>

              <p className="mt-5 text-base leading-relaxed text-zinc-300">
                Хакерская MMORPG-симуляция, где прогресс — это стратегия: сеть, веб и
                социальная инженерия внутри системы рисков, розыска и репутации.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={() => openModal("download")}
                  className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-3 text-base font-semibold text-zinc-950 shadow-[0_0_60px_rgba(34,211,238,0.22)] hover:brightness-110"
                >
                  Скачать игру
                  <span className="h-2 w-2 rounded-full bg-zinc-950" />
                </button>
                <button
                  onClick={() => openModal("trailer")}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-7 py-3 text-base font-semibold text-zinc-100 hover:bg-white/10"
                >
                  Смотреть трейлер <span className="ml-2 text-cyan-200">▶</span>
                </button>
              </div>

              <div className="mt-8 grid grid-cols-1 auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {heroStats.map((s) => (
                  <GlassCard
                    key={s.label}
                    className="h-full p-4 text-left transition-transform duration-300 hover:-translate-y-1"
                    glow={s.tone}
                  >
                    <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/75">
                      {s.label}
                    </div>
                    <div className="mt-2 break-words text-[0.98rem] font-semibold leading-snug text-zinc-50">
                      {s.value}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>

            <div>
              <GlassCard className="p-4" glow="cyan">
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                  <Image
                    src="/zd-hero-screen.svg"
                    alt="Экран из игры (заглушка)"
                    width={1200}
                    height={700}
                    className="h-auto w-full object-cover"
                    priority
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-transparent opacity-65" />
                  <motion.div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-30"
                    animate={{ y: ["-10%", "6%", "-10%"] }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    style={{
                      backgroundImage:
                        "linear-gradient(90deg, rgba(34,211,238,0) 0%, rgba(34,211,238,0.50) 50%, rgba(34,211,238,0) 100%)",
                      mixBlendMode: "screen",
                      transform: "skewY(-8deg)",
                    }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <GlassCard className="p-4" glow="blue">
                    <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                      Розыск
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-50">1 → 5</div>
                    <p className="mt-2 text-sm text-zinc-300">
                      NPC охота и блокировки в логике симуляции.
                    </p>
                  </GlassCard>
                  <GlassCard className="p-4" glow="emerald">
                    <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                      Traceback
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-50">
                      мини-игра
                    </div>
                    <p className="mt-2 text-sm text-zinc-300">
                      очистка следов и прыжок через прокси (сим).
                    </p>
                  </GlassCard>
                </div>
              </GlassCard>
            </div>
          </div>
        </section>

        {/* PROFESSIONS */}
        <section id="professions" className="zd-section mx-auto max-w-7xl px-4 pb-16 pt-8">
          <SectionHead
            kicker="Прогресс"
            title="От Script Kiddie к Legend"
            subtitle="Уровни задают стиль игры, а скилл-три определяет тактику под риск розыска."
          />

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <GlassCard className="p-6" glow="cyan">
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                Уровни
              </div>
              <div className="mt-4 space-y-3">
                {[
                  "Script Kiddie",
                  "Junior Hacker",
                  "Advanced Hacker",
                  "Elite Hacker",
                  "Legend",
                ].map((t, i) => (
                  <div
                    key={t}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div className="text-base font-semibold text-zinc-50">{t}</div>
                    <div className="text-sm text-cyan-200/80">#{i + 1}</div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-6" glow="blue">
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                Скилл-три
              </div>
              <div className="mt-4 space-y-4">
                {[
                  { t: "Network Exploitation", s: "сеть" },
                  { t: "Web Hacking", s: "веб" },
                  { t: "Social Engineering", s: "соц. инженерия" },
                ].map((x) => (
                  <div
                    key={x.t}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="text-sm font-semibold text-zinc-50">{x.t}</div>
                    <div className="mt-1 text-sm text-zinc-300">
                      Блок развития: <span className="text-cyan-200">{x.s}</span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-6" glow="emerald">
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                На что похоже
              </div>
              <div className="mt-4 text-lg font-semibold text-zinc-50">
                Каждое действие оставляет след.
              </div>
              <p className="mt-3 text-base text-zinc-300">
                IP репутация растёт с атаками, VPN/Proxy повышают анонимность, а риск
                “подвода” и Traceback корректируют твои решения в реальном времени.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => scrollToId("world")}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-base font-semibold text-zinc-200 hover:bg-white/10"
                >
                  Понять механику
                </button>
                <Link
                  href="/marketplace"
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-base font-semibold text-zinc-950 hover:brightness-110 text-center"
                >
                  В площадку
                </Link>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* WORLD + RISKS */}
        <section id="world" className="zd-section mx-auto max-w-7xl px-4 pb-16 pt-4">
          <SectionHead
            kicker="Мир и риски"
            title="Персистентность + розыск + уклонение"
            subtitle="Система розыска управляет тем, как далеко ты можешь зайти, и когда включаются NPC охотники."
          />

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <GlassCard className="p-6" glow="cyan">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                    Персистентный мир
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-zinc-50">
                    Реальное время, устойчивые последствия
                  </div>
                  <p className="mt-3 text-base text-zinc-300">
                    Серверы, контракты и следы не “обнуляются” мгновенно. Репутация и
                    расследование продолжаются.
                  </p>
                </div>
                <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  <Image
                    src="/zd-network-map.svg"
                    alt="Карта сети (заглушка)"
                    fill
                    className="object-cover"
                    sizes="112px"
                  />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <GlassCard className="p-4" glow="blue">
                  <div className="text-sm font-semibold text-zinc-50">IP Репутация</div>
                  <div className="mt-2 text-sm text-zinc-300">
                    Растёт с активностью и влияет на отслеживание.
                  </div>
                </GlassCard>
                <GlassCard className="p-4" glow="emerald">
                  <div className="text-sm font-semibold text-zinc-50">Контейнеры</div>
                  <div className="mt-2 text-sm text-zinc-300">
                    Всё только в виртуальной песочнице.
                  </div>
                </GlassCard>
              </div>
            </GlassCard>

            <GlassCard className="p-6" glow="emerald">
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                Traceback
              </div>
              <div className="mt-2 text-2xl font-semibold text-zinc-50">Мини-игра уклонения</div>
              <p className="mt-3 text-base text-zinc-300">
                Нужно быстро реагировать: чистить логи, прыгать через прокси и
                удерживать безопасное окно.
              </p>
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-base font-semibold text-zinc-50">Проверить механику</div>
                <p className="mt-2 text-sm text-zinc-400">
                  В демо Marketplace есть имитация: это демонстрация, не инструкция.
                </p>
                <div className="mt-4">
                  <Link
                    href="/marketplace"
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-base font-semibold text-zinc-950 hover:brightness-110"
                  >
                    Перейти в Marketplace
                  </Link>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* ECONOMY */}
        <section id="economy" className="zd-section mx-auto max-w-7xl px-4 pb-18 pt-4">
          <SectionHead
            kicker="Экономика"
            title="CryptoCoin + торговая площадка"
            subtitle="Контракты, продажа инструментов, участие в CTF и редкие одноразовые “zero-day” — всё в игре."
          />

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <GlassCard className="p-6 lg:col-span-2" glow="cyan">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                    CryptoCoin
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-zinc-50">
                    Заказы, CTF и рынок
                  </div>
                  <p className="mt-3 text-base text-zinc-300">
                    Зарабатывай крипту, покупай инструменты и вливайся в комьюнити. Всё
                    в безопасной симуляции.
                  </p>
                </div>
                <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  <Image src="/zd-economy.svg" alt="Экономика (заглушка)" fill className="object-cover" sizes="112px" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { t: "Заработок", d: "контракты, CTF, продажа" },
                  { t: "Расходы", d: "инструменты, аренда, bribes (сим)" },
                  { t: "Репутация", d: "White / Gray / Black Hat" },
                ].map((x) => (
                  <div key={x.t} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-zinc-50">{x.t}</div>
                    <div className="mt-2 text-sm text-zinc-300">{x.d}</div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-6" glow="blue">
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                Marketplace
              </div>
              <div className="mt-2 text-2xl font-semibold text-zinc-50">Создавай лоты</div>
              <p className="mt-3 text-base text-zinc-300">
                Авторизованные игроки продают сервисы, скрипты и информацию — с
                чатом и сделкой между сторонами.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href="/marketplace"
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-base font-semibold text-zinc-950 text-center hover:brightness-110"
                >
                  Открыть площадку
                </Link>
                <Link
                  href="/account"
                  className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-base font-semibold text-zinc-200 text-center hover:bg-white/10"
                >
                  Личный кабинет
                </Link>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* DOWNLOAD */}
        <section className="zd-section mx-auto max-w-7xl px-4 pb-20 pt-6">
          <SectionHead
            kicker="Скачать"
            title="Начни с туториала"
            subtitle="Базовые команды Linux, разведка и первые контракты — в виртуальной песочнице."
          />

          <div className="mt-10">
            <GlassCard className="p-7" glow="emerald">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                    Zero Day Installer
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-zinc-50">
                    Скачай и начинай
                  </div>
                  <p className="mt-3 text-base text-zinc-300">
                    Мы имитируем загрузку в демо. Реальный билд появится в релизе.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    onClick={() => openModal("download")}
                    className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 text-base font-semibold text-zinc-950 shadow-[0_0_60px_rgba(34,211,238,0.20)] hover:brightness-110"
                  >
                    Скачать игру
                  </button>
                  <button
                    onClick={() => openModal("trailer")}
                    className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-base font-semibold text-zinc-200 hover:bg-white/10"
                  >
                    Смотреть трейлер
                  </button>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        <footer className="bg-[#05060a]/40">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-10 md:flex-row md:items-center md:justify-between">
            <div className="text-base text-zinc-300">
              © {new Date().getFullYear()} Zero Day: Exploit Network
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/account"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-base text-zinc-200 hover:bg-white/10"
              >
                Личный кабинет
              </Link>
              <Link
                href="/marketplace"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-base text-zinc-200 hover:bg-white/10"
              >
                Торговая площадка
              </Link>
              <button
                onClick={() => openModal("download")}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-base text-zinc-200 hover:bg-white/10"
              >
                Скачать
              </button>
            </div>
          </div>
        </footer>
      </main>

      <DownloadModal
        mode={modalMode}
        open={modalOpen}
        target={downloadTarget}
        progress={downloadProgress}
        onClose={() => setModalOpen(false)}
        onStartDownload={startDownload}
        setTarget={setDownloadTarget}
      />
    </div>
  );
}

