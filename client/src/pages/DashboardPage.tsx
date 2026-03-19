import { useAuth } from "../hooks/useAuth";

function TitleBarDots() {
  return (
    <div className="flex gap-2">
      <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
      <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
      <span className="h-3 w-3 rounded-full bg-[#28c840]" />
    </div>
  );
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="min-h-screen text-slate-100"
      style={{
        background: `
          radial-gradient(ellipse 120% 80% at 20% 0%, rgba(45, 212, 191, 0.12), transparent 50%),
          radial-gradient(ellipse 100% 60% at 100% 100%, rgba(99, 102, 241, 0.15), transparent 45%),
          linear-gradient(165deg, #0c1018 0%, #141a24 40%, #0d1117 100%)
        `
      }}
    >
      {/* Верхняя панель (как в GNOME) */}
      <header className="flex h-11 items-center justify-between border-b border-white/10 bg-[#1e2229]/85 px-4 text-sm shadow-md backdrop-blur-md">
        <div className="flex items-center gap-6">
          <span className="font-semibold tracking-tight text-teal-400">Действия</span>
          <span className="hidden text-slate-500 sm:inline">ZeroDay Desktop</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="tabular-nums text-slate-400">{now}</span>
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1">
            <span className="h-7 w-7 rounded-full bg-gradient-to-br from-teal-500 to-indigo-600 text-center text-xs font-bold leading-7 text-white">
              {(user?.username ?? "?")[0]?.toUpperCase()}
            </span>
            <span className="max-w-[120px] truncate text-xs text-slate-300">{user?.username}</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-red-500/40 bg-red-950/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-900/50"
          >
            Выйти
          </button>
        </div>
      </header>

      <div className="relative mx-auto flex min-h-[calc(100vh-2.75rem)] max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:px-6">
        {/* Иконки рабочего стола */}
        <aside className="flex flex-row gap-6 md:w-36 md:flex-col md:gap-4">
          {[
            { icon: ">_", label: "Терминал" },
            { icon: "📁", label: "Файлы" },
            { icon: "🌐", label: "Сеть" },
            { icon: "⚙", label: "Параметры" }
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              className="flex w-20 flex-col items-center gap-1 rounded-lg p-2 text-center text-xs text-slate-300 transition hover:bg-white/10"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-[#1e2229]/90 text-lg shadow-inner">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </aside>

        {/* Окно приложения */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1a1d24]/95 shadow-2xl shadow-black/40 ring-1 ring-white/5">
            <div className="flex items-center gap-3 border-b border-white/10 bg-[#2d3139] px-4 py-2.5">
              <TitleBarDots />
              <span className="flex-1 text-center text-xs font-medium text-slate-400">Терминал — session</span>
              <span className="w-14" />
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-3 md:p-5">
              <section className="rounded-lg border border-green-900/30 bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-green-400 md:col-span-2">
                <p className="mb-2 text-green-600">user@{user?.username ?? "agent"}:~$ ./zeroday-session</p>
                <pre className="whitespace-pre-wrap">{`boot> профиль загружен
boot> каналы darknet: standby
boot> лента клана: синхронизация… OK

Добро пожаловать, ${user?.username ?? "agent"}.
Виртуальный IP: ${user?.ip_address ?? "n/a"}
Уровень: ${user?.level ?? 1}  |  XP: ${user?.xp ?? 0}

Доступные команды (заглушки):
  contracts   — контракты
  market      — чёрный рынок
  ctf         — турниры
  clan        — клан
`}</pre>
              </section>
              <section className="space-y-3">
                <div className="rounded-lg border border-white/10 bg-[#252830] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Профиль</p>
                  <p className="text-xs text-slate-400">id</p>
                  <p className="mb-2 truncate text-sm text-white">{user?.id}</p>
                  <p className="text-xs text-slate-400">email</p>
                  <p className="mb-2 truncate text-sm text-white">{user?.email}</p>
                  <p className="text-xs text-slate-400">IP</p>
                  <p className="text-sm text-teal-300">{user?.ip_address}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#252830] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Система</p>
                  <p className="text-sm text-slate-300">Ядро: zeroday-linux 0.1</p>
                  <p className="text-sm text-slate-300">Стол: ZeroDay Desktop</p>
                  <p className="text-sm text-emerald-400/90">Firewall: вкл.</p>
                </div>
              </section>
            </div>
          </div>

          {/* Док внизу */}
          <div className="mt-auto flex justify-center pt-6">
            <div className="flex gap-2 rounded-2xl border border-white/10 bg-[#1e2229]/90 px-3 py-2 shadow-xl backdrop-blur-md">
              {["🖥", "📂", "🧩", "💬", "🛡"].map((emoji, i) => (
                <button
                  key={i}
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-lg transition hover:bg-white/15"
                  aria-label="dock"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
