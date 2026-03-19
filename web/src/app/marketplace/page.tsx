"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type LotCategory = "tools" | "scripts" | "zero-day";
type LotKind = "service" | "script" | "program" | "data";

type CategoryFilter = "all" | LotCategory | "mine";

type User = {
  id: string;
  name: string;
  hatRank: "White Hat" | "Gray Hat" | "Black Hat";
};

type Lot = {
  id: string;
  name: string;
  category: LotCategory;
  kind: LotKind;
  description: string;
  price: number;
  rating: number; // 0..5
  sellerId: string;
  sellerName: string;
  img: string;
  createdAt: number;
};

type ThreadMessage = {
  id: string;
  fromId: string;
  text: string;
  ts: number;
};

type Thread = {
  lotId: string;
  buyerId: string;
  sellerId: string;
  status: "requested" | "in_progress" | "done";
  messages: ThreadMessage[];
};

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

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating * 2) / 2;
  return (
    <div className="flex items-center gap-1 text-xs text-cyan-200/90">
      {"★★★★★".split("").map((s, i) => {
        const idx = i + 1;
        const filled = full >= idx ? 1 : full + 0.5 >= idx ? 0.5 : 0;
        return (
          <span key={s + i} className={filled ? "opacity-100" : "opacity-20"}>
            {filled === 0.5 ? "☆" : s}
          </span>
        );
      })}
      <span className="ml-1 text-zinc-400">{rating.toFixed(1)}</span>
    </div>
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#070912]/80 p-4 shadow-[0_0_80px_rgba(34,211,238,0.08)] backdrop-blur-2xl"
            initial={{ y: 16, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 14, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-cyan-200/70">Торговая площадка</div>
                <h3 className="mt-2 text-xl font-semibold text-zinc-50">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
              >
                Закрыть
              </button>
            </div>
            <div className="mt-4">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function MarketplacePage() {
  const seedLots: Lot[] = useMemo(
    () => [
      {
        id: "itm-1",
        name: "Exploit Framework: Chain Builder",
        category: "tools",
        kind: "program",
        description: "Собирай цепочки под контекст цели. Рейтинг продавца влияет на надежность.",
        price: 920,
        rating: 4.7,
        sellerId: "x1n0x",
        sellerName: "x1n0x",
        img: "/zd-web-builder.svg",
        createdAt: Date.now() - 1000 * 60 * 60 * 20,
      },
      {
        id: "itm-2",
        name: "Netscanner: Route Graph",
        category: "tools",
        kind: "program",
        description: "Граф маршрутов в песочнице: подсказки по поверхности атаки и скрытности.",
        price: 610,
        rating: 4.3,
        sellerId: "proxyghost",
        sellerName: "proxyghost",
        img: "/zd-network-map.svg",
        createdAt: Date.now() - 1000 * 60 * 60 * 50,
      },
      {
        id: "itm-3",
        name: "Web Script: Drag&Drop Payload",
        category: "scripts",
        kind: "script",
        description: "Набор скриптов для веб-модулей конструктора. Визуально быстрый старт.",
        price: 420,
        rating: 4.1,
        sellerId: "bento.dev",
        sellerName: "bento.dev",
        img: "/zd-hero-screen.svg",
        createdAt: Date.now() - 1000 * 60 * 60 * 8,
      },
      {
        id: "itm-4",
        name: "Zero-Day (одноразовый): Onion Bait",
        category: "zero-day",
        kind: "data",
        description: "Редкий одноразовый эксплойт (в механике игры). Высокая цена и высокий риск.",
        price: 14850,
        rating: 4.9,
        sellerId: "darkmarket-npc",
        sellerName: "darkmarket-npc",
        img: "/zd-darkweb.svg",
        createdAt: Date.now() - 1000 * 60 * 60 * 110,
      },
      {
        id: "itm-5",
        name: "Packet Sniffer: Traffic Lens",
        category: "tools",
        kind: "program",
        description: "Перехват и анализ трафика (sim). Лучше понимать следы и реакцию IDS/IPS.",
        price: 780,
        rating: 4.4,
        sellerId: "trace/clean",
        sellerName: "trace/clean",
        img: "/zd-traceback.svg",
        createdAt: Date.now() - 1000 * 60 * 60 * 30,
      },
      {
        id: "itm-6",
        name: "Social Engine Toolkit: Whisper Roles",
        category: "scripts",
        kind: "service",
        description: "Сценарии общения для роли/репутации и приватных каналов.",
        price: 560,
        rating: 4.0,
        sellerId: "kisscord",
        sellerName: "kisscord",
        img: "/zd-world.svg",
        createdAt: Date.now() - 1000 * 60 * 60 * 16,
      },
    ],
    []
  );

  const router = useRouter();
  const { data: session, status } = useSession();

  const user: User | null =
    status === "authenticated" && session?.user
      ? {
          id: session.user.id,
          name: session.user.name ?? "operator",
          hatRank: session.user.hatRank as User["hatRank"],
        }
      : null;

  const authorized = status === "authenticated" && !!user;

  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Lot | null>(null);
  const [lots, setLots] = useState<Lot[]>(seedLots);
  const [threads, setThreads] = useState<Record<string, Thread>>({});

  const [createOpen, setCreateOpen] = useState(false);

  const [chatText, setChatText] = useState("");

  const [draft, setDraft] = useState<{
    name: string;
    category: LotCategory;
    kind: LotKind;
    price: number;
    description: string;
    img: string;
  }>({
    name: "",
    category: "tools",
    kind: "service",
    price: 0,
    description: "",
    img: "/zd-web-builder.svg",
  });

  const [createError, setCreateError] = useState<string | null>(null);

  const activeThread = selected ? threads[selected.id] : undefined;
  const isSeller = !!(selected && user && selected.sellerId === user.id);
  const canChat =
    !!(
      activeThread &&
      user &&
      (activeThread.buyerId === user.id || activeThread.sellerId === user.id)
    );
  const statusLabel =
    activeThread?.status === "requested"
      ? "Запрошено"
      : activeThread?.status === "in_progress"
        ? "В процессе"
        : activeThread?.status === "done"
          ? "Готово"
          : "—";

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const activeThreadMessagesLength = activeThread?.messages.length ?? 0;
  useEffect(() => {
    if (activeThreadMessagesLength === 0) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThreadMessagesLength]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lots.filter((it) => {
      const catOk =
        category === "all"
          ? true
          : category === "mine"
            ? !!user && it.sellerId === user.id
            : it.category === category;

      const hay = (it.name + " " + it.description + " " + it.sellerName).toLowerCase();
      const qOk = !q ? true : hay.includes(q);

      return catOk && qOk;
    });
  }, [lots, category, query, user]);

  const requestDeal = () => {
    if (!selected || !user) return;
    if (selected.sellerId === user.id) return;

    setThreads((prev) => {
      if (prev[selected.id]) return prev;
      const now = Date.now();
      const newThread: Thread = {
        lotId: selected.id,
        buyerId: user.id,
        sellerId: selected.sellerId,
        status: "requested",
        messages: [
          {
            id: `m-${now}`,
            fromId: user.id,
            text: "Запрос сделки создан (sim). Обсудим детали здесь.",
            ts: now,
          },
        ],
      };
      return { ...prev, [selected.id]: newThread };
    });
  };

  const sendMessage = () => {
    if (!selected || !user) return;
    const thread = threads[selected.id];
    if (!thread) return;

    const text = chatText.trim();
    if (!text) return;

    const now = Date.now();
    setThreads((prev) => {
      const t = prev[selected.id];
      if (!t) return prev;
      return {
        ...prev,
        [selected.id]: {
          ...t,
          status:
            user.id === t.sellerId
              ? "in_progress"
              : t.status === "requested"
                ? "requested"
                : t.status,
          messages: [
            ...t.messages,
            { id: `m-${now}-${Math.random().toString(16).slice(2)}`, fromId: user.id, text, ts: now },
          ],
        },
      };
    });
    setChatText("");
  };

  const sendDemoSellerReply = () => {
    if (!selected || !user) return;
    const thread = threads[selected.id];
    if (!thread) return;
    if (user.id !== thread.sellerId) return;

    const now = Date.now();
    setThreads((prev) => {
      const t = prev[selected.id];
      if (!t) return prev;
      return {
        ...prev,
        [selected.id]: {
          ...t,
          status: "in_progress",
          messages: [
            ...t.messages,
            {
              id: `m-${now}-${Math.random().toString(16).slice(2)}`,
              fromId: user.id,
              text: "Ок, детали приняты. Делаем “в рамках симуляции”.",
              ts: now,
            },
          ],
        },
      };
    });
  };

  const submitCreateLot = () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    const name = draft.name.trim();
    const desc = draft.description.trim();
    const price = Number(draft.price);
    if (!name || !desc || !Number.isFinite(price) || price <= 0) return;

    const now = Date.now();
    const newLot: Lot = {
      id: `lot-${now}-${Math.random().toString(16).slice(2)}`,
      name,
      category: draft.category,
      kind: draft.kind,
      description: desc,
      price,
      rating: 0,
      sellerId: user.id,
      sellerName: user.name,
      img: draft.img,
      createdAt: now,
    };

    setLots((prev) => [newLot, ...prev]);
    setCreateOpen(false);
    setCategory("mine");
    setSelected(newLot);
    setDraft({
      name: "",
      category: "tools",
      kind: "service",
      price: 0,
      description: "",
      img: "/zd-web-builder.svg",
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05060a]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-cyan-400/20 bg-cyan-500/10">
              <Image src="/zd-logo.svg" alt="Zero Day" fill sizes="36px" className="object-cover" priority />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-50">Zero Day</div>
              <div className="text-xs text-cyan-200/80">Marketplace</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              Лендинг
            </Link>
            <Link
              href="/account"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              Личный кабинет
            </Link>
            </nav>

            {authorized ? (
              <button
                onClick={() => signOut({ callbackUrl: "/marketplace" })}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
                aria-label="Выйти"
              >
                {user?.name}
              </button>
            ) : (
              <button
                onClick={() => router.push("/auth/login")}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
              >
                Войти
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Controls */}
          <GlassCard className="p-5 md:col-span-1" glow="blue">
            <div className="text-xs uppercase tracking-widest text-cyan-200/70">Поиск</div>
            <div className="mt-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Например: netscanner, zero-day, продавец…"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-cyan-400/30"
              />
            </div>

            <div className="mt-4 text-xs uppercase tracking-widest text-cyan-200/70">Категории</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  { k: "all", t: "Все" },
                  { k: "tools", t: "Инструменты" },
                  { k: "scripts", t: "Скрипты" },
                  { k: "zero-day", t: "Zero-Day" },
                  { k: "mine", t: "Мои лоты" },
                ] as Array<{ k: CategoryFilter; t: string }>
              ).map((x) => (
                <button
                  key={x.k}
                  onClick={() => {
                    if (x.k === "mine" && !authorized) {
                      router.push("/auth/login");
                      return;
                    }
                    setCategory(x.k);
                  }}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm transition",
                    category === x.k
                      ? "border-cyan-400/35 bg-cyan-500/15 text-cyan-100"
                      : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
                  ].join(" ")}
                >
                  {x.t}
                </button>
              ))}
            </div>

            {authorized ? (
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-base font-semibold text-zinc-950 shadow-[0_0_40px_rgba(34,211,238,0.08)] hover:brightness-110"
              >
                Создать лот
              </button>
            ) : (
              <button
                onClick={() => router.push("/auth/login")}
                className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base font-semibold text-zinc-200 hover:bg-white/10"
              >
                Войти, чтобы создавать лоты
              </button>
            )}
          </GlassCard>

          {/* List */}
          <div className="md:col-span-2">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <div>
                <div className="text-xs uppercase tracking-widest text-cyan-200/70">Торговая площадка</div>
                <div className="mt-2 text-2xl font-semibold text-zinc-50">
                  {category === "all"
                    ? "Каталог"
                    : category === "mine"
                      ? authorized
                        ? "Мои лоты"
                        : "Мои лоты (требуется вход)"
                      : category === "tools"
                        ? "Инструменты"
                        : category === "scripts"
                          ? "Скрипты"
                          : "Zero-Day"}
                </div>
                <p className="mt-2 text-base text-zinc-300">
                  {visible.length} позиций · рейтинг/отзывы (плейсхолдеры) · сделка: запрос → чат (sim)
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                <span>Фильтр по категории</span>
                <span>·</span>
                <span>Поиск по названию/описанию/продавцу</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((it, idx) => (
                <motion.div
                  key={it.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    delay: idx * 0.01,
                    duration: 0.45,
                    ease: "easeOut",
                  }}
                >
                  <GlassCard className="h-full p-6" glow={it.category === "zero-day" ? "emerald" : it.category === "tools" ? "cyan" : "blue"}>
                    <div className="relative h-44 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      <Image src={it.img} alt={it.name} fill className="object-cover" sizes="320px" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-transparent opacity-70" />
                    </div>

                    <div className="mt-4 text-lg font-semibold text-zinc-50">{it.name}</div>
                    <div className="mt-3 text-base leading-relaxed text-zinc-300">{it.description}</div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-sm uppercase tracking-widest text-cyan-200/70">
                        {it.category === "zero-day"
                          ? "Zero-Day"
                          : it.category === "tools"
                            ? "Tool"
                            : "Script"}
                      </div>
                      <div className="text-base font-semibold text-zinc-50">{it.price} CryptoCoin</div>
                    </div>

                    <div className="mt-2">
                      <Stars rating={it.rating} />
                      <div className="mt-1 text-sm text-zinc-400">Продавец: {it.sellerName}</div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setSelected(it)}
                        className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-base font-semibold text-zinc-950 shadow-[0_0_40px_rgba(34,211,238,0.10)] hover:brightness-110"
                      >
                        Открыть лот
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Modal
        open={!!selected}
        title={selected ? selected.name : ""}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                  <Image
                    src={selected.img}
                    alt={selected.name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-50">{selected.sellerName}</div>
                  <div className="mt-1">
                    <Stars rating={selected.rating} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200">
                  {selected.price} CryptoCoin
                </span>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
                  {selected.category === "zero-day"
                    ? "Zero-Day"
                    : selected.category === "tools"
                      ? "Инструмент"
                      : "Скрипт"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200">
                  Статус: {statusLabel}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                    О лоте
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    {selected.description}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs text-zinc-400">Тип</div>
                      <div className="mt-1 text-sm font-semibold text-zinc-50">
                        {selected.kind === "service"
                          ? "Услуга"
                          : selected.kind === "script"
                            ? "Скрипт"
                            : selected.kind === "program"
                              ? "Программа"
                              : "Информация"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs text-zinc-400">Escrow (sim)</div>
                      <div className="mt-1 text-sm font-semibold text-zinc-50">
                        {activeThread ? "Locked" : "Free"}
                      </div>
                    </div>
                  </div>

                  {authorized ? (
                    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">
                      Вы вошли как <span className="text-zinc-50 font-semibold">{user.name}</span> ({user.hatRank}).
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                    Сделка и чат
                  </div>

                  {!authorized ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
                      Войдите, чтобы запрашивать сделку и общаться между покупателем и продавцом.
                      <div className="mt-3">
                        <button
                          onClick={() => router.push("/auth/login")}
                          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-zinc-950 hover:brightness-110"
                        >
                          Войти (sim)
                        </button>
                      </div>
                    </div>
                  ) : activeThread ? (
                    <>
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-sm font-semibold text-zinc-50">
                          Чат активен
                        </div>
                        <div className="text-xs text-zinc-400">
                          {activeThread.buyerId === user.id ? "Вы — покупатель" : "Вы — продавец"}
                        </div>
                      </div>

                      <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="space-y-2">
                          {activeThread.messages.map((m) => {
                            const mine = m.fromId === user.id;
                            return (
                              <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                                <div
                                  className={
                                    mine
                                      ? "max-w-[85%] rounded-xl bg-gradient-to-r from-cyan-500/25 to-blue-600/25 border border-cyan-400/25 p-3 text-sm text-zinc-100"
                                      : "max-w-[85%] rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-zinc-200"
                                  }
                                >
                                  <div className="text-xs text-zinc-400">
                                    {mine ? "Вы" : "Собеседник"} ·{" "}
                                    {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                  <div className="mt-1 whitespace-pre-wrap">{m.text}</div>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={chatEndRef} />
                        </div>
                      </div>

                      {canChat ? (
                        <div className="mt-3 flex gap-2">
                          <input
                            value={chatText}
                            onChange={(e) => setChatText(e.target.value)}
                            placeholder="Сообщение (sim)…"
                            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-cyan-400/30"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") sendMessage();
                            }}
                          />
                          <button
                            onClick={sendMessage}
                            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-zinc-950 hover:brightness-110"
                          >
                            Отправить
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-zinc-400">
                          Нет доступа к чату для вашей роли в этой сделке.
                        </div>
                      )}

                      {isSeller ? (
                        <div className="mt-3">
                          <button
                            onClick={sendDemoSellerReply}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/10"
                          >
                            Быстрый ответ (sim)
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : isSeller ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
                      У вас лот этого продавца. Пока покупатель не оформил сделку — чата нет.
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
                      Запрос сделки создаст “escrow” и откроет чат для обсуждения деталей между покупателем и продавцом.
                      <div className="mt-3">
                        <button
                          onClick={requestDeal}
                          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-zinc-950 hover:brightness-110"
                        >
                          Запросить сделку (sim)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Create lot modal */}
      <Modal
        open={createOpen}
        title="Создать лот (sim)"
        onClose={() => setCreateOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
            Вы станете продавцом. Покупатель сможет отправить запрос и общаться в чате сделки.
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">Название</div>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-cyan-400/30"
                placeholder="например: Exploit Payload v2"
              />
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">Цена (CryptoCoin)</div>
              <input
                value={draft.price}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, price: Number(e.target.value) }))
                }
                type="number"
                min={0}
                step={1}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-cyan-400/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">Категория</div>
              <select
                value={draft.category}
                onChange={(e) => {
                  const category = e.target.value as LotCategory;
                  const imgByCat: Record<LotCategory, string> = {
                    tools: "/zd-web-builder.svg",
                    scripts: "/zd-hero-screen.svg",
                    "zero-day": "/zd-darkweb.svg",
                  };
                  setDraft((d) => ({ ...d, category, img: imgByCat[category] }));
                }}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-cyan-400/30"
              >
                <option value="tools">Инструменты</option>
                <option value="scripts">Скрипты</option>
                <option value="zero-day">Zero-Day</option>
              </select>
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">Тип</div>
              <select
                value={draft.kind}
                onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as LotKind }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-cyan-400/30"
              >
                <option value="service">Услуга</option>
                <option value="script">Скрипт</option>
                <option value="program">Программа</option>
                <option value="data">Информация</option>
              </select>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-cyan-200/70">Описание</div>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              className="mt-2 min-h-[120px] w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-cyan-400/30"
              placeholder="Что получит покупатель? Какой эффект в игре? (sim)"
            />
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <Image src={draft.img} alt="Preview" fill className="object-cover" sizes="56px" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-50">Предпросмотр лота</div>
              <div className="text-xs text-zinc-400">
                {draft.category} · {draft.kind}
              </div>
            </div>
          </div>

          <button
            onClick={submitCreateLot}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-zinc-950 hover:brightness-110"
          >
            Создать лот (sim)
          </button>
        </div>
      </Modal>
    </div>
  );
}

