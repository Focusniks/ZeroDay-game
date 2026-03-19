"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AppHeader from "@/components/ui/AppHeader";
import Select from "@/components/ui/Select";

type LotCategory = "tools" | "scripts" | "zero-day";
type LotKind = "service" | "script" | "program" | "data";

type CategoryFilter = "all" | LotCategory | "mine";
type ViewTab = "catalog" | "my-lots" | "my-deals";
type SortOption = "newest" | "price_asc" | "price_desc" | "rating";

type User = {
  id: string;
  name: string;
  hatRank: "White Hat" | "Gray Hat" | "Black Hat";
  accessToken: string;
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
  id: string;
  lotId: string;
  buyerId: string;
  sellerId: string;
  status: "requested" | "in_progress" | "done";
  messages: ThreadMessage[];
};

type DealMeta = {
  threadId: string;
  status: Thread["status"];
  role: "buyer" | "seller";
};

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: "newest", label: "Сначала новые" },
  { value: "price_asc", label: "Цена: по возрастанию" },
  { value: "price_desc", label: "Цена: по убыванию" },
  { value: "rating", label: "Рейтинг: высокий" },
];

const lotCategoryOptions: Array<{ value: LotCategory; label: string }> = [
  { value: "tools", label: "Инструменты" },
  { value: "scripts", label: "Скрипты" },
  { value: "zero-day", label: "Zero-Day" },
];

const lotKindOptions: Array<{ value: LotKind; label: string }> = [
  { value: "service", label: "Услуга" },
  { value: "script", label: "Скрипт" },
  { value: "program", label: "Программа" },
  { value: "data", label: "Информация" },
];

const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ?? process.env.BACKEND_HTTP_URL ?? "http://127.0.0.1:8000";

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

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="h-44 rounded-xl border border-white/10 bg-white/10" />
      <div className="mt-4 h-5 w-2/3 rounded bg-white/10" />
      <div className="mt-3 h-4 w-full rounded bg-white/10" />
      <div className="mt-2 h-4 w-5/6 rounded bg-white/10" />
      <div className="mt-4 h-9 w-full rounded-xl bg-white/10" />
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
  const router = useRouter();
  const { data: session, status } = useSession();

  const user: User | null = useMemo(
    () =>
      status === "authenticated" && session?.user
        ? {
            id: session.user.id,
            name: session.user.name ?? "operator",
            hatRank: session.user.hatRank as User["hatRank"],
            accessToken: ((session.user as any).accessToken ?? "") as string,
          }
        : null,
    [session?.user, status]
  );

  const authorized = status === "authenticated" && !!user;

  const [viewTab, setViewTab] = useState<ViewTab>("catalog");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [selected, setSelected] = useState<Lot | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [dealMetaByLotId, setDealMetaByLotId] = useState<Record<string, DealMeta>>({});
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [loadingLots, setLoadingLots] = useState(false);
  const [lotsError, setLotsError] = useState<string | null>(null);
  const [limit] = useState(12);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);

  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [threadLastSyncAt, setThreadLastSyncAt] = useState<number | null>(null);

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
  const [threadBusy, setThreadBusy] = useState(false);
  const isSeller = !!(selected && user && selected.sellerId === user.id);
  const canChat =
    !!(
      activeThread &&
      user &&
      (activeThread.buyerId === user.id || activeThread.sellerId === user.id)
    );
  const statusLabel = (status: Thread["status"] | undefined) =>
    status === "requested" ? "Запрошено" : status === "in_progress" ? "В процессе" : status === "done" ? "Готово" : "—";

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const activeThreadMessagesLength = activeThread?.messages.length ?? 0;
  useEffect(() => {
    if (activeThreadMessagesLength === 0) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThreadMessagesLength]);

  const loadLots = useCallback(async () => {
    setLoadingLots(true);
    setLotsError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (category !== "all" && category !== "mine") params.set("category", category);
      params.set("sort", sort);
      params.set("limit", String(limit));
      params.set("offset", String(offset));

      const endpoint =
        viewTab === "my-lots"
          ? `${backendBaseUrl}/marketplace/my/lots?${params.toString()}`
          : viewTab === "my-deals"
            ? `${backendBaseUrl}/marketplace/my/deals?${params.toString()}`
            : `${backendBaseUrl}/marketplace/lots?${params.toString()}`;

      const headers: Record<string, string> = {};
      if ((viewTab === "my-lots" || viewTab === "my-deals") && user?.accessToken) {
        headers.Authorization = `Bearer ${user.accessToken}`;
      }
      const response = await fetch(endpoint, { headers });
      const data = (await response.json()) as any;
      if (!response.ok || !data?.ok) {
        setLotsError(data?.error ?? "Не удалось загрузить лоты");
        return;
      }

      if (viewTab === "my-deals") {
        const deals = (data?.page?.deals ?? []) as Array<{
          thread_id: string;
          status: Thread["status"];
          role: "buyer" | "seller";
          lot: {
            id: string;
            name: string;
            category: LotCategory;
            kind: LotKind;
            description: string;
            price: number;
            rating: number;
            seller_id: string;
            seller_name: string;
            img: string;
            created_at: number;
          };
        }>;
        const nextDealMeta: Record<string, DealMeta> = {};
        const nextLots = deals.map((d) => {
          nextDealMeta[d.lot.id] = { threadId: d.thread_id, status: d.status, role: d.role };
          return {
            id: d.lot.id,
            name: d.lot.name,
            category: d.lot.category,
            kind: d.lot.kind,
            description: d.lot.description,
            price: d.lot.price,
            rating: d.lot.rating,
            sellerId: d.lot.seller_id,
            sellerName: d.lot.seller_name,
            img: d.lot.img,
            createdAt: d.lot.created_at,
          };
        });
        setDealMetaByLotId(nextDealMeta);
        setLots(nextLots);
        setTotal(Number(data?.page?.total ?? nextLots.length));
      } else {
        const pageLots = (data?.page?.lots ?? []) as Array<{
          id: string;
          name: string;
          category: LotCategory;
          kind: LotKind;
          description: string;
          price: number;
          rating: number;
          seller_id: string;
          seller_name: string;
          img: string;
          created_at: number;
        }>;
        setDealMetaByLotId({});
        setLots(
          pageLots.map((x) => ({
            id: x.id,
            name: x.name,
            category: x.category,
            kind: x.kind,
            description: x.description,
            price: x.price,
            rating: x.rating,
            sellerId: x.seller_id,
            sellerName: x.seller_name,
            img: x.img,
            createdAt: x.created_at,
          }))
        );
        setTotal(Number(data?.page?.total ?? pageLots.length));
      }
    } catch {
      setLotsError("Сервер недоступен");
    } finally {
      setLoadingLots(false);
    }
  }, [category, limit, offset, query, sort, user?.accessToken, viewTab]);

  const loadThread = useCallback(async (lotId: string, options?: { silent?: boolean }) => {
    if (!user?.accessToken) {
      setActiveThread(null);
      return;
    }
    if (!options?.silent) {
      setThreadBusy(true);
    }
    try {
      const response = await fetch(`${backendBaseUrl}/marketplace/lots/${lotId}/thread`, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      const data = (await response.json()) as {
        ok?: boolean;
        thread?: {
          id: string;
          lot_id: string;
          buyer_id: string;
          seller_id: string;
          status: Thread["status"];
          messages: Array<{ id: string; from_id: string; text: string; ts: number }>;
        } | null;
      };
      if (!response.ok || !data?.ok) {
        setActiveThread(null);
        return;
      }
      if (!data.thread) {
        setActiveThread(null);
        return;
      }
      setActiveThread({
        id: data.thread.id,
        lotId: data.thread.lot_id,
        buyerId: data.thread.buyer_id,
        sellerId: data.thread.seller_id,
        status: data.thread.status,
        messages: data.thread.messages.map((m) => ({
          id: m.id,
          fromId: m.from_id,
          text: m.text,
          ts: m.ts,
        })),
      });
      setThreadLastSyncAt(Date.now());
    } finally {
      if (!options?.silent) {
        setThreadBusy(false);
      }
    }
  }, [user?.accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLots();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadLots]);

  useEffect(() => {
    if (!selected?.id) return;
    void loadThread(selected.id);
  }, [selected?.id, loadThread]);

  useEffect(() => {
    if (!selected?.id || !activeThread || !user?.accessToken) return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadThread(selected.id, { silent: true });
    }, 4000);
    return () => window.clearInterval(intervalId);
  }, [activeThread, loadThread, selected?.id, user?.accessToken]);

  const visible = useMemo(() => {
    return lots;
  }, [lots]);

  const requestDeal = () => {
    if (!selected || !user?.accessToken) return;
    if (selected.sellerId === user.id) return;

    void (async () => {
      await fetch(`${backendBaseUrl}/marketplace/lots/${selected.id}/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.accessToken}`,
        },
      });
      await loadThread(selected.id);
    })();
  };

  const sendMessage = () => {
    if (!selected || !user?.accessToken || !activeThread) return;

    const text = chatText.trim();
    if (!text) return;

    void (async () => {
      setChatSending(true);
      try {
        await fetch(`${backendBaseUrl}/marketplace/lots/${selected.id}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.accessToken}`,
          },
          body: JSON.stringify({ text }),
        });
        setChatText("");
        await loadThread(selected.id);
      } finally {
        setChatSending(false);
      }
    })();
  };

  const sendDemoSellerReply = () => {
    if (!selected || !user || !activeThread || user.id !== activeThread.sellerId) return;
    setChatText("Ок, детали приняты. Начинаем выполнение.");
    setTimeout(sendMessage, 0);
  };

  const submitCreateLot = async () => {
    if (!user?.accessToken) {
      router.push("/auth/login");
      return;
    }
    const name = draft.name.trim();
    const desc = draft.description.trim();
    const price = Number(draft.price);
    if (!name || !desc || !Number.isFinite(price) || price <= 0) {
      setCreateError("Заполни название, описание и корректную цену");
      return;
    }

    setCreateError(null);
    const response = await fetch(`${backendBaseUrl}/marketplace/lots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.accessToken}`,
      },
      body: JSON.stringify({
        name,
        category: draft.category,
        kind: draft.kind,
        description: desc,
        price,
        img: draft.img,
      }),
    });
    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !data?.ok) {
      setCreateError(data?.error ?? "Не удалось создать лот");
      return;
    }

    await loadLots();
    setCreateOpen(false);
    setCategory("mine");
    setDraft({
      name: "",
      category: "tools",
      kind: "service",
      price: 0,
      description: "",
      img: "/zd-web-builder.svg",
    });
  };

  useEffect(() => {
    setOffset(0);
  }, [viewTab, category, query, sort]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AppHeader
        subtitle="Marketplace"
        nav={[
          { href: "/", label: "Главная" },
          { href: "/account", label: "Личный кабинет" },
        ]}
      />

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

            <div className="mt-4 text-xs uppercase tracking-widest text-cyan-200/70">Сортировка</div>
            <div className="mt-3">
              <Select
                value={sort}
                onChange={(value) => setSort(value as SortOption)}
                options={sortOptions}
              />
            </div>

            <div className="mt-4 text-xs uppercase tracking-widest text-cyan-200/70">Раздел</div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {[
                { key: "catalog", label: "Каталог" },
                { key: "my-lots", label: "Мои лоты" },
                { key: "my-deals", label: "Мои сделки" },
              ].map((x) => (
                <button
                  key={x.key}
                  onClick={() => {
                    if (!authorized && x.key !== "catalog") {
                      router.push("/auth/login");
                      return;
                    }
                    setViewTab(x.key as ViewTab);
                  }}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm transition text-left",
                    viewTab === x.key
                      ? "border-cyan-400/35 bg-cyan-500/15 text-cyan-100"
                      : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
                  ].join(" ")}
                >
                  {x.label}
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
                  {viewTab === "my-deals"
                    ? "Мои сделки"
                    : category === "all"
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
                  {visible.length} из {total} · backend API · серверный поиск и фильтры
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                <span>Фильтр по категории</span>
                <span>·</span>
                <span>Поиск по названию/описанию/продавцу</span>
                <span>·</span>
                <span>Сортировка на сервере</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {loadingLots ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={`skeleton-${i}`} />)
              ) : null}
              {lotsError ? (
                <div className="col-span-full rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                  {lotsError}
                </div>
              ) : null}
              {!loadingLots && !lotsError && visible.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                  Лоты не найдены. Создай первый.
                </div>
              ) : null}
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
                  <GlassCard className="h-full p-5" glow={it.category === "zero-day" ? "emerald" : it.category === "tools" ? "cyan" : "blue"}>
                    <div className="relative h-44 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      <Image src={it.img} alt={it.name} fill className="object-cover" sizes="320px" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-transparent opacity-70" />
                    </div>

                    <div className="mt-4 line-clamp-1 text-lg font-semibold text-zinc-50">{it.name}</div>
                    <div className="mt-3 text-sm leading-relaxed text-zinc-300">{it.description}</div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-sm uppercase tracking-widest text-cyan-200/70">
                        {it.category === "zero-day"
                          ? "Zero-Day"
                          : it.category === "tools"
                            ? "Tool"
                            : "Script"}
                      </div>
                      <div className="text-sm font-semibold text-zinc-50">{it.price} CryptoCoin</div>
                    </div>
                    {dealMetaByLotId[it.id] ? (
                      <div className="mt-2 text-xs text-cyan-200/80">
                        Сделка: {statusLabel(dealMetaByLotId[it.id].status)} · роль: {dealMetaByLotId[it.id].role}
                      </div>
                    ) : null}

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
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
              <button
                onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
                disabled={offset <= 0}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-zinc-200 disabled:opacity-40"
              >
                Назад
              </button>
              <div className="text-zinc-300">
                Страница {Math.floor(offset / limit) + 1} / {Math.max(1, Math.ceil(total / limit))}
              </div>
              <button
                onClick={() => setOffset((prev) => (prev + limit < total ? prev + limit : prev))}
                disabled={offset + limit >= total}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-zinc-200 disabled:opacity-40"
              >
                Далее
              </button>
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
                  Статус: {statusLabel(activeThread?.status)}
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                      Сделка и чат
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {threadLastSyncAt ? `Обновлено ${new Date(threadLastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Синхронизация..."}
                    </div>
                  </div>
                  {threadBusy ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">Загружаем историю сделки...</div>
                  ) : null}

                  {!authorized ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
                      Войдите, чтобы запрашивать сделку и общаться между покупателем и продавцом.
                      <div className="mt-3">
                        <button
                          onClick={() => router.push("/auth/login")}
                          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-zinc-950 hover:brightness-110"
                        >
                          Войти
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

                      <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3">
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
                            placeholder="Сообщение…"
                            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-cyan-400/30"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !chatSending) sendMessage();
                            }}
                          />
                          <button
                            onClick={sendMessage}
                            disabled={chatSending}
                            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-zinc-950 hover:brightness-110 disabled:opacity-60"
                          >
                            {chatSending ? "Отправка..." : "Отправить"}
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
                      Запрос сделки откроет чат для обсуждения деталей между покупателем и продавцом.
                      <div className="mt-3">
                        <button
                          onClick={requestDeal}
                          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-zinc-950 hover:brightness-110"
                        >
                          Запросить сделку
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
        title="Создать лот"
        onClose={() => setCreateOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
            Вы станете продавцом. Покупатель сможет отправить запрос и общаться в чате сделки.
          </div>
          {createError ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{createError}</div>
          ) : null}

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
              <Select
                value={draft.category}
                onChange={(value) => {
                  const category = value as LotCategory;
                  const imgByCat: Record<LotCategory, string> = {
                    tools: "/zd-web-builder.svg",
                    scripts: "/zd-hero-screen.svg",
                    "zero-day": "/zd-darkweb.svg",
                  };
                  setDraft((d) => ({ ...d, category, img: imgByCat[category] }));
                }}
                options={lotCategoryOptions}
                className="mt-2"
              />
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">Тип</div>
              <Select
                value={draft.kind}
                onChange={(value) => setDraft((d) => ({ ...d, kind: value as LotKind }))}
                options={lotKindOptions}
                className="mt-2"
              />
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
            Создать лот
          </button>
        </div>
      </Modal>
    </div>
  );
}

