import type { GameLanguage } from "../gameConfig";

export type InstallWizardCopy = {
  headerBrand: string;
  headerSession: string;
  slides: { title: string; body: string }[];
  stepLine: (n: number) => string;
  title: string;
  welcomeTitle: string;
  welcomeLead: string;
  welcomeBullet1: string;
  welcomeBullet2: string;
  welcomeBullet3: string;
  welcomeBullet4: string;
  welcomeHaveAccountCta: string;
  keyboardTitle: string;
  keyboardEn: string;
  keyboardRu: string;
  regionTitle: string;
  regionHint: string;
  regionSelect: string;
  diskTitle: string;
  diskLead: string;
  diskBarEfi: string;
  diskBarRoot: string;
  diskBarSwap: string;
  diskBarHome: string;
  diskRow1: string;
  diskRow2: string;
  diskRow3: string;
  diskRow4: string;
  diskFlavor: string;
  diskOptionTitle: string;
  diskOptionDesc: string;
  diskNote: string;
  diskBusyTitle: string;
  accountTitle: string;
  accountLead: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  wsWait: string;
  back: string;
  continue: string;
  installNow: string;
  install: string;
  installingTitle: string;
  doneTitle: string;
  errUser: string;
  errEmail: string;
  errPass: string;
  errPassMatch: string;
  errWs: string;
  diskStatus: string[];
  installPackages: string[];
  installPhaseLocale: string;
  installPhaseGrub: string;
  installPhaseAccount: string;
  installPhaseFinish: string;
};

const ru: InstallWizardCopy = {
  headerBrand: "ZeroDay OS",
  headerSession: "Живая сессия установки",
  slides: [
    {
      title: "ZeroDay Linux",
      body: "Современная рабочая среда с акцентом на скорость, стабильность и удобную повседневную работу."
    },
    {
      title: "Сеть и безопасность",
      body: "Поддержка сетевых профилей, изоляции сервисов и базовых защитных политик доступна сразу после установки."
    },
    {
      title: "Терминал и стол",
      body: "После установки откроется графический стол с терминалом в духе современных Linux-дистрибутивов."
    },
    {
      title: "Локальный профиль",
      body: "Параметры системы, язык интерфейса и персональные предпочтения сохраняются локально."
    },
    {
      title: "Учётная запись",
      body: "В процессе установки создаётся учётная запись администратора для первого входа в систему."
    }
  ],
  stepLine: (n) => `Шаг ${n} из 7 — графический режим`,
  title: "Установка ZeroDay Linux",
  welcomeTitle: "Добро пожаловать",
  welcomeLead:
    "Этот мастер поможет выполнить установку системы, настроить базовые параметры и создать первую учётную запись администратора.",
  welcomeBullet1: "После завершения установки будет доступен рабочий стол с терминалом и системными инструментами",
  welcomeBullet2: "Профиль и язык интерфейса сохраняются локально",
  welcomeBullet3: "Вы сможете сразу войти под учётной записью администратора",
  welcomeBullet4: "Минимальные системные требования: 2 ядра CPU, 4 GB RAM, 32 GB диска",
  welcomeHaveAccountCta: "Есть аккаунт? Войти",
  keyboardTitle: "Раскладка клавиатуры",
  keyboardEn: "English (US) — интерфейс на английском",
  keyboardRu: "Русская — интерфейс на русском",
  regionTitle: "Часовой пояс",
  regionHint: "Выбери город или узел на карте — время в установщике будет отображаться для этого пояса.",
  regionSelect: "Список городов и узлов",
  diskTitle: "Разметка диска",
  diskLead:
    "Виртуальный диск только для ZeroDay. Реальные разделы Windows и других ОС не изменяются — это сценарий внутри игры.",
  diskBarEfi: "EFI",
  diskBarRoot: "/",
  diskBarSwap: "swap",
  diskBarHome: "/home",
  diskRow1: "/dev/vda1 — 512 MiB — EFI System Partition (boot)",
  diskRow2: "/dev/vda2 — 25 GB — основной том ext4, смонтирован как /",
  diskRow3: "/dev/vda3 — 2 GiB — раздел подкачки (swap)",
  diskRow4: "/dev/vda4 — 6.5 GB — домашний том /home (ext4)",
  diskFlavor:
    "Таблица разделов GPT. Для надёжности включён отдельный загрузочный раздел; корневая файловая система с журналированием. LVM не используется для упрощения.",
  diskOptionTitle: "Стереть виртуальный диск и установить ZeroDay",
  diskOptionDesc: "Рекомендуется для первой установки: чистая конфигурация песочницы.",
  diskNote:
    "Позже в игре можно будет добавить сценарии с LVM или снимками — сейчас используется классическая схема для скорости установки.",
  diskBusyTitle: "Выполняется разметка диска",
  accountTitle: "Учётная запись администратора",
  accountLead: "Эти данные используются для входа в сеть ZeroDay. Пароль — не короче 8 символов.",
  username: "Имя пользователя",
  email: "Email",
  password: "Пароль",
  confirmPassword: "Подтверждение пароля",
  wsWait: "Ожидание соединения с сервером ZeroDay… Убедись, что сервер запущен.",
  back: "Назад",
  continue: "Продолжить",
  installNow: "Установить сейчас",
  install: "Установить",
  installingTitle: "Установка системы",
  doneTitle: "Установка завершена",
  errUser: "Имя пользователя: 3–20 символов, a-z, 0-9, _",
  errEmail: "Некорректный email",
  errPass: "Пароль не короче 8 символов",
  errPassMatch: "Пароли не совпадают",
  errWs: "Нет соединения с сервером ZeroDay. Запусти сервер и проверь настройки подключения.",
  diskStatus: [
    "Инициализация виртуального контроллера…",
    "Запись таблицы разделов GPT…",
    "Создание файловой системы ext4 на /dev/vda2…",
    "Разметка раздела подкачки и активация swap…",
    "Монтирование целевой системы в /target …",
    "Проверка целостности блоков (быстрая проверка)…",
    "Готово."
  ],
  installPackages: [
    "zeroday-base",
    "zeroday-desktop",
    "zeroday-network",
    "zeroday-firewall",
    "zeroday-terminal",
    "zeroday-market-client",
    "zeroday-clan-sync",
    "zeroday-kernel-modules",
    "zeroday-locale-pack",
    "zeroday-themes",
    "zeroday-webengine",
    "zeroday-sec-profiles",
    "zeroday-auditd",
    "zeroday-crypto-utils"
  ],
  installPhaseLocale: "Настройка локали, часового пояса и ключей реестра времени…",
  installPhaseGrub: "Установка загрузчика и запись EFI-записи…",
  installPhaseAccount: "Создание учётной записи и регистрация в сети ZeroDay…",
  installPhaseFinish: "Завершение установки и синхронизация метаданных…"
};

const en: InstallWizardCopy = {
  headerBrand: "ZeroDay OS",
  headerSession: "Live install session",
  slides: [
    {
      title: "ZeroDay Linux",
      body: "A modern desktop environment focused on responsiveness, stability, and daily productivity."
    },
    {
      title: "Networking & security",
      body: "Network profiles, service isolation, and baseline security policies are available right after setup."
    },
    {
      title: "Terminal & desktop",
      body: "After setup you get a modern Linux-style desktop with a full terminal."
    },
    {
      title: "Local profile",
      body: "System preferences, UI language, and personal settings are saved locally on your machine."
    },
    {
      title: "Your account",
      body: "The installer creates an administrator account for your first sign-in."
    }
  ],
  stepLine: (n) => `Step ${n} of 7 — graphical installer`,
  title: "Install ZeroDay Linux",
  welcomeTitle: "Welcome",
  welcomeLead:
    "This wizard helps you install the system, configure core settings, and create your first administrator account.",
  welcomeBullet1: "After installation you get a desktop, terminal, and core system utilities",
  welcomeBullet2: "Profile and UI language are saved locally",
  welcomeBullet3: "You can sign in immediately with the administrator account",
  welcomeBullet4: "Minimum requirements: 2-core CPU, 4 GB RAM, 32 GB disk",
  welcomeHaveAccountCta: "I have an account — sign in",
  keyboardTitle: "Keyboard layout",
  keyboardEn: "English (US) — English UI",
  keyboardRu: "Russian — Russian UI",
  regionTitle: "Time zone",
  regionHint: "Pick a city or node on the map — the installer clock will use this zone.",
  regionSelect: "Cities and nodes",
  diskTitle: "Disk layout",
  diskLead:
    "Virtual disk for ZeroDay only. Your real Windows or other OS partitions stay untouched — this is in-game fiction.",
  diskBarEfi: "EFI",
  diskBarRoot: "/",
  diskBarSwap: "swap",
  diskBarHome: "/home",
  diskRow1: "/dev/vda1 — 512 MiB — EFI System Partition (boot)",
  diskRow2: "/dev/vda2 — 25 GB — main volume ext4 mounted as /",
  diskRow3: "/dev/vda3 — 2 GiB — swap partition",
  diskRow4: "/dev/vda4 — 6.5 GB — home volume /home (ext4)",
  diskFlavor:
    "GPT partition table. Dedicated boot partition; journaled root filesystem for resilience. No LVM for simplicity.",
  diskOptionTitle: "Erase virtual disk and install ZeroDay",
  diskOptionDesc: "Recommended for a first install: clean sandbox layout.",
  diskNote:
    "Future story content may add LVM or snapshots — for now we use a fast, classic layout.",
  diskBusyTitle: "Partitioning disk",
  accountTitle: "Administrator account",
  accountLead: "These credentials sign you into the ZeroDay network. Password at least 8 characters.",
  username: "Username",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
  wsWait: "Waiting for ZeroDay server… Make sure the server is running.",
  back: "Back",
  continue: "Continue",
  installNow: "Install now",
  install: "Install",
  installingTitle: "Installing system",
  doneTitle: "Installation complete",
  errUser: "Username: 3–20 chars, a-z, 0-9, _",
  errEmail: "Invalid email",
  errPass: "Password at least 8 characters",
  errPassMatch: "Passwords do not match",
  errWs: "Cannot reach ZeroDay server. Start the server and check your connection settings.",
  diskStatus: [
    "Initializing virtual storage controller…",
    "Writing GPT partition table…",
    "Creating ext4 on /dev/vda2…",
    "Preparing swap and enabling pager…",
    "Mounting target at /target …",
    "Quick block integrity scan…",
    "Done."
  ],
  installPackages: [
    "zeroday-base",
    "zeroday-desktop",
    "zeroday-network",
    "zeroday-firewall",
    "zeroday-terminal",
    "zeroday-market-client",
    "zeroday-clan-sync",
    "zeroday-kernel-modules",
    "zeroday-locale-pack",
    "zeroday-themes",
    "zeroday-webengine",
    "zeroday-sec-profiles",
    "zeroday-auditd",
    "zeroday-crypto-utils"
  ],
  installPhaseLocale: "Configuring locale, time zone, and time registry keys…",
  installPhaseGrub: "Installing boot loader and EFI entry…",
  installPhaseAccount: "Creating account and registering with ZeroDay network…",
  installPhaseFinish: "Finalizing install and syncing metadata…"
};

export function getInstallWizardCopy(lang: GameLanguage): InstallWizardCopy {
  return lang === "en" ? en : ru;
}
