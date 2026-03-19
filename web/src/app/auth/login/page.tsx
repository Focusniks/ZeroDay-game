"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import AppHeader from "@/components/ui/AppHeader";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mode = searchParams?.get("mode");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", {
      name,
      password,
      redirect: false,
    });

    setLoading(false);

    if (!res || !res.ok) {
      setError("Неверный логин или пароль");
      return;
    }

    router.push("/marketplace");
  };

  return (
    <div className="relative min-h-screen">
      <AppHeader subtitle="Unified Auth" nav={[{ href: "/", label: "Главная" }, { href: "/marketplace", label: "Marketplace" }]} />

      <main className="relative z-10 mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 py-10 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-[#070912]/55 p-6 shadow-[0_0_60px_rgba(34,211,238,0.08)] backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Authorization</div>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-50">Единый вход</h1>
          <p className="mt-3 text-sm text-zinc-300">
            Авторизация подключена к единому backend API и общей базе аккаунтов.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Логин или Email</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-cyan-400/30"
                placeholder="Например: proxyghost или you@mail.com"
                autoComplete="username"
              />
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Пароль</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-cyan-400/30"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <button
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-base font-semibold text-zinc-950 hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Проверяем…" : "Войти в систему"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-zinc-400">
            <div>Регистрация через сайт отключена.</div>
            {mode ? <div className="rounded-full border border-cyan-400/20 px-2 py-1 text-[11px]">{mode}</div> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#070912]/40 p-6 shadow-[0_0_50px_rgba(59,130,246,0.06)] backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Информация</div>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Как это работает</h2>
          <div className="mt-4 space-y-3">
            {[
              "Один аккаунт для всех интерфейсов и сервисов.",
              "Данные профиля и сессии берутся из backend.",
              "Нет отдельной регистрации в web-версии.",
            ].map((x) => (
              <div key={x} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-300">
                {x}
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">
            Если нет доступа, обратись к администратору Zero Day для создания учётной записи.
          </div>
        </section>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-screen">
          <AppHeader subtitle="Unified Auth" nav={[{ href: "/", label: "Главная" }, { href: "/marketplace", label: "Marketplace" }]} />
          <main className="relative z-10 mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 py-10 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#070912]/55 p-6 backdrop-blur-xl">
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                Loading
              </div>
              <div className="mt-3 text-base text-zinc-300">Подгружаем параметры…</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#070912]/40 p-6 backdrop-blur-xl">
              <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
              <div className="mt-4 h-4 w-full animate-pulse rounded bg-white/10" />
              <div className="mt-2 h-4 w-11/12 animate-pulse rounded bg-white/10" />
            </div>
          </main>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

