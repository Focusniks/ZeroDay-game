import type { GameLanguage } from "./gameConfig";

export type BootPhase = "early" | "session";

/** Минимальное время показа консоли при первой загрузке конфига (под длину лога). */
export const EARLY_BOOT_DISPLAY_MS = 4800;

/** Минимальное время показа консоли после успешного входа. */
export const SESSION_BOOT_DISPLAY_MS = 3500;

export type BootStep = {
  /** Текст строки (уже с префиксом [  OK  ] где нужно) */
  line: string;
  /** Пауза перед показом этой строки, мс */
  pauseMs: number;
};

function jitter(base: number, spread: number): number {
  return Math.round(base + (Math.random() - 0.5) * spread);
}

/** Похоже на вывод systemd: сначала Starting…, затем [  OK  ] … */
function pair(
  starting: string,
  ok: string,
  baseDelay: number
): BootStep[] {
  return [
    { line: starting, pauseMs: jitter(baseDelay, 40) },
    { line: ok, pauseMs: jitter(85, 50) }
  ];
}

export function getBootConsoleSequence(lang: GameLanguage, phase: BootPhase): BootStep[] {
  const isRu = lang === "ru";

  const earlyRu: BootStep[] = [
    ...pair(
      "Starting kernel: zeroday-linux 6.6.18-zeroday1 …",
      "[  OK  ] Started zeroday-linux kernel scheduler.",
      55
    ),
    ...pair(
      "Starting Load Kernel Modules…",
      "[  OK  ] Finished Load Kernel Modules.",
      45
    ),
    ...pair(
      "Mounting /proc filesystem…",
      "[  OK  ] Mounted /proc filesystem.",
      30
    ),
    ...pair(
      "Mounting /sys filesystem…",
      "[  OK  ] Mounted /sys filesystem.",
      32
    ),
    ...pair(
      "Starting systemd-tmpfiles-setup.service…",
      "[  OK  ] Started systemd-tmpfiles-setup.service.",
      42
    ),
    ...pair(
      "Starting udev Kernel Device Manager…",
      "[  OK  ] Started udev Kernel Device Manager.",
      50
    ),
    ...pair(
      "Starting Journal Service…",
      "[  OK  ] Started Journal Service.",
      40
    ),
    ...pair(
      "Starting Flush Journal to Persistent Storage…",
      "[  OK  ] Finished Flush Journal to Persistent Storage.",
      55
    ),
    ...pair(
      "Starting Create Volatile Files and Directories…",
      "[  OK  ] Finished Create Volatile Files and Directories.",
      48
    ),
    ...pair(
      "Starting Network Time Synchronization…",
      "[  OK  ] Started Network Time Synchronization.",
      52
    ),
    ...pair(
      "Starting systemd-resolved.service…",
      "[  OK  ] Started systemd-resolved.service.",
      46
    ),
    ...pair(
      "Starting zeroday-firewall.service…",
      "[  OK  ] Started zeroday-firewall.service — default policies applied.",
      58
    ),
    ...pair(
      "Starting Update UTMP about System Boot/Shutdown…",
      "[  OK  ] Started Update UTMP about System Boot/Shutdown.",
      45
    ),
    {
      line: "[  OK  ] Reached target Local Encrypted Volumes.",
      pauseMs: jitter(35, 25)
    },
    {
      line: "[  OK  ] Reached target System Initialization.",
      pauseMs: jitter(40, 30)
    },
    {
      line: "[  OK  ] Reached target System Time Set.",
      pauseMs: jitter(38, 28)
    },
    ...pair(
      "Starting zeroday-local-config.service…",
      "[  OK  ] Started zeroday-local-config.service — Local user profile loader.",
      60
    ),
    {
      line: "[  OK  ] Listening on zeroday-system-config.socket.",
      pauseMs: jitter(42, 30)
    },
    {
      line: "Loading /proc/zeroday/cfg: parsing JSON profile…",
      pauseMs: jitter(70, 40)
    },
    {
      line: "[  OK  ] Reached target Local System Configuration.",
      pauseMs: jitter(45, 25)
    },
    ...pair(
      "Starting zeroday-locale.service…",
      "[  OK  ] Generated locale packs.",
      47
    ),
    ...pair(
      "Starting zeroday-auditd.service…",
      "[  OK  ] Audit subsystem enabled.",
      44
    ),
    {
      line: "",
      pauseMs: jitter(25, 15)
    },
    {
      line: "Вы в режиме ранней инициализации. Для просмотра журнала: journalctl -xb",
      pauseMs: jitter(55, 30)
    },
    {
      line: "Для перезапуска: systemctl reboot | для продолжения загрузки: systemctl default",
      pauseMs: jitter(50, 25)
    },
    {
      line: "",
      pauseMs: jitter(20, 10)
    },
    {
      line: "root@zeroday:~# systemctl isolate graphical.target",
      pauseMs: jitter(90, 40)
    },
    ...pair(
      "Starting graphical-session target…",
      "[  OK  ] Graphical session target reached.",
      58
    ),
    {
      line: "[  OK  ] Reached target Graphical User Interface.",
      pauseMs: jitter(65, 35)
    }
  ];

  const earlyEn: BootStep[] = [
    ...pair(
      "Starting kernel: zeroday-linux 6.6.18-zeroday1 …",
      "[  OK  ] Started zeroday-linux kernel scheduler.",
      55
    ),
    ...pair(
      "Starting Load Kernel Modules…",
      "[  OK  ] Finished Load Kernel Modules.",
      45
    ),
    ...pair(
      "Mounting /proc filesystem…",
      "[  OK  ] Mounted /proc filesystem.",
      30
    ),
    ...pair(
      "Mounting /sys filesystem…",
      "[  OK  ] Mounted /sys filesystem.",
      32
    ),
    ...pair(
      "Starting systemd-tmpfiles-setup.service…",
      "[  OK  ] Started systemd-tmpfiles-setup.service.",
      42
    ),
    ...pair(
      "Starting udev Kernel Device Manager…",
      "[  OK  ] Started udev Kernel Device Manager.",
      50
    ),
    ...pair(
      "Starting Journal Service…",
      "[  OK  ] Started Journal Service.",
      40
    ),
    ...pair(
      "Starting Flush Journal to Persistent Storage…",
      "[  OK  ] Finished Flush Journal to Persistent Storage.",
      55
    ),
    ...pair(
      "Starting Create Volatile Files and Directories…",
      "[  OK  ] Finished Create Volatile Files and Directories.",
      48
    ),
    ...pair(
      "Starting Network Time Synchronization…",
      "[  OK  ] Started Network Time Synchronization.",
      52
    ),
    ...pair(
      "Starting systemd-resolved.service…",
      "[  OK  ] Started systemd-resolved.service.",
      46
    ),
    ...pair(
      "Starting zeroday-firewall.service…",
      "[  OK  ] Started zeroday-firewall.service — default policies applied.",
      58
    ),
    ...pair(
      "Starting Update UTMP about System Boot/Shutdown…",
      "[  OK  ] Started Update UTMP about System Boot/Shutdown.",
      45
    ),
    {
      line: "[  OK  ] Reached target Local Encrypted Volumes.",
      pauseMs: jitter(35, 25)
    },
    {
      line: "[  OK  ] Reached target System Initialization.",
      pauseMs: jitter(40, 30)
    },
    {
      line: "[  OK  ] Reached target System Time Set.",
      pauseMs: jitter(38, 28)
    },
    ...pair(
      "Starting zeroday-local-config.service…",
      "[  OK  ] Started zeroday-local-config.service — Local profile loader.",
      60
    ),
    {
      line: "[  OK  ] Listening on zeroday-system-config.socket.",
      pauseMs: jitter(42, 30)
    },
    {
      line: "Loading /proc/zeroday/cfg: parsing JSON profile…",
      pauseMs: jitter(70, 40)
    },
    {
      line: "[  OK  ] Reached target Local System Configuration.",
      pauseMs: jitter(45, 25)
    },
    ...pair(
      "Starting zeroday-locale.service…",
      "[  OK  ] Generated locale packs.",
      47
    ),
    ...pair(
      "Starting zeroday-auditd.service…",
      "[  OK  ] Audit subsystem enabled.",
      44
    ),
    { line: "", pauseMs: jitter(25, 15) },
    {
      line: "You are in early userspace. To view logs: journalctl -xb",
      pauseMs: jitter(55, 30)
    },
    {
      line: "To reboot: systemctl reboot | to continue: systemctl default",
      pauseMs: jitter(50, 25)
    },
    { line: "", pauseMs: jitter(20, 10) },
    {
      line: "root@zeroday:~# systemctl isolate graphical.target",
      pauseMs: jitter(90, 40)
    },
    ...pair(
      "Starting graphical-session target…",
      "[  OK  ] Graphical session target reached.",
      58
    ),
    {
      line: "[  OK  ] Reached target Graphical User Interface.",
      pauseMs: jitter(65, 35)
    }
  ];

  const sessionRu: BootStep[] = [
    ...pair(
      "Starting zeroday-session-manager.service…",
      "[  OK  ] Started zeroday-session-manager.service.",
      48
    ),
    ...pair(
      "Starting Authorize User Credentials…",
      "[  OK  ] Finished Authorize User Credentials.",
      55
    ),
    ...pair(
      "Starting user locale and input-method…",
      "[  OK  ] User locale initialized.",
      52
    ),
    ...pair(
      "Starting terminal emulator…",
      "[  OK  ] Started terminal emulator.",
      58
    ),
    ...pair(
      "Starting Mount user keyring…",
      "[  OK  ] Started Mount user keyring.",
      42
    ),
    ...pair(
      "Starting zeroday-desktop-environment.service…",
      "[  OK  ] Started zeroday-desktop-environment.service.",
      58
    ),
    {
      line: "[  OK  ] Reached target User Session.",
      pauseMs: jitter(40, 25)
    },
    {
      line: "[  OK  ] Started zeroday-panel.service.",
      pauseMs: jitter(45, 30)
    },
    ...pair(
      "Starting dock and workspace manager…",
      "[  OK  ] Dock manager ready.",
      46
    ),
    ...pair(
      "Starting zeroday-network-namespace.service…",
      "[  OK  ] Started zeroday-network-namespace.service.",
      52
    ),
    {
      line: "virt-ip: assigning 192.168.x.x to zd0 …",
      pauseMs: jitter(75, 35)
    },
    {
      line: "[  OK  ] Reached target Multi-User System.",
      pauseMs: jitter(38, 22)
    },
    { line: "", pauseMs: jitter(22, 12) },
    {
      line: "boot> terminal: probing shell profile…",
      pauseMs: jitter(65, 30)
    },
    {
      line: "user@zeroday:~$ exec startx -- /usr/bin/zeroday-session",
      pauseMs: jitter(95, 45)
    },
    {
      line: "[  OK  ] Session opened for user.",
      pauseMs: jitter(55, 30)
    }
  ];

  const sessionEn: BootStep[] = [
    ...pair(
      "Starting zeroday-session-manager.service…",
      "[  OK  ] Started zeroday-session-manager.service.",
      48
    ),
    ...pair(
      "Starting Authenticate user session…",
      "[  OK  ] Finished Authenticate user session.",
      55
    ),
    ...pair(
      "Starting user locale and input-method…",
      "[  OK  ] User locale initialized.",
      52
    ),
    ...pair(
      "Starting terminal emulator…",
      "[  OK  ] Started terminal emulator.",
      58
    ),
    ...pair(
      "Starting Mount user keyring…",
      "[  OK  ] Started Mount user keyring.",
      42
    ),
    ...pair(
      "Starting zeroday-desktop-environment.service…",
      "[  OK  ] Started zeroday-desktop-environment.service.",
      58
    ),
    {
      line: "[  OK  ] Reached target User Session.",
      pauseMs: jitter(40, 25)
    },
    {
      line: "[  OK  ] Started zeroday-panel.service.",
      pauseMs: jitter(45, 30)
    },
    ...pair(
      "Starting dock and workspace manager…",
      "[  OK  ] Dock manager ready.",
      46
    ),
    ...pair(
      "Starting zeroday-network-namespace.service…",
      "[  OK  ] Started zeroday-network-namespace.service.",
      52
    ),
    {
      line: "virt-ip: assigning 192.168.x.x to zd0 …",
      pauseMs: jitter(75, 35)
    },
    {
      line: "[  OK  ] Reached target Multi-User System.",
      pauseMs: jitter(38, 22)
    },
    { line: "", pauseMs: jitter(22, 12) },
    {
      line: "boot> terminal: probing shell profile…",
      pauseMs: jitter(65, 30)
    },
    {
      line: "user@zeroday:~$ exec startx -- /usr/bin/zeroday-session",
      pauseMs: jitter(95, 45)
    },
    {
      line: "[  OK  ] Session opened for user.",
      pauseMs: jitter(55, 30)
    }
  ];

  if (phase === "early") {
    return isRu ? earlyRu : earlyEn;
  }
  return isRu ? sessionRu : sessionEn;
}
