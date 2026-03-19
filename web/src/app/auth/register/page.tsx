"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [hatRank, setHatRank] = useState("Gray Hat");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password !== passwordConfirm) {
      setLoading(false);
      setError("Пароли не совпадают");
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password, passwordConfirm, hatRank }),
    });

    const data = (await res.json()) as { error?: string; ok?: boolean };
    setLoading(false);

    if (!res.ok || !data?.ok) {
      setError(data?.error ?? "Ошибка регистрации");
      return;
    }

    router.push("/auth/login");
  };

  return (
    <div className="relative min-h-screen">
      <main className="relative z-10 mx-auto flex max-w-2xl flex-col gap-6 px-4 py-14">
        <div className="rounded-2xl border border-white/10 bg-[#070912]/60 p-6 backdrop-blur-xl">
          <div className="text-xs uppercase tracking-widest text-cyan-200/70">
            Authorization
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-50">
            Регистрация
          </h1>
          <p className="mt-3 text-sm text-zinc-300">
            Данные пользователя хранятся в SQLite (dev.db).
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
                placeholder="Например: darkmarket-npc"
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
                placeholder="Минимум 6 символов"
                autoComplete="new-password"
              />
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                Повтор пароля
              </div>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-cyan-400/30"
                placeholder="Повторите пароль"
                autoComplete="new-password"
              />
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-cyan-200/70">
                Hat Rank
              </div>
              <select
                value={hatRank}
                onChange={(e) => setHatRank(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-zinc-100 outline-none focus:border-cyan-400/30"
              >
                <option>White Hat</option>
                <option>Gray Hat</option>
                <option>Black Hat</option>
              </select>
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
              {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
            </button>
          </form>

          <div className="mt-4 text-sm text-zinc-400">
            Уже есть аккаунт?{" "}
            <a className="text-cyan-200 hover:underline" href="/auth/login">
              Войти
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

