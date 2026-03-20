import type { GameLanguage } from "../gameConfig";

export type GameStrings = {
  loadingTitle: string;
  loadingSubtitle: string;
  /** Первый экран до готовности GameConfigProvider */
  bootConfigSubtitle: string;
  loginMenuTitle: string;
  loginEmail: string;
  loginPassword: string;
  loginSubmit: string;
  loginSubmitLoading: string;
  loginErrEmail: string;
  loginErrPassword: string;
  loginErrGeneric: string;
  connConnecting: string;
  connOpen: string;
  connClosed: string;
  connError: string;
  dashboardActions: string;
  dashboardSubtitle: string;
  dashboardLogout: string;
  dockTerminal: string;
  dockFiles: string;
  dockNetwork: string;
  dockSettings: string;
  terminalWindowTitle: string;
  profileTitle: string;
  profileId: string;
  profileEmail: string;
  profileIp: string;
  systemTitle: string;
  systemKernel: string;
  systemDesktop: string;
  systemFirewall: string;
};

const ru: GameStrings = {
  loadingTitle: "Инициализация системы",
  loadingSubtitle: "Запуск среды ZeroDay Linux…",
  bootConfigSubtitle: "Загрузка локального профиля и настроек…",
  loginMenuTitle: "Главное меню — вход",
  loginEmail: "Логин (email или ник)",
  loginPassword: "Пароль",
  loginSubmit: "Войти",
  loginSubmitLoading: "Вход…",
  loginErrEmail: "Некорректный логин. Введите email или никнейм.",
  loginErrPassword: "Пароль не короче 8 символов.",
  loginErrGeneric: "Не удалось войти. Попробуйте снова.",
  connConnecting: "Соединение с сетью ZeroDay…",
  connOpen: "Сеть ZeroDay: подключено",
  connClosed: "Сеть ZeroDay: нет соединения (проверь `wsUrl` и запущен ли backend)",
  connError: "Сеть ZeroDay: ошибка канала (проверь `wsUrl` в конфиге и повтори попытку)",
  dashboardActions: "Действия",
  dashboardSubtitle: "ZeroDay Desktop",
  dashboardLogout: "Выйти",
  dockTerminal: "Терминал",
  dockFiles: "Файлы",
  dockNetwork: "Сеть",
  dockSettings: "Параметры",
  terminalWindowTitle: "Терминал — сессия",
  profileTitle: "Профиль",
  profileId: "id",
  profileEmail: "email",
  profileIp: "IP",
  systemTitle: "Система",
  systemKernel: "Ядро: zeroday-linux 0.1",
  systemDesktop: "Стол: ZeroDay Desktop",
  systemFirewall: "Firewall: вкл."
};

const en: GameStrings = {
  loadingTitle: "System initialization",
  loadingSubtitle: "Starting ZeroDay Linux environment…",
  bootConfigSubtitle: "Loading local profile and settings…",
  loginMenuTitle: "Main menu — sign in",
  loginEmail: "Login (email or username)",
  loginPassword: "Password",
  loginSubmit: "Sign in",
  loginSubmitLoading: "Signing in…",
  loginErrEmail: "Invalid login. Enter email or username.",
  loginErrPassword: "Password must be at least 8 characters.",
  loginErrGeneric: "Sign-in failed. Please try again.",
  connConnecting: "Connecting to ZeroDay network…",
  connOpen: "ZeroDay network: connected",
  connClosed: "ZeroDay network: offline (check `wsUrl` and make sure backend is running)",
  connError: "ZeroDay network: channel error (verify `wsUrl` and try again)",
  dashboardActions: "Activities",
  dashboardSubtitle: "ZeroDay Desktop",
  dashboardLogout: "Log out",
  dockTerminal: "Terminal",
  dockFiles: "Files",
  dockNetwork: "Network",
  dockSettings: "Settings",
  terminalWindowTitle: "Terminal — session",
  profileTitle: "Profile",
  profileId: "id",
  profileEmail: "email",
  profileIp: "IP",
  systemTitle: "System",
  systemKernel: "Kernel: zeroday-linux 0.1",
  systemDesktop: "Desktop: ZeroDay Desktop",
  systemFirewall: "Firewall: on"
};

export function getGameStrings(lang: GameLanguage): GameStrings {
  return lang === "en" ? en : ru;
}
