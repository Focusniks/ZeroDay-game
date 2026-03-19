"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import { signOut, useSession } from "next-auth/react";

type TabKey = "overview" | "inventory" | "wallet" | "settings";

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
      className={[
        "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl",
        glowMap[glow],
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs uppercase tracking-widest text-zinc-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-50">{value}</div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-xl border px-3 py-2 text-sm transition",
        active
          ? "border-cyan-400/35 bg-cyan-500/15 text-cyan-100"
          : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function AccountPage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const { data: session, status } = useSession();

  // Settings form state (client-only UI)
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdNewConfirm, setPwdNewConfirm] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  const submitPasswordChange = async () => {
    setPwdError(null);
    setPwdSuccess(null);

    if (!pwdCurrent) {
      setPwdError("Введите текущий пароль");
      return;
    }
    if (!pwdNew || pwdNew.length < 6) {
      setPwdError("Новый пароль должен быть минимум 6 символов");
      return;
    }
    if (pwdNew !== pwdNewConfirm) {
      setPwdError("Новый пароль и подтверждение не совпадают");
      return;
    }

    setPwdBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: pwdCurrent,
          newPassword: pwdNew,
          newPasswordConfirm: pwdNewConfirm,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data?.ok) {
        setPwdError(data?.error ?? "Ошибка изменения пароля");
        return;
      }

      setPwdSuccess("Пароль обновлён");
      setPwdCurrent("");
      setPwdNew("");
      setPwdNewConfirm("");
    } catch {
      setPwdError("Server error");
    } finally {
      setPwdBusy(false);
    }
  };

  const profile = useMemo(
    () => ({
      handle: session?.user?.name ?? "operator",
      levelTitle:
        session?.user?.hatRank === "White Hat"
          ? "Junior Hacker"
          : session?.user?.hatRank === "Black Hat"
            ? "Elite Hacker"
            : "Junior Hacker",
      reputation: {
        white: session?.user?.hatRank === "White Hat" ? 12 : 8,
        gray: 7,
        black: session?.user?.hatRank === "Black Hat" ? 6 : 3,
      },
      createdAt: session?.user?.createdAt,
      ipRisk: "Средний",
      traceback: "Готов к мини-симуляциям",
      wallet: {
        crypto: 18420,
        rank: (session?.user?.hatRank ?? "Gray Hat") as string,
      },
      stats: {
        contracts: 38,
        raids: 9,
        ctf: 6,
        tools: 14,
      },
    }),
    [session?.user?.hatRank, session?.user?.name, session?.user?.createdAt]
  );

  if (status === "loading") {
    return (
      <div className="relative min-h-screen">
        <main className="relative z-10 mx-auto flex max-w-2xl flex-col gap-6 px-4 py-14">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="text-xs uppercase tracking-widest text-cyan-200/70">
              Loading
            </div>
            <div className="mt-3 text-base text-zinc-300">
              Секцию инициализируем…
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="relative min-h-screen">
        <main className="relative z-10 mx-auto flex max-w-2xl flex-col gap-6 px-4 py-14">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="text-xs uppercase tracking-widest text-cyan-200/70">
              Authorization
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-50">
              Войдите в аккаунт
            </h1>
            <p className="mt-3 text-base text-zinc-300">
              Чтобы открыть личный кабинет и участвовать в сделках на Marketplace,
              нужен вход.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/login"
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-base font-semibold text-zinc-950 hover:brightness-110 text-center"
              >
                Войти
              </Link>
              <Link
                href="/auth/register"
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-base font-semibold text-zinc-200 hover:bg-white/10 text-center"
              >
                Регистрация
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05060a]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-cyan-400/20 bg-cyan-500/10">
              <Image src="/zd-logo.svg" alt="Zero Day" fill sizes="36px" className="object-cover" priority />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-50">Zero Day</div>
              <div className="text-xs text-cyan-200/80">Exploit Network</div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              Лендинг
            </Link>
            <Link
              href="/marketplace"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              Торговая площадка
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Sidebar */}
          <GlassCard className="p-5 md:col-span-1" glow="cyan">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-cyan-400/20 bg-cyan-500/10">
                <div className="absolute inset-0" />
                <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-cyan-100">
                  ZD
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-cyan-200/70">Аккаунт</div>
                <div className="mt-1 text-lg font-semibold text-zinc-50">{profile.handle}</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-widest text-zinc-400">Уровень</div>
              <div className="mt-2 text-sm font-semibold text-zinc-50">{profile.levelTitle}</div>
              <div className="mt-2 text-xs text-zinc-400">Риск по IP: {profile.ipRisk}</div>
              <div className="mt-1 text-xs text-zinc-400">{profile.traceback}</div>
              <div className="mt-2 text-xs text-zinc-400">
                Аккаунт создан:{" "}
                {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("ru-RU") : "—"}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-xs uppercase tracking-widest text-zinc-400">Репутация</div>
              <div className="grid grid-cols-3 gap-2">
                <Pill label="White Hat" value={String(profile.reputation.white)} />
                <Pill label="Gray Hat" value={String(profile.reputation.gray)} />
                <Pill label="Black Hat" value={String(profile.reputation.black)} />
              </div>
            </div>
          </GlassCard>

          {/* Content */}
          <div className="md:col-span-2">
            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-cyan-200/70">Личный кабинет</div>
                  <div className="mt-2 text-2xl font-semibold text-zinc-50">
                    {tab === "overview"
                      ? "Обзор"
                      : tab === "inventory"
                        ? "Инвентарь"
                        : tab === "wallet"
                          ? "Кошелёк"
                          : "Настройки"}
                  </div>
                  <p className="mt-2 text-sm text-zinc-300">
                    Заглушка UI: подключим реальные данные из игры, когда будет backend.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill label="CryptoCoin" value={`${profile.wallet.crypto}`} />
                  <Pill label="Hat Rank" value={profile.wallet.rank} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
                  Обзор
                </TabButton>
                <TabButton active={tab === "inventory"} onClick={() => setTab("inventory")}>
                  Инвентарь
                </TabButton>
                <TabButton active={tab === "wallet"} onClick={() => setTab("wallet")}>
                  Кошелёк
                </TabButton>
                <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
                  Настройки
                </TabButton>
              </div>
            </div>

            <div className="mt-4">
              <AnimatePresence mode="wait">
                {tab === "overview" ? (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="space-y-4"
                  >
                    <GlassCard className="p-5" glow="blue">
                      <div className="text-xs uppercase tracking-widest text-cyan-200/70">Текущие метрики</div>
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Pill label="Контракты" value={String(profile.stats.contracts)} />
                        <Pill label="Рейды" value={String(profile.stats.raids)} />
                        <Pill label="CTF" value={String(profile.stats.ctf)} />
                        <Pill label="Инструменты" value={String(profile.stats.tools)} />
                      </div>
                    </GlassCard>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <GlassCard className="p-5" glow="cyan">
                        <div className="text-xs uppercase tracking-widest text-cyan-200/70">Активные задания</div>
                        <div className="mt-3 space-y-3">
                          {[
                            { t: "NPC заказ: украсть данные конкурента", p: 32 },
                            { t: "CTF: еженедельный раунд (sim)", p: 64 },
                            { t: "Контракт: установить шпионское ПО (sim)", p: 18 },
                          ].map((x) => (
                            <div key={x.t} className="rounded-xl border border-white/10 bg-white/5 p-4">
                              <div className="text-sm font-semibold text-zinc-50">{x.t}</div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                                  initial={false}
                                  animate={{ width: `${x.p}%` }}
                                  transition={{ duration: 0.35 }}
                                />
                              </div>
                              <div className="mt-2 text-xs text-zinc-400">{x.p}%</div>
                            </div>
                          ))}
                        </div>
                      </GlassCard>

                      <GlassCard className="p-5" glow="emerald">
                        <div className="text-xs uppercase tracking-widest text-cyan-200/70">Traceback готовность</div>
                        <div className="mt-2 text-lg font-semibold text-zinc-50">Следы под контролем</div>
                        <p className="mt-2 text-sm text-zinc-300">
                          В реальной игре здесь будет интеграция с мини-игрой Traceback и статистикой очистки логов.
                        </p>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          {["Logs", "Proxy", "Jump"].map((x, i) => (
                            <div key={x} className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <div className="text-xs text-zinc-400">{x}</div>
                              <div className="mt-1 text-sm font-semibold text-zinc-50">{[74, 61, 88][i]}%</div>
                            </div>
                          ))}
                        </div>
                      </GlassCard>
                    </div>
                  </motion.div>
                ) : null}

                {tab === "inventory" ? (
                  <motion.div
                    key="inventory"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="space-y-4"
                  >
                    <GlassCard className="p-5" glow="cyan">
                      <div className="text-xs uppercase tracking-widest text-cyan-200/70">Ваши инструменты</div>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {[
                          { n: "Netscanner", d: "Разведка и карта сети", img: "/zd-network-map.svg" },
                          { n: "Packet Sniffer", d: "Анализ трафика", img: "/zd-traceback.svg" },
                          { n: "Exploit Framework", d: "Сборка цепочек", img: "/zd-web-builder.svg" },
                          { n: "Social Engine Toolkit", d: "Сценарии общения", img: "/zd-world.svg" },
                          { n: "Database Manager", d: "Схемы и доступ (sim)", img: "/zd-network-map.svg" },
                          { n: "Hydra", d: "Brute force сценарии (sim)", img: "/zd-web-builder.svg" },
                        ].map((x) => (
                          <div key={x.n} className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="relative h-28 overflow-hidden rounded-lg border border-white/10 bg-black/20">
                              <Image src={x.img} alt={x.n} fill className="object-cover" sizes="240px" />
                            </div>
                            <div className="mt-3 text-sm font-semibold text-zinc-50">{x.n}</div>
                            <div className="mt-2 text-xs text-zinc-300">{x.d}</div>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  </motion.div>
                ) : null}

                {tab === "wallet" ? (
                  <motion.div
                    key="wallet"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="space-y-4"
                  >
                    <GlassCard className="p-5" glow="emerald">
                      <div className="text-xs uppercase tracking-widest text-cyan-200/70">CryptoCoin</div>
                      <div className="mt-2 text-2xl font-semibold text-zinc-50">{profile.wallet.crypto}</div>
                      <p className="mt-2 text-sm text-zinc-300">
                        Заглушка: реальные транзакции подключим позже. Здесь будут начисления за контракты, CTF и продажу эксплойтов.
                      </p>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                          { k: "Входящие", v: "+ 2,340" },
                          { k: "Исходящие", v: "- 1,120" },
                          { k: "Комиссии", v: "- 40" },
                        ].map((x) => (
                          <div key={x.k} className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="text-xs text-zinc-400">{x.k}</div>
                            <div className="mt-1 text-sm font-semibold text-zinc-50">{x.v}</div>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  </motion.div>
                ) : null}

                {tab === "settings" ? (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="space-y-4"
                  >
                    <GlassCard className="p-5" glow="blue">
                      <div className="text-xs uppercase tracking-widest text-cyan-200/70">Безопасность</div>
                      <div className="mt-2 text-lg font-semibold text-zinc-50">Смена пароля</div>

                      <p className="mt-3 text-sm text-zinc-300">
                        Данные аккаунта обновляются в SQLite. Старый пароль подтверждается перед заменой.
                      </p>

                      <div className="mt-5 space-y-4">
                        <div>
                          <div className="text-xs uppercase tracking-widest text-cyan-200/70">Текущий пароль</div>
                          <input
                            type="password"
                            value={pwdCurrent}
                            onChange={(e) => setPwdCurrent(e.target.value)}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-zinc-100 outline-none focus:border-cyan-400/30"
                            placeholder="••••••••"
                            autoComplete="current-password"
                          />
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-widest text-cyan-200/70">Новый пароль</div>
                          <input
                            type="password"
                            value={pwdNew}
                            onChange={(e) => setPwdNew(e.target.value)}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-zinc-100 outline-none focus:border-cyan-400/30"
                            placeholder="Минимум 6 символов"
                            autoComplete="new-password"
                          />
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-widest text-cyan-200/70">Повтор нового пароля</div>
                          <input
                            type="password"
                            value={pwdNewConfirm}
                            onChange={(e) => setPwdNewConfirm(e.target.value)}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-zinc-100 outline-none focus:border-cyan-400/30"
                            placeholder="Повторите пароль"
                            autoComplete="new-password"
                          />
                        </div>

                        {pwdError ? (
                          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                            {pwdError}
                          </div>
                        ) : null}
                        {pwdSuccess ? (
                          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                            {pwdSuccess}
                          </div>
                        ) : null}

                        <button
                          disabled={pwdBusy}
                          onClick={() => void submitPasswordChange()}
                          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-base font-semibold text-zinc-950 hover:brightness-110 disabled:opacity-60"
                        >
                          {pwdBusy ? "Сохраняем…" : "Обновить пароль"}
                        </button>
                      </div>
                    </GlassCard>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

