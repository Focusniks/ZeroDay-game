import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useGameConfig } from "../hooks/useGameConfig";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

type InstallStep =
  | "welcome"
  | "keyboard"
  | "region"
  | "disk"
  | "disk_busy"
  | "account"
  | "installing"
  | "done";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const SLIDES = [
  {
    title: "ZeroDay Linux",
    body: "Безопасная песочница для хакер-симуляции: контракты, рынок, кланы — всё в одной ОС."
  },
  {
    title: "Сеть и репутация",
    body: "Виртуальные IP, VPN-цепочки и розыск — как в настоящем underground, но безопасно для игры."
  },
  {
    title: "Твой терминал",
    body: "После установки ты получишь графический стол с терминалом в стиле современного Linux."
  }
];

export function OsInstallPage() {
  const navigate = useNavigate();
  const { register, wsState } = useAuth();
  const { patchConfig, configPath } = useGameConfig();

  const [step, setStep] = useState<InstallStep>("welcome");
  const [slideIdx, setSlideIdx] = useState(0);
  const [keyboard, setKeyboard] = useState("English (US)");
  const [region, setRegion] = useState("Europe / Kyiv");
  const [diskChoice] = useState("erase"); // only one option for fiction
  const [diskStatus, setDiskStatus] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [overallPct, setOverallPct] = useState(0);
  const [installLine, setInstallLine] = useState("");

  const displayStep = useMemo(() => {
    if (step === "welcome") return 1;
    if (step === "keyboard") return 2;
    if (step === "region") return 3;
    if (step === "disk" || step === "disk_busy") return 4;
    if (step === "account") return 5;
    if (step === "installing") return 6;
    return 7;
  }, [step]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setSlideIdx((i) => (i + 1) % SLIDES.length);
    }, 5200);
    return () => window.clearInterval(t);
  }, []);

  const runDiskBusy = useCallback(async () => {
    setStep("disk_busy");
    setBusy(true);
    setDiskStatus("Подготовка накопителя…");
    await sleep(1200);
    setDiskStatus("Создание таблицы разделов GPT…");
    await sleep(1800);
    setDiskStatus("Форматирование /dev/vda2 (ext4, журнал zeroday)…");
    await sleep(2200);
    setDiskStatus("Создание раздела подкачки…");
    await sleep(1400);
    setDiskStatus("Монтирование /target …");
    await sleep(1600);
    setDiskStatus("Готово.");
    await sleep(600);
    setBusy(false);
    setStep("account");
  }, []);

  const runFullInstall = useCallback(async () => {
    setError("");
    if (!USERNAME_REGEX.test(username.trim())) {
      setError("Имя пользователя: 3–20 символов, a-z, 0-9, _");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Некорректный email");
      return;
    }
    if (password.length < 8) {
      setError("Пароль не короче 8 символов");
      return;
    }
    if (password !== confirmPass) {
      setError("Пароли не совпадают");
      return;
    }
    if (wsState !== "open") {
      setError("Нет соединения с сервером. Запусти backend и проверь client/.env (VITE_WS_URL).");
      return;
    }

    setStep("installing");
    setBusy(true);
    setOverallPct(0);
    setInstallLine("Копирование файлов системы…");

    const packages = [
      "zeroday-base",
      "zeroday-desktop",
      "zeroday-network",
      "zeroday-firewall",
      "zeroday-terminal",
      "zeroday-market-client",
      "zeroday-clan-sync",
      "zeroday-kernel-modules",
      "zeroday-locale-ru",
      "zeroday-themes",
      "zeroday-webengine",
      "zeroday-sec-profiles"
    ];

    // Фаза 1: «копирование» — дольше, как у настоящего инсталлятора (~35–50 с)
    const copySteps = 48;
    for (let i = 0; i < copySteps; i += 1) {
      const pct = Math.min(68, Math.round((i / copySteps) * 68));
      setOverallPct(pct);
      const pkg = packages[i % packages.length];
      setInstallLine(`Извлечение ${pkg}_${(i % 9) + 1}.deb …`);
      await sleep(380 + (i % 5) * 40);
    }

    setInstallLine("Настройка локали и часового пояса…");
    for (let p = 68; p <= 78; p += 1) {
      setOverallPct(p);
      await sleep(420);
    }

    setInstallLine("Установка загрузчика GRUB…");
    for (let p = 78; p <= 86; p += 1) {
      setOverallPct(p);
      await sleep(500);
    }

    setInstallLine("Создание учётной записи и регистрация в сети ZeroDay…");
    setOverallPct(88);
    try {
      await register(username.trim(), email.trim(), password);
      await patchConfig({
        setupComplete: true,
        lastLoginEmailHint: email.trim()
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка регистрации");
      setBusy(false);
      setStep("account");
      return;
    }

    setInstallLine("Завершение установки…");
    for (let p = 88; p <= 100; p += 1) {
      setOverallPct(p);
      await sleep(280);
    }

    setStep("done");
    await sleep(1400);
    setBusy(false);
    navigate("/dashboard");
  }, [email, navigate, password, confirmPass, patchConfig, register, username, wsState]);

  const goBack = () => {
    if (busy || step === "installing" || step === "disk_busy" || step === "done") return;
    const map: Partial<Record<InstallStep, InstallStep>> = {
      keyboard: "welcome",
      region: "keyboard",
      disk: "region",
      account: "disk"
    };
    const prev = map[step];
    if (prev) setStep(prev);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1d24] text-slate-200">
      {/* Верхняя панель «живой сессии» */}
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-white/10 bg-black/30 px-3 text-xs backdrop-blur-md">
        <span className="font-medium text-cyan-400/90">ZeroDay OS</span>
        <span className="text-slate-500">Попробовать без установки</span>
        <span className="tabular-nums text-slate-400">{new Date().toLocaleTimeString()}</span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Левая панель — как у графических инсталляторов */}
        <aside className="relative hidden w-[38%] max-w-md flex-col justify-between border-r border-white/10 bg-gradient-to-br from-[#0f766e]/30 via-[#1e1b4b]/40 to-[#0c0a09] p-8 lg:flex">
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-teal-300/80">
              ZeroDay GNU/Linux 0.1
            </div>
            <h1 className="text-2xl font-bold leading-tight text-white drop-shadow-md">
              {SLIDES[slideIdx]!.title}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-300/90">{SLIDES[slideIdx]!.body}</p>
          </div>
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`slide ${i + 1}`}
                onClick={() => setSlideIdx(i)}
                className={`h-1.5 flex-1 rounded-full transition ${i === slideIdx ? "bg-cyan-400" : "bg-white/20"}`}
              />
            ))}
          </div>
        </aside>

        {/* Основное окно мастера */}
        <main className="flex min-h-0 flex-1 flex-col bg-[#252830]/95 p-6 md:p-10">
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Установка ZeroDay Linux</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Шаг {displayStep} из 7 — графический режим
                </p>
              </div>
              {configPath ? (
                <p className="hidden max-w-[200px] truncate text-[10px] text-slate-600 md:block" title={configPath}>
                  config: …
                </p>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-[#1e2229] p-6 shadow-inner">
              {step === "welcome" ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-600 text-2xl font-black text-white shadow-lg">
                      Z
                    </div>
                    <div>
                      <p className="text-lg font-medium text-white">Добро пожаловать</p>
                      <p className="text-sm text-slate-400">
                        Мастер установит систему и создаст твой онлайн-аккаунт. Подключение к серверу игры настраивается
                        в файле <code className="text-cyan-400">client/.env</code> (разработчик), здесь это не
                        запрашивается.
                      </p>
                    </div>
                  </div>
                  <ul className="list-inside list-disc space-y-2 text-sm text-slate-300">
                    <li>Графический рабочий стол после входа</li>
                    <li>Локальный профиль и сохранение настроек рядом с игрой</li>
                    <li>Регистрация — часть установки (учётная запись администратора)</li>
                  </ul>
                </div>
              ) : null}

              {step === "keyboard" ? (
                <div className="space-y-4">
                  <p className="text-white">Раскладка клавиатуры</p>
                  <div className="space-y-2">
                    {["English (US)", "English (UK)", "Русская", "Українська"].map((k) => (
                      <label
                        key={k}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                          keyboard === k
                            ? "border-cyan-500/60 bg-cyan-950/40"
                            : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        <input
                          type="radio"
                          name="kb"
                          checked={keyboard === k}
                          onChange={() => setKeyboard(k)}
                          className="accent-cyan-500"
                        />
                        <span>{k}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === "region" ? (
                <div className="space-y-4">
                  <p className="text-white">Часовой пояс</p>
                  <label className="block text-sm text-slate-400">
                    Регион
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/15 bg-[#2a3039] px-4 py-3 text-white outline-none focus:border-cyan-500/50"
                    >
                      <option>Europe / Kyiv</option>
                      <option>Europe / Berlin</option>
                      <option>America / New_York</option>
                      <option>UTC</option>
                    </select>
                  </label>
                  <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-6 text-center text-sm text-slate-500">
                    Карта мира (симуляция)
                  </div>
                </div>
              ) : null}

              {step === "disk" ? (
                <div className="space-y-4">
                  <p className="text-white">Разметка диска</p>
                  <p className="text-sm text-slate-400">
                    Виртуальный диск для игры. На реальные разделы ПК установка не влияет.
                  </p>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-2 flex h-8 overflow-hidden rounded-md">
                      <div className="w-[8%] bg-amber-600/80" title="EFI" />
                      <div className="flex-1 bg-teal-600/70" title="/" />
                      <div className="w-[12%] bg-slate-600/80" title="swap" />
                    </div>
                    <div className="space-y-1 font-mono text-xs text-slate-400">
                      <div>/dev/vda1 — 512 MiB — EFI System</div>
                      <div>/dev/vda2 — остальное — ext4 /</div>
                      <div>/dev/vda3 — 2 GiB — swap</div>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-4">
                    <input type="radio" checked={diskChoice === "erase"} readOnly className="mt-1 accent-cyan-500" />
                    <span>
                      <span className="font-medium text-white">Стереть диск и установить ZeroDay</span>
                      <span className="mt-1 block text-sm text-slate-400">
                        Рекомендуется для чистой установки (внутри игры).
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}

              {step === "disk_busy" ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-6 h-14 w-14 animate-spin rounded-full border-4 border-cyan-500/30 border-t-cyan-400" />
                  <p className="text-lg text-white">Выполняется разметка диска</p>
                  <p className="mt-2 max-w-md text-sm text-slate-400">{diskStatus}</p>
                </div>
              ) : null}

              {step === "account" ? (
                <div className="space-y-4">
                  <p className="text-white">Создай учётную запись администратора</p>
                  <p className="text-sm text-slate-400">
                    Это же регистрация в онлайн-игре. Пароль не короче 8 символов.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm text-slate-400 sm:col-span-2">
                      Имя пользователя
                      <input
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#2a3039] px-4 py-2.5 text-white outline-none focus:border-cyan-500/50"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        autoComplete="username"
                      />
                    </label>
                    <label className="block text-sm text-slate-400 sm:col-span-2">
                      Email
                      <input
                        type="email"
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#2a3039] px-4 py-2.5 text-white outline-none focus:border-cyan-500/50"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </label>
                    <label className="block text-sm text-slate-400">
                      Пароль
                      <input
                        type="password"
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#2a3039] px-4 py-2.5 text-white outline-none focus:border-cyan-500/50"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </label>
                    <label className="block text-sm text-slate-400">
                      Подтверждение пароля
                      <input
                        type="password"
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#2a3039] px-4 py-2.5 text-white outline-none focus:border-cyan-500/50"
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        autoComplete="new-password"
                      />
                    </label>
                  </div>
                  {wsState !== "open" ? (
                    <p className="text-sm text-amber-400/90">
                      Ожидание соединения с сервером… Убедись, что backend запущен и в <code>VITE_WS_URL</code> верный
                      адрес.
                    </p>
                  ) : null}
                  {error ? <p className="text-sm text-red-400">{error}</p> : null}
                </div>
              ) : null}

              {step === "installing" || step === "done" ? (
                <div className="space-y-6 py-4">
                  <p className="text-lg font-medium text-white">
                    {step === "done" ? "Установка завершена" : "Установка системы"}
                  </p>
                  <div className="h-3 overflow-hidden rounded-full bg-black/40">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-[width] duration-300 ease-out"
                      style={{ width: `${overallPct}%` }}
                    />
                  </div>
                  <p className="font-mono text-xs text-slate-400">{installLine}</p>
                  <p className="text-sm text-slate-500">{overallPct}%</p>
                </div>
              ) : null}
            </div>

            {/* Нижняя панель кнопок */}
            <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
              <button
                type="button"
                disabled={busy || step === "welcome" || step === "disk_busy" || step === "installing"}
                onClick={goBack}
                className="rounded-lg px-5 py-2.5 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-30"
              >
                Назад
              </button>
              <div className="flex gap-3">
                {step === "welcome" ? (
                  <button
                    type="button"
                    onClick={() => setStep("keyboard")}
                    className="rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95"
                  >
                    Продолжить
                  </button>
                ) : null}
                {step === "keyboard" ? (
                  <button
                    type="button"
                    onClick={() => setStep("region")}
                    className="rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95"
                  >
                    Продолжить
                  </button>
                ) : null}
                {step === "region" ? (
                  <button
                    type="button"
                    onClick={() => setStep("disk")}
                    className="rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95"
                  >
                    Продолжить
                  </button>
                ) : null}
                {step === "disk" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runDiskBusy()}
                    className="rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95 disabled:opacity-50"
                  >
                    Установить сейчас
                  </button>
                ) : null}
                {step === "account" ? (
                  <button
                    type="button"
                    disabled={busy || wsState !== "open"}
                    onClick={() => void runFullInstall()}
                    className="rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95 disabled:opacity-50"
                  >
                    Установить
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
