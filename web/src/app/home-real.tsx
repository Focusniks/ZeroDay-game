"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type DownloadTarget = "windows" | "mac" | "linux";
type ModalMode = "download" | "trailer";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function SectionTitle({
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
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/5 px-4 py-1 text-xs text-cyan-200/90">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.6)]" />
        {kicker}
      </div>
      <h2 className="mt-4 text-3xl font-semibold leading-tight text-zinc-50 md:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-sm leading-relaxed text-zinc-300 md:text-base">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
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

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs uppercase tracking-widest text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-50">{value}</div>
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
  progress: number; // 0..100
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

    // Focus the dialog
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
          aria-modal="true"
          role="dialog"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={modalRef}
            tabIndex={-1}
            className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#070912]/80 p-4 shadow-[0_0_80px_rgba(34,211,238,0.12)] backdrop-blur-2xl"
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
                <h3 className="mt-2 text-xl font-semibold text-zinc-50">
                  {mode === "download"
                    ? "Выберите платформу и начните загрузку"
                    : "Короткий обзор геймплея (заглушка)"}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
                aria-label="Закрыть"
              >
                Закрыть
              </button>
            </div>

            {mode === "trailer" ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <div className="flex aspect-video items-center justify-center p-8">
                  <div className="text-center">
                    <div className="mx-auto h-12 w-12 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_40px_rgba(34,211,238,0.18)]" />
                    <p className="mt-3 text-sm text-zinc-300">
                      Видео ещё в разработке. Здесь будет трейлер.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["windows", "mac", "linux"] as DownloadTarget[]).map((t) => {
                    const label =
                      t === "windows" ? "Windows" : t === "mac" ? "macOS" : "Linux";
                    return (
                      <button
                        key={t}
                        onClick={() => setTarget(t)}
                        className={cx(
                          "rounded-xl border px-3 py-2 text-sm transition",
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

                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm leading-relaxed text-zinc-300">
                    Это демо-лендинг: реальные файлы загрузки появятся в релизе.
                    Сейчас мы имитируем подготовку, чтобы кнопка работала “живьём”.
                  </p>

                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-zinc-400">
                        Платформа:{" "}
                        <span className="text-zinc-200">
                          {target === "windows"
                            ? "Windows 64-bit"
                            : target === "mac"
                              ? "macOS"
                              : "Linux"}
                        </span>
                      </div>
                      <div className="text-xs text-cyan-200">{progress}%</div>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                        initial={false}
                        animate={{ width: `${progress}%` }}
                        transition={{ type: "tween", duration: 0.35 }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      onClick={onStartDownload}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_40px_rgba(34,211,238,0.22)] hover:brightness-110 active:brightness-95"
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-zinc-950" />
                      Скачать (заглушка)
                    </button>
                    <p className="text-xs text-zinc-400">
                      Никаких реальных атак: только симуляция внутри игры.
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

function TracebackMini() {
  const [running, setRunning] = useState(false);
  const [marker, setMarker] = useState(50); // 0..100
  const [result, setResult] = useState<"idle" | "ok" | "bad">("idle");
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<number | null>(null);
  const directionRef = useRef<1 | -1>(1);

  const safeFrom = 38;
  const safeTo = 64;

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const start = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setResult("idle");
    setAttempts((a) => a + 1);
    setRunning(true);
    directionRef.current = 1;

    timerRef.current = window.setInterval(() => {
      setMarker((m) => {
        let next = m + directionRef.current * (2.2 + Math.random() * 1.2);
        if (next >= 100) {
          next = 100;
          directionRef.current = -1;
        } else if (next <= 0) {
          next = 0;
          directionRef.current = 1;
        }
        return next;
      });
    }, 35);
  };

  const jump = () => {
    if (!running) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);

    const ok = marker >= safeFrom && marker <= safeTo;
    setResult(ok ? "ok" : "bad");
  };

  return (
    <GlassCard className="group p-5" glow="emerald">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-cyan-200/70">
            Traceback (мини-симуляция)
          </div>
          <div className="mt-2 text-lg font-semibold text-zinc-50">
            Уклоняйся: очистка логов и прыжок через прокси
          </div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Нажми <span className="text-zinc-50 font-semibold">“Старт”</span>, дождись
            безопасного окна и нажми <span className="text-zinc-50 font-semibold">“Прыгнуть”</span>.
            Это просто визуальная игра для лендинга.
          </p>
        </div>

        <div className="w-full md:max-w-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-400">
              Попытки: <span className="text-zinc-200">{attempts}</span>
            </div>
            <div className="text-xs text-cyan-200">
              {result === "idle" ? "Готов" : result === "ok" ? "Чисто" : "Поймано"}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="relative h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-cyan-400/30 to-blue-500/30"
                style={{
                  left: `${safeFrom}%`,
                  width: `${safeTo - safeFrom}%`,
                }}
              />
              <motion.div
                className="absolute top-0 h-3 w-2 rounded-full bg-red-400 shadow-[0_0_30px_rgba(248,113,113,0.35)]"
                style={{ left: `${marker}%`, x: "-50%" }}
                animate={{ left: `${marker}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
                aria-hidden="true"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={start}
                disabled={running}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50"
              >
                Старт
              </button>
              <button
                onClick={jump}
                disabled={!running}
                className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-sm font-semibold text-zinc-950 hover:brightness-110 disabled:opacity-50"
              >
                Прыгнуть
              </button>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

export default function HomeReal() {
  const [modalMode, setModalMode] = useState<ModalMode>("download");
  const [modalOpen, setModalOpen] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<DownloadTarget>("windows");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const downloadTimer = useRef<number | null>(null);

  const heroStats = useMemo(
    () => [
      { label: "Розыск", value: "Уровни 1–5" },
      { label: "Прогресс", value: "5 рангов хакеров" },
      { label: "Скилл-три", value: "Сеть + Веб + Соц. инженерия" },
      { label: "Мир", value: "Персистент + реалтайм" },
    ],
    []
  );

  useEffect(() => {
    if (!modalOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  useEffect(() => {
    return () => {
      if (downloadTimer.current) window.clearInterval(downloadTimer.current);
    };
  }, []);

  const openModal = (mode: ModalMode) => {
    setModalMode(mode);
    setModalOpen(true);
    setDownloadProgress(0);
  };

  const startDownload = () => {
    if (downloadTimer.current) window.clearInterval(downloadTimer.current);
    setDownloadProgress(0);
    downloadTimer.current = window.setInterval(() => {
      setDownloadProgress((p) => {
        if (p >= 100) {
          if (downloadTimer.current) window.clearInterval(downloadTimer.current);
          downloadTimer.current = null;
          return 100;
        }
        return Math.min(100, p + 6 + Math.random() * 10);
      });
    }, 160);
  };

  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const levels = useMemo(
    () => [
      {
        title: "Script Kiddie",
        desc: "Первые шаги: базовые команды, сканирование и простые контракты.",
        glow: "cyan" as const,
      },
      {
        title: "Junior Hacker",
        desc: "Стабильный прогресс: веб-уязвимости, фишинг и сценарии атак в игре.",
        glow: "blue" as const,
      },
      {
        title: "Advanced Hacker",
        desc: "Скилл-три глубже: скрытность, криптонавыки, сложные задания и рейды.",
        glow: "emerald" as const,
      },
      {
        title: "Elite Hacker",
        desc: "Оркестрация: инструменты, фреймворки и системная тактика против целей.",
        glow: "cyan" as const,
      },
      {
        title: "Legend",
        desc: "Лидерство: ботнет-аренда, редкие zero-day, влияние в гильдиях и CTF.",
        glow: "blue" as const,
      },
    ],
    []
  );

  const skillTriad = useMemo(
    () => [
      {
        title: "Network Exploitation",
        subtitle: "Сетевые атаки",
        points: [
          "Netscanner и карта поверхности цели",
          "Сценарии взлома в рамках игры",
          "Скрытность маршрутов и контроль следов",
        ],
        image: "/zd-network-map.svg",
        glow: "cyan" as const,
      },
      {
        title: "Web Hacking",
        subtitle: "Веб-уязвимости",
        points: [
          "Drag-and-drop конструктор сайтов",
          "Поиск слабостей и защита своих проектов",
          "Эксплойты и “zero-day” в механике",
        ],
        image: "/zd-web-builder.svg",
        glow: "blue" as const,
      },
      {
        title: "Social Engineering",
        subtitle: "Фишинг и инженерия",
        points: [
          "Сообщения, роли и репутация",
          "Чат и dark web форумы (в игре)",
          "Умение оставаться незаметным в обществе",
        ],
        image: "/zd-world.svg",
        glow: "emerald" as const,
      },
    ],
    []
  );

  const tools = useMemo(
    () => [
      {
        name: "Netscanner",
        desc: "Сканирование сети и разведка в безопасной песочнице.",
        img: "/zd-network-map.svg",
      },
      { name: "Hydra", desc: "Brute force сценарии (игровая симуляция).", img: "/zd-web-builder.svg" },
      {
        name: "Database Manager",
        desc: "Работа с БД: запросы, схемы и контроль доступа (в игре).",
        img: "/zd-network-map.svg",
      },
      { name: "Packet Sniffer", desc: "Перехват трафика — только для анализа в игре.", img: "/zd-traceback.svg" },
      { name: "Exploit Framework", desc: "Фреймворк вроде Metasploit для сборки “комбо”.", img: "/zd-web-builder.svg" },
      {
        name: "Social Engine Toolkit",
        desc: "Фишинг-утилиты и сценарии общения (без реального вреда).",
        img: "/zd-world.svg",
      },
    ],
    []
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05060a]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-3 rounded-xl p-1 hover:bg-white/5">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-cyan-400/20 bg-cyan-500/10">
              <Image
                src="/zd-logo.svg"
                alt="Zero Day"
                fill
                sizes="36px"
                className="object-cover"
                priority
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-50">Zero Day</div>
              <div className="text-xs text-cyan-200/80">Exploit Network</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => scrollToId("world")}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              Мир
            </button>
            <button
              onClick={() => scrollToId("economy")}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              Экономика
            </button>
            <button
              onClick={() => scrollToId("tools")}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              Инструменты
            </button>
            <button
              onClick={() => scrollToId("ctf")}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              CTF
            </button>

            <Link
              href="/account"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              Личный кабинет
            </Link>
            <Link
              href="/marketplace"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              Торговая площадка
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="#"
              className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 md:inline-flex"
              onClick={(e) => e.preventDefault()}
              aria-label="Discord (заглушка)"
            >
              Discord
            </a>
            <button
              onClick={() => openModal("download")}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_0_40px_rgba(34,211,238,0.22)] hover:brightness-110 active:brightness-95"
            >
              Скачать игру
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* HERO */}
        <section className="zd-section mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-16 md:grid-cols-2 md:py-20">
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/5 px-4 py-1 text-xs text-cyan-200/90">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.6)]" />
              Персистентный мир + реалтайм
            </div>

            <h1 className="mt-5 text-4xl font-semibold leading-[1.05] text-zinc-50 sm:text-5xl">
              <span className="zd-glitch" data-text="Zero Day: Exploit Network">
                Zero Day: Exploit Network
              </span>
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-zinc-300 sm:text-base">
              Хакерская MMORPG-симуляция, где прогресс измеряется не “уничтожением целей”, а
              стратегией: сеть, веб и социальная инженерия — в одной системе рисков, розыска и репутации.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={() => openModal("download")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_45px_rgba(34,211,238,0.22)] hover:brightness-110 active:brightness-95"
              >
                Скачать игру <span className="h-2 w-2 rounded-full bg-zinc-950" />
              </button>
              <button
                onClick={() => openModal("trailer")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-100 hover:bg-white/10"
              >
                Смотреть трейлер <span className="text-cyan-200">▶</span>
              </button>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {heroStats.map((s) => (
                <StatPill key={s.label} label={s.label} value={s.value} />
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <GlassCard className="group p-5" glow="cyan">
                <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                  Розыск
                </div>
                <div className="mt-2 text-lg font-semibold text-zinc-50">Уровни 1 → 5</div>
                <p className="mt-2 text-sm text-zinc-300">
                  Предупреждения, блокировки аккаунта и охота NPC-хакеров.
                </p>
              </GlassCard>
              <GlassCard className="group p-5" glow="blue">
                <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                  IP репутация
                </div>
                <div className="mt-2 text-lg font-semibold text-zinc-50">
                  Чем больше следов — тем выше шанс быть найденным
                </div>
                <p className="mt-2 text-sm text-zinc-300">
                  VPN/Proxy цепочки и механика Traceback в игровой симуляции.
                </p>
              </GlassCard>
            </div>
          </div>

          <div className="relative">
            <motion.div
              className="absolute -inset-2 -z-10 rounded-[2.2rem] bg-gradient-to-b from-cyan-500/20 via-transparent to-blue-500/10 blur-2xl"
              animate={{ opacity: [0.65, 0.95, 0.65], rotate: [0, 4, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />

            <GlassCard className="group p-4" glow="cyan">
              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <Image
                  src="/zd-hero-screen.svg"
                  alt="Скриншот из игры (заглушка)"
                  width={1200}
                  height={700}
                  className="h-auto w-full object-cover"
                  priority
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-transparent opacity-60" />
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-30"
                  animate={{ y: ["-12%", "6%"] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, rgba(34,211,238,0) 0%, rgba(34,211,238,0.45) 50%, rgba(34,211,238,0) 100%)",
                    mixBlendMode: "screen",
                    transform: "skewY(-8deg)",
                  }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-cyan-200/80">Шифрование</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-50">
                    Cryptography
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                      animate={{ width: ["24%", "72%", "38%"] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-cyan-200/80">Скрытность</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-50">Stealth</div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                      animate={{ width: ["38%", "86%", "52%"] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Progression */}
        <section id="progression" className="zd-section mx-auto max-w-7xl px-4 py-14 md:py-20">
          <SectionTitle
            kicker="Система прогрессии"
            title="От Script Kiddie к Legend"
            subtitle="Каждый уровень — это новый стиль игры и новые решения под риск розыска и репутацию IP."
          />

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-5">
            {levels.map((l, idx) => (
              <motion.div
                key={l.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: idx * 0.05 }}
                className="relative"
              >
                <GlassCard className="group p-5 h-full" glow={l.glow}>
                  <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                    Уровень {idx + 1}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-zinc-50">{l.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">{l.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Skill triad */}
        <section className="zd-section mx-auto max-w-7xl px-4 py-14 md:py-20">
          <SectionTitle
            kicker="Скилл-три"
            title="Три ветки, которые меняют стиль хакера"
            subtitle="Собирай комбинации: сеть + веб + социальная инженерия. Результат всегда отражается в розыске."
          />

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {skillTriad.map((s, idx) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: idx * 0.08 }}
              >
                <GlassCard className="group p-5 h-full" glow={s.glow}>
                  <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    <Image
                      src={s.image}
                      alt={`${s.title} (заглушка)`}
                      width={800}
                      height={500}
                      className="h-[180px] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-transparent opacity-70" />
                  </div>
                  <div className="mt-4">
                    <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                      {s.subtitle}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-50">{s.title}</div>
                    <ul className="mt-3 space-y-2">
                      {s.points.map((p) => (
                        <li key={p} className="text-sm text-zinc-300">
                          <span className="mr-2 text-cyan-200">▸</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* World */}
        <section id="world" className="zd-section mx-auto max-w-7xl px-4 py-14 md:py-20">
          <SectionTitle
            kicker="Игровой мир"
            title="Реальное время, персистентность и цена следов"
            subtitle="Твоя анонимность — не гарантия. Она балансирует между безопасностью и шансом быть замеченным."
          />

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              className="md:col-span-2"
            >
              <GlassCard className="group p-5 h-full" glow="cyan">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                      Персистентный мир
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-50">
                      Мир не “обнуляется” после рейда
                    </div>
                    <p className="mt-2 text-sm text-zinc-300">
                      Реальное время + устойчивые изменения: серверы, контракты, следы и репутация продолжаются.
                    </p>
                  </div>
                  <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    <Image
                      src="/zd-network-map.svg"
                      alt="Карта сети (заглушка)"
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <GlassCard className="p-4" glow="blue">
                    <div className="text-sm font-semibold text-zinc-50">IP репутация</div>
                    <p className="mt-1 text-sm text-zinc-300">
                      Чем больше атак с твоего IP — тем выше вероятность отслеживания.
                    </p>
                  </GlassCard>
                  <GlassCard className="p-4" glow="emerald">
                    <div className="text-sm font-semibold text-zinc-50">Traceback</div>
                    <p className="mt-1 text-sm text-zinc-300">
                      Мини-симуляция уклонения: быстро чистишь логи и прыгаешь через прокси.
                    </p>
                  </GlassCard>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <GlassCard className="group p-5 h-full" glow="blue">
                <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                  Система розыска
                </div>
                <div className="mt-2 text-lg font-semibold text-zinc-50">Уровень 1 → 5</div>
                <p className="mt-2 text-sm text-zinc-300">
                  От предупреждений до “виртуальной полиции”: NPC хакеры начинают охоту.
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    { k: "Уровень 1", v: "Предупреждение", c: "cyan" as const },
                    { k: "Уровень 3", v: "Блокировка аккаунтов", c: "blue" as const },
                    { k: "Уровень 5", v: "NPC охотники", c: "emerald" as const },
                  ].map((row) => (
                    <div key={row.k} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs text-zinc-400">{row.k}</div>
                      <div className="mt-1 text-sm font-semibold text-zinc-50">{row.v}</div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </section>

        {/* Economy */}
        <section id="economy" className="zd-section mx-auto max-w-7xl px-4 py-14 md:py-20">
          <SectionTitle
            kicker="Экономика"
            title="CryptoCoin, сделки и репутация"
            subtitle="Ты не просто играешь — ты торгуешь риском, скоростью и доверием."
          />

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              className="md:col-span-2"
            >
              <GlassCard className="group p-5 h-full" glow="emerald">
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                  <Image
                    src="/zd-economy.svg"
                    alt="Экономика (заглушка)"
                    width={1000}
                    height={500}
                    className="h-[200px] w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-transparent opacity-75" />
                </div>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <GlassCard className="p-4" glow="cyan">
                    <div className="text-sm font-semibold text-zinc-50">Заработок CryptoCoin</div>
                    <ul className="mt-2 space-y-2 text-sm text-zinc-300">
                      <li>• контракты и задания</li>
                      <li>• продажа инструментов</li>
                      <li>• участие в CTF</li>
                    </ul>
                  </GlassCard>
                  <GlassCard className="p-4" glow="blue">
                    <div className="text-sm font-semibold text-zinc-50">Расходы и репутация</div>
                    <ul className="mt-2 space-y-2 text-sm text-zinc-300">
                      <li>• инструменты и аренда серверов</li>
                      <li>• VPN/прокси и bribes (в гейм-логике)</li>
                      <li>• White / Gray / Black Hat</li>
                    </ul>
                  </GlassCard>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <GlassCard className="group p-5 h-full" glow="cyan">
                <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                  Маркетплейс
                </div>
                <div className="mt-2 text-lg font-semibold text-zinc-50">
                  Продавай скрипты, покупай возможности
                </div>
                <p className="mt-2 text-sm text-zinc-300">
                  Рейтинги, отзывы и шанс на редкие “zero-day” эксплойты (одноразовые в механике).
                </p>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                  <span className="text-cyan-200">Важное:</span> это всё происходит в игре и не переносится на реальный мир.
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </section>

        {/* Tools */}
        <section id="tools" className="zd-section mx-auto max-w-7xl px-4 py-14 md:py-20">
          <SectionTitle
            kicker="Инструментарий"
            title="Утилиты, фреймворки и “настройка” под стиль"
            subtitle="Открывай возможности, но помни: каждое действие оставляет след."
          />

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t, idx) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: idx * 0.03 }}
              >
                <GlassCard className="group p-5 h-full" glow={idx % 2 === 0 ? "cyan" : "blue"}>
                  <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    <Image
                      src={t.img}
                      alt={`${t.name} (заглушка)`}
                      width={700}
                      height={480}
                      className="h-[140px] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-transparent opacity-70" />
                  </div>
                  <div className="mt-4 text-lg font-semibold text-zinc-50">{t.name}</div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">{t.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Security + Traceback */}
        <section className="zd-section mx-auto max-w-7xl px-4 py-14 md:py-20">
          <SectionTitle
            kicker="Защита и риски"
            title="Firewalls, IDS/IPS и ловушки"
            subtitle="Твоя тактика вызывает реакции: оборона и ловушки в игре делают PvP честным и контролируемым."
          />

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                title: "Firewall",
                desc: "Его можно взломать или обойти — но каждый обход поднимает розыск.",
                img: "/zd-traceback.svg",
                glow: "cyan" as const,
              },
              {
                title: "IDS/IPS",
                desc: "Обнаружение вторжений и влияние на Traceback-минигейм.",
                img: "/zd-network-map.svg",
                glow: "blue" as const,
              },
              {
                title: "Honeypots",
                desc: "Ловушки: попался — сразу высокий уровень розыска.",
                img: "/zd-world.svg",
                glow: "emerald" as const,
              },
            ].map((c, idx) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: idx * 0.04 }}
              >
                <GlassCard className="group p-5 h-full" glow={c.glow}>
                  <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    <Image
                      src={c.img}
                      alt={`${c.title} (заглушка)`}
                      width={750}
                      height={450}
                      className="h-[160px] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-transparent opacity-70" />
                  </div>
                  <div className="mt-4 text-lg font-semibold text-zinc-50">{c.title}</div>
                  <p className="mt-2 text-sm text-zinc-300">{c.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          <div className="mt-6">
            <TracebackMini />
          </div>
        </section>

        {/* Social */}
        <section className="zd-section mx-auto max-w-7xl px-4 py-14 md:py-20">
          <SectionTitle
            kicker="Социальная система"
            title="Кланы, рейды и тёмные форумы"
            subtitle="Построй свою сеть союзников. Веди войны гильдий и держи связь через чат."
          />

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <GlassCard className="group p-5 h-full" glow="blue">
                <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                  Kisscord / Dark web
                </div>
                <div className="mt-2 text-lg font-semibold text-zinc-50">
                  Приватные каналы и репутация в сообществах
                </div>
                <p className="mt-2 text-sm text-zinc-300">
                  White/Gray/Black Hat форумы, отзывы на инструменты и “след” твоих решений в игровом мире.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Приватные каналы", "Тёмные форумы", "Клановые войны", "Рейды вместе"].map(
                    (tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200"
                      >
                        {tag}
                      </span>
                    )
                  )}
                </div>
              </GlassCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <GlassCard className="group p-5 h-full" glow="cyan">
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                  <Image
                    src="/zd-darkweb.svg"
                    alt="Dark web (заглушка)"
                    width={900}
                    height={520}
                    className="h-[220px] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-transparent opacity-70" />
                </div>
                <div className="mt-4 text-lg font-semibold text-zinc-50">Игра внутри правил симуляции</div>
                <p className="mt-2 text-sm text-zinc-300">
                  Все атаки — только на виртуальные системы. Реальные IP не раскрываются.
                </p>
              </GlassCard>
            </motion.div>
          </div>
        </section>

        {/* CTF */}
        <section id="ctf" className="zd-section mx-auto max-w-7xl px-4 py-14 md:py-20">
          <SectionTitle
            kicker="Контент ивентов"
            title="CTF, ботнеты и отдельная Dark Web-сеть"
            subtitle="Еженедельные турниры и игровые “сети влияния” — шанс урвать ресурсы и поднять репутацию."
          />

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                title: "CTF турниры",
                desc: "Еженедельные соревнования с призовым фондом в крипте и рейтингом.",
                img: "/zd-ctf.svg",
                glow: "cyan" as const,
              },
              {
                title: "Ботнеты",
                desc: "Заражение NPC устройств, аренда мощностей и “майнинг” в игровой механике.",
                img: "/zd-botnet.svg",
                glow: "blue" as const,
              },
              {
                title: "Dark Web",
                desc: "Сеть .onion с маркетплейсами, наёмными NPC-хакерами и сделками в игре.",
                img: "/zd-darkweb.svg",
                glow: "emerald" as const,
              },
            ].map((c, idx) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: idx * 0.05 }}
              >
                <GlassCard className="group p-5 h-full" glow={c.glow}>
                  <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    <Image
                      src={c.img}
                      alt={`${c.title} (заглушка)`}
                      width={800}
                      height={500}
                      className="h-[160px] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-transparent opacity-70" />
                  </div>
                  <div className="mt-4 text-lg font-semibold text-zinc-50">{c.title}</div>
                  <p className="mt-2 text-sm text-zinc-300">{c.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Download */}
        <section className="zd-section mx-auto max-w-7xl px-4 py-14 md:py-20">
          <SectionTitle
            kicker="Старт"
            title="Готов к персистентной сети?"
            subtitle="Скачай игру и начни с туториала: базовые команды Linux, разведка и первые контракты в виртуальном мире."
          />

          <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <GlassCard className="group p-6 lg:col-span-2" glow="cyan">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                    Быстрый доступ
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-zinc-50">
                    Скачивание с модальной страницы
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                    Здесь будет реальная ссылка на загрузку инсталлятора. Пока — “внешний вид” и анимации.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    onClick={() => openModal("download")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_45px_rgba(34,211,238,0.22)] hover:brightness-110 active:brightness-95"
                  >
                    Скачать игру <span className="text-zinc-950">⟶</span>
                  </button>
                  <button
                    onClick={() => openModal("trailer")}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-100 hover:bg-white/10"
                  >
                    Посмотреть трейлер
                  </button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { k: "Windows 10+", v: "рекомендуется" },
                  { k: "RAM", v: "от 8 ГБ" },
                  { k: "Сеть", v: "постоянное соединение" },
                  { k: "PvP", v: "по согласию" },
                ].map((x) => (
                  <div key={x.k} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-zinc-400">{x.k}</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-50">{x.v}</div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="group p-6" glow="blue">
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                Анти-чит и безопасность
              </div>
              <div className="mt-2 text-lg font-semibold text-zinc-50">
                Симуляция вместо реального риска
              </div>
              <p className="mt-2 text-sm text-zinc-300">
                Серверная архитектура изолирует действия в контейнерах. Реальные IP не отображаются.
                Anti-cheat защищает от использования “настоящих эксплойтов” без согласия в игре.
              </p>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                <span className="text-cyan-200">Примечание:</span> лендинг — визуальная витрина, без инструкций и реальных атак.
              </div>
            </GlassCard>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#05060a]/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-zinc-300">
            © {new Date().getFullYear()} Zero Day: Exploit Network. Все права защищены.
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {["Политика", "Пользовательское соглашение", "Поддержка"].map((x) => (
              <a
                key={x}
                href="#"
                onClick={(e) => e.preventDefault()}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-zinc-200 hover:bg-white/10"
              >
                {x}
              </a>
            ))}
          </div>
        </div>
      </footer>

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

