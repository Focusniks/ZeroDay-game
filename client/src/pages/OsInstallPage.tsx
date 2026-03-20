import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InstallWorldMap } from "../components/install/InstallWorldMap";
import { getDefaultTimezoneId, INSTALL_TIMEZONES } from "../data/timezones";
import { useAuth } from "../hooks/useAuth";
import { useGameConfig } from "../hooks/useGameConfig";
import type { GameLanguage } from "../lib/gameConfig";
import { getInstallWizardCopy } from "../lib/i18n/installWizard";
import { createFullFsStructure } from "../lib/gameFs";

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
    
    // Создаём реальную структуру файловой системы
    try {
      await createFullFsStructure();
    } catch (e) {
      // Игнорируем ошибки, продолжаем установку
      console.error("Failed to create FS structure:", e);
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
          className={`relative hidden w-[42%] max-w-lg flex-col justify-between border-r border-white/10 bg-gradient-to-br from-[#0f766e]/40 via-[#1e1b4b]/50 to-[#0c0a09] p-10 lg:flex transition-opacity duration-700 ${
            showAside ? "opacity-100" : "opacity-0"
          } ${canInteract ? "pointer-events-auto" : "pointer-events-none"}`}
        >
          {/* Decorative background elements */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl" />
            <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="absolute left-1/2 top-1/3 h-32 w-32 -translate-x-1/2 rounded-full bg-cyan-500/5 blur-2xl" />
          </div>

          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-lg font-black text-white shadow-lg">
                Z
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-teal-300/90">
                  ZeroDay GNU/Linux
                </div>
                <div className="text-xs font-medium text-cyan-200/80">Interactive Installer v0.1</div>
              </div>
            </div>
            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-all duration-500"
                style={{ width: `${((slideIdx + 1) / slides.length) * 100}%` }}
              />
            </div>
            <h1 className="mt-5 text-3xl font-bold leading-tight text-white drop-shadow-lg">{slides[slideIdx]!.title}</h1>
            <p className="mt-5 text-base leading-relaxed text-slate-200/95">{slides[slideIdx]!.body}</p>
            
            {/* Feature badges */}
            <div className="mt-8 flex flex-wrap gap-2">
              <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-200">
                {uiLang === "ru" ? "Безопасность" : "Security"}
              </span>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                {uiLang === "ru" ? "Производительность" : "Performance"}
              </span>
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
                {uiLang === "ru" ? "Стабильность" : "Stability"}
              </span>
            </div>
          </div>

          <div className="relative z-10">
            <div className="mb-4 flex gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`slide ${i + 1}`}
                  onClick={() => setSlideIdx(i)}
                  className={`h-2 flex-1 rounded-full transition-all ${
                    i === slideIdx ? "bg-gradient-to-r from-teal-400 to-cyan-400 scale-105" : "bg-white/20 hover:bg-white/30"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{uiLang === "ru" ? "Слайд" : "Slide"} {slideIdx + 1} / {slides.length}</span>
              <span className="font-mono">{new Date().toLocaleTimeString(uiLang === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
        </aside>

        <main
          className={`flex min-h-0 flex-1 flex-col bg-[#252830]/95 p-6 md:p-10 transition-opacity duration-700 ${
            showBody ? "opacity-100" : "opacity-0"
          } ${canInteract ? "pointer-events-auto" : "pointer-events-none"}`}
        >
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">{copy.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{copy.stepLine(displayStep)}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-[#1e2229] p-8 shadow-inner">
              {step === "welcome" ? (
                <div className="space-y-6">
                  <div className="flex items-start gap-6">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-600 text-3xl font-black text-white shadow-lg">
                      Z
                    </div>
                    <div className="flex-1">
                      <p className="text-xl font-semibold text-white">{copy.welcomeTitle}</p>
                      <p className="mt-2 text-base leading-relaxed text-slate-300">{copy.welcomeLead}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <ul className="grid gap-3 sm:grid-cols-2">
                      <li className="flex items-start gap-3 text-sm text-slate-300">
                        <span className="mt-0.5 text-cyan-400">✓</span>
                        <span>{copy.welcomeBullet1}</span>
                      </li>
                      <li className="flex items-start gap-3 text-sm text-slate-300">
                        <span className="mt-0.5 text-cyan-400">✓</span>
                        <span>{copy.welcomeBullet2}</span>
                      </li>
                      <li className="flex items-start gap-3 text-sm text-slate-300">
                        <span className="mt-0.5 text-cyan-400">✓</span>
                        <span>{copy.welcomeBullet3}</span>
                      </li>
                      <li className="flex items-start gap-3 text-sm text-slate-300">
                        <span className="mt-0.5 text-cyan-400">✓</span>
                        <span>{uiLang === "ru" ? "Минимальные системные требования: 2 ядра CPU, 4 GB RAM, 32 GB диска" : "Minimum requirements: 2-core CPU, 4 GB RAM, 32 GB disk"}</span>
                      </li>
                    </ul>
                  </div>
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
                <div className="space-y-5">
                  <div>
                    <p className="text-white">{copy.diskTitle}</p>
                    <p className="text-sm text-slate-400">{copy.diskLead}</p>
                  </div>
                  
                  {/* Визуализация разделов диска */}
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-black/40 to-black/20 p-5">
                    {/* Графическая полоса разделов */}
                    <div className="mb-4 flex h-10 overflow-hidden rounded-lg ring-1 ring-white/20">
                      <div className="flex w-[10%] items-center justify-center bg-amber-600/90 text-[8px] font-bold text-white" title="EFI Boot">
                        {copy.diskBarEfi}
                      </div>
                      <div className="flex flex-1 items-center justify-center bg-teal-600/85 text-[9px] font-medium text-white" title="Root filesystem">
                        {copy.diskBarRoot}
                      </div>
                      <div className="flex w-[12%] items-center justify-center bg-slate-600/90 text-[8px] text-slate-100" title="Swap">
                        {copy.diskBarSwap}
                      </div>
                      <div className="flex w-[20%] items-center justify-center bg-indigo-600/85 text-[9px] font-medium text-white" title="Home directory">
                        {copy.diskBarHome}
                      </div>
                    </div>
                    
                    {/* Детали разделов */}
                    <div className="space-y-2 font-mono text-xs">
                      <div className="flex items-center gap-3 rounded bg-amber-600/10 px-3 py-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                        <span className="text-slate-300">{copy.diskRow1}</span>
                      </div>
                      <div className="flex items-center gap-3 rounded bg-teal-600/10 px-3 py-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                        <span className="text-slate-300">{copy.diskRow2}</span>
                      </div>
                      <div className="flex items-center gap-3 rounded bg-slate-600/10 px-3 py-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-slate-500" />
                        <span className="text-slate-300">{copy.diskRow3}</span>
                      </div>
                      <div className="flex items-center gap-3 rounded bg-indigo-600/10 px-3 py-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                        <span className="text-slate-300">{copy.diskRow4}</span>
                      </div>
                    </div>
                    
                    <p className="mt-4 text-sm leading-relaxed text-slate-500">{copy.diskFlavor}</p>
                  </div>
                  
                  {/* Опция установки */}
                  <label className="flex cursor-pointer items-start gap-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4 transition hover:bg-cyan-500/10">
                    <input type="radio" checked={diskChoice === "erase"} readOnly className="mt-1 h-4 w-4 accent-cyan-500" />
                    <span className="flex-1">
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
                <div className="space-y-5">
                  <div>
                    <p className="text-white">{copy.accountTitle}</p>
                    <p className="text-sm text-slate-400">{copy.accountLead}</p>
                  </div>
                  
                  {/* Requirements info box */}
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-300">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {uiLang === "ru" ? "Требования к учётной записи" : "Account requirements"}
                    </div>
                    <ul className="grid gap-1.5 text-xs text-slate-300 sm:grid-cols-2">
                      <li className="flex items-start gap-2">
                        <span className="text-cyan-400">•</span>
                        <span>{uiLang === "ru" ? "Имя: 3-20 символов, только a-z, 0-9, _" : "Username: 3-20 chars, a-z, 0-9, _ only"}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-cyan-400">•</span>
                        <span>{uiLang === "ru" ? "Пароль: минимум 8 символов" : "Password: at least 8 characters"}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-cyan-400">•</span>
                        <span>{uiLang === "ru" ? "Email: корректный формат" : "Email: valid format"}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-cyan-400">•</span>
                        <span>{uiLang === "ru" ? "Подтверждение пароля должно совпадать" : "Password confirmation must match"}</span>
                      </li>
                    </ul>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm text-slate-400 sm:col-span-2">
                      {copy.username}
                      <input
                        className={`mt-1 w-full rounded-lg border bg-[#2a3039] px-4 py-2.5 text-white outline-none focus:border-cyan-500/50 ${
                          username && !USERNAME_REGEX.test(username) ? "border-red-500/50" : "border-white/15"
                        }`}
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        placeholder={uiLang === "ru" ? "например: agent_zero" : "e.g. agent_zero"}
                        autoComplete="username"
                      />
                      {username && !USERNAME_REGEX.test(username) && (
                        <p className="mt-1 text-xs text-red-400">{uiLang === "ru" ? "3-20 символов, a-z, 0-9, _" : "3-20 chars, a-z, 0-9, _"}</p>
                      )}
                    </label>
                    <label className="block text-sm text-slate-400 sm:col-span-2">
                      {copy.email}
                      <input
                        type="email"
                        className={`mt-1 w-full rounded-lg border bg-[#2a3039] px-4 py-2.5 text-white outline-none focus:border-cyan-500/50 ${
                          email && !EMAIL_REGEX.test(email) ? "border-red-500/50" : "border-white/15"
                        }`}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="agent@zeroday.net"
                        autoComplete="email"
                      />
                      {email && !EMAIL_REGEX.test(email) && (
                        <p className="mt-1 text-xs text-red-400">{uiLang === "ru" ? "Некорректный email" : "Invalid email"}</p>
                      )}
                    </label>
                    <label className="block text-sm text-slate-400">
                      {copy.password}
                      <input
                        type="password"
                        className={`mt-1 w-full rounded-lg border bg-[#2a3039] px-4 py-2.5 text-white outline-none focus:border-cyan-500/50 ${
                          password && password.length < 8 ? "border-red-500/50" : "border-white/15"
                        }`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={uiLang === "ru" ? "Минимум 8 символов" : "Minimum 8 characters"}
                        autoComplete="new-password"
                      />
                      {password && password.length > 0 && password.length < 8 && (
                        <p className="mt-1 text-xs text-red-400">{uiLang === "ru" ? "Минимум 8 символов" : "Minimum 8 characters"}</p>
                      )}
                    </label>
                    <label className="block text-sm text-slate-400">
                      {copy.confirmPassword}
                      <input
                        type="password"
                        className={`mt-1 w-full rounded-lg border bg-[#2a3039] px-4 py-2.5 text-white outline-none focus:border-cyan-500/50 ${
                          confirmPass && password !== confirmPass ? "border-red-500/50" : "border-white/15"
                        }`}
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        autoComplete="new-password"
                      />
                      {confirmPass && password !== confirmPass && (
                        <p className="mt-1 text-xs text-red-400">{uiLang === "ru" ? "Пароли не совпадают" : "Passwords do not match"}</p>
                      )}
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
