"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

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
      <main className="relative z-10 mx-auto flex max-w-2xl flex-col gap-6 px-4 py-14">
        <div className="rounded-2xl border border-white/10 bg-[#070912]/60 p-6 backdrop-blur-xl">
          <div className="text-xs uppercase tracking-widest text-cyan-200/70">
            Authorization
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-50">
            Вход в Marketplace
          </h1>
          <p className="mt-3 text-sm text-zinc-300">
            Реальная авторизация (Credentials) — данные хранятся в SQLite.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                Никнейм
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-cyan-400/30"
                placeholder="Например: proxyghost"
                autoComplete="username"
              />
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                Пароль
              </div>
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
              {loading ? "Проверяем…" : "Войти"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-zinc-400">
            <div>
              Нет аккаунта?{" "}
              <a className="text-cyan-200 hover:underline" href="/auth/register">
                Регистрация
              </a>
            </div>
            {mode ? <div className="text-xs">{mode}</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-screen">
          <main className="relative z-10 mx-auto flex max-w-2xl flex-col gap-6 px-4 py-14">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                Loading
              </div>
              <div className="mt-3 text-base text-zinc-300">Подгружаем параметры…</div>
            </div>
          </main>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

