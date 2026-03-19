/** IANA + позиция маркера на условной карте (viewBox 0 0 100 50). */
export type TimezoneChoice = {
  id: string;
  cx: number;
  cy: number;
  regionRu: string;
  regionEn: string;
};

export const INSTALL_TIMEZONES: TimezoneChoice[] = [
  { id: "Europe/Kaliningrad", cx: 52, cy: 28, regionRu: "Калининград", regionEn: "Kaliningrad" },
  { id: "Europe/Moscow", cx: 58, cy: 30, regionRu: "Москва", regionEn: "Moscow" },
  { id: "Europe/Samara", cx: 62, cy: 32, regionRu: "Самара", regionEn: "Samara" },
  { id: "Asia/Yekaterinburg", cx: 68, cy: 30, regionRu: "Екатеринбург", regionEn: "Yekaterinburg" },
  { id: "Asia/Novosibirsk", cx: 74, cy: 28, regionRu: "Новосибирск", regionEn: "Novosibirsk" },
  { id: "Asia/Vladivostok", cx: 86, cy: 32, regionRu: "Владивосток", regionEn: "Vladivostok" },
  { id: "Europe/Kyiv", cx: 54, cy: 30, regionRu: "Киев", regionEn: "Kyiv" },
  { id: "Europe/Warsaw", cx: 53, cy: 29, regionRu: "Варшава", regionEn: "Warsaw" },
  { id: "Europe/Berlin", cx: 51, cy: 28, regionRu: "Берлин", regionEn: "Berlin" },
  { id: "Europe/London", cx: 48, cy: 27, regionRu: "Лондон", regionEn: "London" },
  { id: "Europe/Paris", cx: 49, cy: 28, regionRu: "Париж", regionEn: "Paris" },
  { id: "Africa/Cairo", cx: 56, cy: 34, regionRu: "Каир", regionEn: "Cairo" },
  { id: "Asia/Dubai", cx: 64, cy: 36, regionRu: "Дубай", regionEn: "Dubai" },
  { id: "Asia/Tokyo", cx: 90, cy: 32, regionRu: "Токио", regionEn: "Tokyo" },
  { id: "Asia/Shanghai", cx: 82, cy: 34, regionRu: "Шанхай", regionEn: "Shanghai" },
  { id: "Australia/Sydney", cx: 92, cy: 44, regionRu: "Сидней", regionEn: "Sydney" },
  { id: "America/New_York", cx: 28, cy: 30, regionRu: "Нью-Йорк", regionEn: "New York" },
  { id: "America/Chicago", cx: 24, cy: 30, regionRu: "Чикаго", regionEn: "Chicago" },
  { id: "America/Los_Angeles", cx: 18, cy: 31, regionRu: "Лос-Анджелес", regionEn: "Los Angeles" },
  { id: "America/Sao_Paulo", cx: 32, cy: 42, regionRu: "Сан-Паулу", regionEn: "São Paulo" },
  { id: "Pacific/Auckland", cx: 96, cy: 46, regionRu: "Окленд", regionEn: "Auckland" },
  { id: "UTC", cx: 50, cy: 25, regionRu: "Всемирное время (UTC)", regionEn: "Coordinated Universal Time" }
];

export function getDefaultTimezoneId(): string {
  try {
    const guessed = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (INSTALL_TIMEZONES.some((z) => z.id === guessed)) return guessed;
  } catch {
    /* ignore */
  }
  return "Europe/Moscow";
}
