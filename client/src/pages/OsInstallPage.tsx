import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InstallWorldMap } from "../components/install/InstallWorldMap";
import { getDefaultTimezoneId, INSTALL_TIMEZONES } from "../data/timezones";
import { useAuth } from "../hooks/useAuth";
import { useGameConfig } from "../hooks/useGameConfig";
import type { GameLanguage } from "../lib/gameConfig";
import { getInstallWizardCopy } from "../lib/i18n/installWizard";

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
  | "done"
  | "rebooting";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function detectBrowserLang(): GameLanguage {
  if (typeof navigator === "undefined") return "ru";
  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function OsInstallPage() {
  const navigate = useNavigate();
  const { register, wsState } = useAuth();
  const { patchConfig } = useGameConfig();

  const [welcomeLang] = useState<GameLanguage>(() => detectBrowserLang());
  const [keyboardLayout, setKeyboardLayout] = useState<GameLanguage>(() => detectBrowserLang());

  const [step, setStep] = useState<InstallStep>("welcome");
  const [slideIdx, setSlideIdx] = useState(0);
  const [region, setRegion] = useState(() => getDefaultTimezoneId());
  const [diskChoice] = useState("erase");
  const [diskStatusIdx, setDiskStatusIdx] = useState(0);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [skipBusy, setSkipBusy] = useState(false);
  const [overallPct, setOverallPct] = useState(0);
  const [installLine, setInstallLine] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [revealStage, setRevealStage] = useState(0); // 0..4 sequential reveal
  const [fact, setFact] = useState("");
  const [quizScore, setQuizScore] = useState(0);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [quizLocked, setQuizLocked] = useState(false);
  const [rebootCountdown, setRebootCountdown] = useState(10);

  const uiLang: GameLanguage = step === "welcome" ? welcomeLang : keyboardLayout;
  const copy = useMemo(() => getInstallWizardCopy(uiLang), [uiLang]);
  const slides = copy.slides;
  const showAside = revealStage >= 1;
  const showClock = revealStage >= 2;
  const showBody = revealStage >= 3;
  const canInteract = revealStage >= 4;

  const facts = useMemo(
    () =>
      uiLang === "ru"
        ? [
            "journal: события пишутся локально и быстро индексируются для journalctl.",
            "firewall: включены базовые политики по умолчанию для безопасной сети.",
            "locale: собираем языковые пакеты и приводим раскладку к выбранному языку.",
            "timezone: синхронизируем системное время по выбранному поясу (IANA).",
            "services: поднимаем минимальный набор демонов для сети и ввода.",
            "storage: форматируется /dev/vda2 (ext4) с журналированием для надёжности.",
            "boot: готовим загрузчик и записи для быстрого старта окружения."
          ]
        : [
            "journal: events are written locally and indexed for journalctl.",
            "firewall: baseline default policies are enabled for safer networking.",
            "locale: language packs are built and input mapping matches your choice.",
            "timezone: system time is aligned to the selected IANA timezone.",
            "services: we start the minimal set of daemons for network and input.",
            "storage: /dev/vda2 is formatted as ext4 with journaling.",
            "boot: boot loader entries are prepared for a fast start."
          ],
    [uiLang]
  );

  const quizCards = useMemo(() => {
    const ru = [
      {
        q: "Что делает systemd-journald?",
        options: ["Хранит журнал событий системы", "Управляет видеодрайверами", "Настраивает SSH-ключи"],
        correct: 0
      },
      {
        q: "Зачем нужен ext4 journal?",
        options: ["Ускоряет поиск файлов", "Помогает восстановиться после сбоев", "Шифрует диск автоматически"],
        correct: 1
      },
      {
        q: "Что такое часовой пояс (IANA) в системе?",
        options: ["Правило отображения времени", "Алгоритм графики", "Настройка звука"],
        correct: 0
      }
    ];
    const en = [
      {
        q: "What does systemd-journald do?",
        options: ["Stores system event logs", "Manages GPU drivers", "Configures SSH keys"],
        correct: 0
      },
      {
        q: "Why is ext4 journaling useful?",
        options: ["It speeds up file search", "It helps recover after crashes", "It automatically encrypts the disk"],
        correct: 1
      },
      {
        q: "What is an IANA time zone in the system?",
        options: ["A rule for displaying time", "A graphics algorithm", "A sound setting"],
        correct: 0
      }
    ];
    return uiLang === "ru" ? ru : en;
  }, [uiLang]);

  const currentQuiz = quizCards[quizIdx] ?? quizCards[0];

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
    setSlideIdx((i) => Math.min(i, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setSlideIdx((i) => (i + 1) % slides.length);
    }, 5200);
    return () => window.clearInterval(t);
  }, [slides.length]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Facts + mini-game during installation
  useEffect(() => {
    if (step !== "installing") return;
    setQuizScore(0);
    setQuizFeedback(null);
    setQuizLocked(false);
    setQuizIdx(0);
    setFact(facts[0] ?? "");

    let cancelled = false;
    const factTimer = window.setInterval(() => {
      if (cancelled) return;
      const next = Math.floor(Math.random() * Math.max(1, facts.length));
      setFact(facts[next] ?? "");
    }, 2400);

    return () => {
      cancelled = true;
      window.clearInterval(factTimer);
    };
  }, [facts, step]);

  const answerQuiz = (choiceIdx: number) => {
    if (step !== "installing") return;
    if (quizLocked) return;
    setQuizLocked(true);
    setQuizFeedback(null);

    const correct = currentQuiz?.correct === choiceIdx;
    if (correct) {
      setQuizScore((s) => s + 1);
      setQuizFeedback(uiLang === "ru" ? "Верно. Сервис поднят." : "Correct. Service is up.");
    } else {
      setQuizFeedback(
        uiLang === "ru" ? "Почти. Перечитаем модули и попробуем иначе." : "Not quite. Rechecking modules…"
      );
    }

    window.setTimeout(() => {
      setQuizFeedback(null);
      setQuizLocked(false);
      setQuizIdx((i) => {
        const next = (i + 1) % Math.max(1, quizCards.length);
        return next;
      });
    }, 750);
  };

  // Последовательная подгрузка элементов мастера
  useEffect(() => {
    const t1 = window.setTimeout(() => setRevealStage(1), 220);
    const t2 = window.setTimeout(() => setRevealStage(2), 520);
    const t3 = window.setTimeout(() => setRevealStage(3), 860);
    const t4 = window.setTimeout(() => setRevealStage(4), 1250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, []);

  const headerTime = useMemo(() => {
    const loc = uiLang === "ru" ? "ru-RU" : "en-US";
    const opts: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    };
    if (step === "welcome" || step === "keyboard") {
      return now.toLocaleTimeString(loc, opts);
    }
    try {
      return now.toLocaleTimeString(loc, { ...opts, timeZone: region });
    } catch {
      return now.toLocaleTimeString(loc, opts);
    }
  }, [now, step, region, uiLang]);

  const runDiskBusy = useCallback(async () => {
    const w = getInstallWizardCopy(keyboardLayout);
    setStep("disk_busy");
    setBusy(true);
    const delays = [950, 1450, 1750, 1550, 1650, 1850, 620];
    for (let i = 0; i < w.diskStatus.length; i += 1) {
      setDiskStatusIdx(i);
      await sleep(delays[i] ?? 1200);
    }
    setBusy(false);
    setStep("account");
  }, [keyboardLayout]);

  const runFullInstall = useCallback(async () => {
    const w = getInstallWizardCopy(keyboardLayout);
    setError("");
    if (!USERNAME_REGEX.test(username.trim())) {
      setError(w.errUser);
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError(w.errEmail);
      return;
    }
    if (password.length < 8) {
      setError(w.errPass);
      return;
    }
    if (password !== confirmPass) {
      setError(w.errPassMatch);
      return;
    }
    if (wsState !== "open") {
      setError(w.errWs);
      return;
    }

    setStep("installing");
    setBusy(true);
    try {
      // 1) Сначала проверяем/создаём аккаунт в сети по WebSocket.
      setOverallPct(6);
      setInstallLine(w.installPhaseAccount);
      await register(username.trim(), email.trim(), password);
      await patchConfig({
        // В окне логина подставляем никнейм (в Backend это поле теперь умеет логин по username).
        lastLoginEmailHint: username.trim(),
        gameLanguage: keyboardLayout,
        timezone: region
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : w.errWs);
      setBusy(false);
      setStep("account");
      return;
    }

    // 2) Только после успешной регистрации начинаем симуляцию установки.
    setOverallPct(0);
    setInstallLine("Копирование файлов системы…");

    const packages = w.installPackages;
    const copySteps = 48;
    for (let i = 0; i < copySteps; i += 1) {
      const pct = Math.min(68, Math.round((i / copySteps) * 68));
      setOverallPct(pct);
      const pkg = packages[i % packages.length]!;
      setInstallLine(`${pkg}_${(i % 11) + 1}.deb …`);
      await sleep(380 + (i % 5) * 40);
    }

    setInstallLine(w.installPhaseLocale);
    for (let p = 68; p <= 78; p += 1) {
      setOverallPct(p);
      await sleep(420);
    }

    setInstallLine(w.installPhaseGrub);
    for (let p = 78; p <= 86; p += 1) {
      setOverallPct(p);
      await sleep(500);
    }

    setInstallLine(w.installPhaseFinish);
    for (let p = 86; p <= 100; p += 1) {
      setOverallPct(p);
      await sleep(280);
    }

    setStep("done");
    await sleep(900);
    setBusy(false);

    // "Windows reboot": 10 секунд с отсчётом и кнопкой.
    setRebootCountdown(10);
    setStep("rebooting");
  }, [email, keyboardLayout, navigate, password, confirmPass, patchConfig, region, register, username, wsState]);

  // countdown для "rebooting"
  useEffect(() => {
    if (step !== "rebooting") return;

    let cancelled = false;
    setRebootCountdown(10);

    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      if (cancelled) return;
      const passedSec = Math.floor((Date.now() - startedAt) / 1000);
      const left = Math.max(0, 10 - passedSec);
      setRebootCountdown(left);
      if (left <= 0) {
        window.clearInterval(tick);
        (async () => {
          // Фиксируем `setupComplete` только после таймера,
          // чтобы экран rebooting успел отобразиться без редиректа на /login.
          await patchConfig({ setupComplete: true });
          if (cancelled) return;
          // Показываем boot-экран (как при реальной перезагрузке), потом идём на логин.
          window.dispatchEvent(new Event("zeroday:reboot"));
          setStep("done");
          navigate("/login");
        })();
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [navigate, patchConfig, step]);

  const rebootNow = useCallback(() => {
    if (step !== "rebooting") return;
    setRebootCountdown(0);
    void (async () => {
      await patchConfig({ setupComplete: true });
      window.dispatchEvent(new Event("zeroday:reboot"));
      setStep("done");
      navigate("/dashboard");
    })();
  }, [navigate, patchConfig, step]);

  const skipRegistrationToLogin = useCallback(async () => {
    setSkipBusy(true);
    setError("");
    try {
      await patchConfig({
        setupComplete: true,
        gameLanguage: keyboardLayout,
        timezone: region
      });
      navigate("/login");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg ? msg : uiLang === "ru" ? "Не удалось перейти ко входу." : "Failed to proceed to sign-in.");
    } finally {
      setSkipBusy(false);
    }
  }, [keyboardLayout, navigate, patchConfig, region, uiLang]);

  const goBack = () => {
    if (busy || step === "installing" || step === "disk_busy" || step === "done" || step === "rebooting") return;
    const map: Partial<Record<InstallStep, InstallStep>> = {
      keyboard: "welcome",
      region: "keyboard",
      disk: "region",
      account: "disk"
    };
    const prev = map[step];
    if (prev) setStep(prev);
  };

  const continueKeyboard = async () => {
    await patchConfig({ gameLanguage: keyboardLayout });
    setStep("region");
  };

  const continueRegion = async () => {
    await patchConfig({ timezone: region });
    setStep("disk");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1d24] text-slate-200">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-white/10 bg-black/30 px-3 text-xs backdrop-blur-md">
        <span className="font-medium text-cyan-400/90">{copy.headerBrand}</span>
        <span className="hidden text-slate-500 sm:inline">{copy.headerSession}</span>
        <span className="tabular-nums text-slate-400">
          {showClock ? headerTime : "—:—:—"}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={`relative hidden w-[38%] max-w-md flex-col justify-between border-r border-white/10 bg-gradient-to-br from-[#0f766e]/30 via-[#1e1b4b]/40 to-[#0c0a09] p-8 lg:flex transition-opacity duration-700 ${
            showAside ? "opacity-100" : "opacity-0"
          } ${canInteract ? "pointer-events-auto" : "pointer-events-none"}`}
        >
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-teal-300/80">
              ZeroDay GNU/Linux 0.1
            </div>
            <h1 className="text-2xl font-bold leading-tight text-white drop-shadow-md">{slides[slideIdx]!.title}</h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-300/90">{slides[slideIdx]!.body}</p>
          </div>
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
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

        <main
          className={`flex min-h-0 flex-1 flex-col bg-[#252830]/95 p-6 md:p-10 transition-opacity duration-700 ${
            showBody ? "opacity-100" : "opacity-0"
          } ${canInteract ? "pointer-events-auto" : "pointer-events-none"}`}
        >
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">{copy.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{copy.stepLine(displayStep)}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-[#1e2229] p-6 shadow-inner">
              {step === "welcome" ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-600 text-2xl font-black text-white shadow-lg">
                      Z
                    </div>
                    <div>
                      <p className="text-lg font-medium text-white">{copy.welcomeTitle}</p>
                      <p className="text-sm text-slate-400">{copy.welcomeLead}</p>
                    </div>
                  </div>
                  <ul className="list-inside list-disc space-y-2 text-sm text-slate-300">
                    <li>{copy.welcomeBullet1}</li>
                    <li>{copy.welcomeBullet2}</li>
                    <li>{copy.welcomeBullet3}</li>
                  </ul>
                  {error ? <p className="text-sm text-red-400">{error}</p> : null}
                </div>
              ) : null}

              {step === "keyboard" ? (
                <div className="space-y-4">
                  <p className="text-white">{copy.keyboardTitle}</p>
                  <p className="text-sm text-slate-500">
                    {uiLang === "ru"
                      ? "Выбранная раскладка задаёт язык интерфейса в игре и сохраняется локально."
                      : "Chosen layout sets the in-game UI language and is saved locally."}
                  </p>
                  <div className="space-y-2">
                    {(
                      [
                        { id: "en" as const, label: copy.keyboardEn },
                        { id: "ru" as const, label: copy.keyboardRu }
                      ] as const
                    ).map((k) => (
                      <label
                        key={k.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                          keyboardLayout === k.id
                            ? "border-cyan-500/60 bg-cyan-950/40"
                            : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        <input
                          type="radio"
                          name="kb"
                          checked={keyboardLayout === k.id}
                          onChange={() => setKeyboardLayout(k.id)}
                          className="accent-cyan-500"
                        />
                        <span>{k.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === "region" ? (
                <div className="space-y-4">
                  <p className="text-white">{copy.regionTitle}</p>
                  <p className="text-sm text-slate-400">{copy.regionHint}</p>
                  <InstallWorldMap
                    zones={INSTALL_TIMEZONES}
                    selectedId={region}
                    onSelect={setRegion}
                    lang={uiLang}
                  />
                  <label className="block text-sm text-slate-400">
                    {copy.regionSelect}
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="mt-2 max-h-48 w-full rounded-lg border border-white/15 bg-[#2a3039] px-4 py-3 text-white outline-none focus:border-cyan-500/50"
                    >
                      {INSTALL_TIMEZONES.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.id} — {uiLang === "ru" ? z.regionRu : z.regionEn}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-slate-500">
                    {uiLang === "ru" ? "Текущее время в выбранном поясе: " : "Time in selected zone: "}
                    <span className="font-mono text-slate-400">
                      {(() => {
                        try {
                          return now.toLocaleTimeString(uiLang === "ru" ? "ru-RU" : "en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            timeZone: region
                          });
                        } catch {
                          return "—";
                        }
                      })()}
                    </span>
                  </p>
                </div>
              ) : null}

              {step === "disk" ? (
                <div className="space-y-4">
                  <p className="text-white">{copy.diskTitle}</p>
                  <p className="text-sm text-slate-400">{copy.diskLead}</p>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-2 flex h-8 overflow-hidden rounded-md ring-1 ring-white/10">
                      <div className="flex w-[10%] items-center justify-center bg-amber-600/85 text-[9px] font-bold text-black/80">
                        {copy.diskBarEfi}
                      </div>
                      <div className="flex flex-1 items-center justify-center bg-teal-600/75 text-[9px] font-medium text-white/90">
                        {copy.diskBarRoot}
                      </div>
                      <div className="flex w-[14%] items-center justify-center bg-slate-600/85 text-[9px] text-slate-200">
                        {copy.diskBarSwap}
                      </div>
                    </div>
                    <div className="space-y-1.5 font-mono text-xs text-slate-400">
                      <div>{copy.diskRow1}</div>
                      <div>{copy.diskRow2}</div>
                      <div>{copy.diskRow3}</div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-500">{copy.diskFlavor}</p>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-4">
                    <input type="radio" checked={diskChoice === "erase"} readOnly className="mt-1 accent-cyan-500" />
                    <span>
                      <span className="font-medium text-white">{copy.diskOptionTitle}</span>
                      <span className="mt-1 block text-sm text-slate-400">{copy.diskOptionDesc}</span>
                    </span>
                  </label>
                  <p className="text-sm text-slate-500">{copy.diskNote}</p>
                </div>
              ) : null}

              {step === "disk_busy" ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-6 h-14 w-14 animate-spin rounded-full border-4 border-cyan-500/30 border-t-cyan-400" />
                  <p className="text-lg text-white">{copy.diskBusyTitle}</p>
                  <p className="mt-2 max-w-md text-sm text-slate-400">
                    {getInstallWizardCopy(keyboardLayout).diskStatus[diskStatusIdx] ?? "…"}
                  </p>
                </div>
              ) : null}

              {step === "account" ? (
                <div className="space-y-4">
                  <p className="text-white">{copy.accountTitle}</p>
                  <p className="text-sm text-slate-400">{copy.accountLead}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm text-slate-400 sm:col-span-2">
                      {copy.username}
                      <input
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#2a3039] px-4 py-2.5 text-white outline-none focus:border-cyan-500/50"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        autoComplete="username"
                      />
                    </label>
                    <label className="block text-sm text-slate-400 sm:col-span-2">
                      {copy.email}
                      <input
                        type="email"
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#2a3039] px-4 py-2.5 text-white outline-none focus:border-cyan-500/50"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </label>
                    <label className="block text-sm text-slate-400">
                      {copy.password}
                      <input
                        type="password"
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#2a3039] px-4 py-2.5 text-white outline-none focus:border-cyan-500/50"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </label>
                    <label className="block text-sm text-slate-400">
                      {copy.confirmPassword}
                      <input
                        type="password"
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#2a3039] px-4 py-2.5 text-white outline-none focus:border-cyan-500/50"
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        autoComplete="new-password"
                      />
                    </label>
                  </div>
                  {wsState !== "open" ? <p className="text-sm text-amber-400/90">{copy.wsWait}</p> : null}
                  {error ? <p className="text-sm text-red-400">{error}</p> : null}
                </div>
              ) : null}

              {step === "installing" || step === "done" ? (
                <div className="space-y-6 py-4">
                  <p className="text-lg font-medium text-white">
                    {step === "done" ? copy.doneTitle : copy.installingTitle}
                  </p>
                  <div className="h-3 overflow-hidden rounded-full bg-black/40">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-[width] duration-300 ease-out"
                      style={{ width: `${overallPct}%` }}
                    />
                  </div>
                  <p className="font-mono text-xs text-slate-400">{installLine}</p>
                  <p className="text-sm text-slate-500">{overallPct}%</p>

                  {step === "installing" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-[#0f172a] p-4 shadow-inner">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {uiLang === "ru" ? "Факт о системе" : "System fact"}
                        </p>
                        <p className="text-sm text-slate-300">{fact}</p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-[#0f172a] p-4 shadow-inner">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {uiLang === "ru" ? "Мини-квиз" : "Mini-quiz"}: {quizScore}
                        </p>
                        <p className="mb-3 text-sm text-slate-200">{currentQuiz?.q}</p>
                        <div className="grid gap-2">
                          {currentQuiz?.options.map((opt, i) => (
                            <button
                              key={opt}
                              type="button"
                              disabled={quizLocked}
                              onClick={() => answerQuiz(i)}
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        {quizFeedback ? (
                          <p className="mt-3 text-xs text-cyan-300/90">{quizFeedback}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === "rebooting" ? (
                <div className="space-y-4 py-4">
                  <p className="text-lg font-medium text-white">
                    {uiLang === "ru" ? "Перезагрузка системы" : "System reboot"}
                  </p>
                  <p className="text-sm text-slate-400">
                    {uiLang === "ru"
                      ? `Система перезапустится через ${rebootCountdown} секунд…`
                      : `The system will restart in ${rebootCountdown} second(s)…`}
                  </p>
                  <div className="rounded-xl border border-white/10 bg-[#0f172a] p-4 shadow-inner">
                    <p className="text-xs text-slate-400">
                      {uiLang === "ru"
                        ? "Перезагрузка запустит повторную инициализацию окружения. Можно нажать кнопку сейчас."
                        : "Reboot will re-initialize the environment. You can press the button now."}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
              <button
                type="button"
                disabled={busy || step === "welcome" || step === "disk_busy" || step === "installing"}
                onClick={goBack}
                className="rounded-lg px-5 py-2.5 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-30"
              >
                {copy.back}
              </button>
              <div className="flex gap-3">
                {step === "welcome" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep("keyboard")}
                      className="rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95"
                    >
                      {copy.continue}
                    </button>
                    <button
                      type="button"
                      disabled={skipBusy}
                      onClick={() => void skipRegistrationToLogin()}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
                    >
                      {copy.welcomeHaveAccountCta}
                    </button>
                  </>
                ) : null}
                {step === "keyboard" ? (
                  <button
                    type="button"
                    onClick={() => void continueKeyboard()}
                    className="rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95"
                  >
                    {copy.continue}
                  </button>
                ) : null}
                {step === "region" ? (
                  <button
                    type="button"
                    onClick={() => void continueRegion()}
                    className="rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95"
                  >
                    {copy.continue}
                  </button>
                ) : null}
                {step === "disk" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runDiskBusy()}
                    className="rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95 disabled:opacity-50"
                  >
                    {copy.installNow}
                  </button>
                ) : null}
                {step === "account" ? (
                  <button
                    type="button"
                    disabled={busy || wsState !== "open"}
                    onClick={() => void runFullInstall()}
                    className="rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95 disabled:opacity-50"
                  >
                    {copy.install}
                  </button>
                ) : null}

                {step === "rebooting" ? (
                  <button
                    type="button"
                    onClick={() => rebootNow()}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
                  >
                    {uiLang === "ru" ? "Перезагрузить сейчас" : "Restart now"}
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
