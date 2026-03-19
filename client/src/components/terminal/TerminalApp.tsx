import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "../../types/auth";
import type { GameLanguage } from "../../lib/gameConfig";
import { useI18n } from "../../hooks/useI18n";
import { initGameFs, listFs, readTextFs, type FsEntry } from "../../lib/gameFs";
import { runHackScript } from "../../lib/hackScript";

type Props = {
  user: User | null;
  lang: GameLanguage;
  onExitGame: () => void;
  onLogout: () => void;
  onMinimize: () => void;
  onClose: () => void;
  minimized?: boolean;
  injectKey?: number;
  injectLines?: string[];
  onFocus?: () => void;
  zIndex?: number;
};

function normalizeCommand(cmd: string): string {
  return cmd.trim().replace(/\s+/g, " ");
}

export function TerminalApp({
  user,
  lang,
  onExitGame,
  onLogout,
  onMinimize,
  onClose,
  minimized = false,
  injectKey,
  injectLines,
  onFocus,
  zIndex
}: Props) {
  const { t } = useI18n();
  const username = user?.username ?? "agent";
  const ip = user?.ip_address ?? "n/a";
  const level = user?.level ?? 1;
  const xp = user?.xp ?? 0;

  const prompt = useMemo(() => `user@${username}:~$`, [username]);

  const bootBlock = useMemo(() => t.terminalBootBlock(username, ip, level, xp), [t, username, ip, level, xp]);
  const welcome = useMemo(() => t.terminalWelcomeLine(username), [t, username]);

  const initialLines = useMemo(() => [welcome, bootBlock], [welcome, bootBlock]);

  const [lines, setLines] = useState<string[]>(() => initialLines);
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const runCommandRef = useRef<(cmd: string) => void>(() => {});
  // Used to "interrupt" long-running-ish commands (currently only hackrun uses async file read).
  const execTokenRef = useRef(0);

  // Floating window geometry (fixed position, draggable by title bar)
  const [termRect, setTermRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const termRectRef = useRef(termRect);
  const [maximized, setMaximized] = useState(false);
  const maximizedRef = useRef(maximized);
  const prevRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const resizingRef = useRef<{
    dir: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
    startX: number;
    startY: number;
    startRect: { x: number; y: number; w: number; h: number };
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    maximizedRef.current = maximized;
  }, [maximized]);

  useEffect(() => {
    termRectRef.current = termRect;
  }, [termRect]);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const taskbarH = 48;

      const getDefaultRect = () => {
        const w = Math.min(1080, Math.floor(vw * 0.82));
        const h = Math.min(700, Math.floor((vh - taskbarH) * 0.72));
        const x = Math.max(10, Math.floor((vw - w) / 2));
        const y = Math.max(10, Math.floor((vh - taskbarH - h) / 2));
        return { x, y, w, h };
      };

      const getMaxRect = () => {
        const pad = 10;
        const w = Math.max(320, vw - pad * 2);
        const h = Math.max(220, vh - taskbarH - pad * 2);
        return { x: pad, y: pad, w, h };
      };

      setTermRect(maximizedRef.current ? getMaxRect() : getDefaultRect());
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      if (maximizedRef.current) return;
      const { dir, startX, startY, startRect } = r;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const taskbarH = 48;
      const minW = 320;
      const minH = 220;

      let x = startRect.x;
      let y = startRect.y;
      let w = startRect.w;
      let h = startRect.h;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Horizontal
      if (dir === "e" || dir === "ne" || dir === "se") {
        w = startRect.w + dx;
      }
      if (dir === "w" || dir === "nw" || dir === "sw") {
        x = startRect.x + dx;
        w = startRect.w - dx;
      }

      // Vertical
      if (dir === "s" || dir === "se" || dir === "sw") {
        h = startRect.h + dy;
      }
      if (dir === "n" || dir === "ne" || dir === "nw") {
        y = startRect.y + dy;
        h = startRect.h - dy;
      }

      // Clamp sizes
      w = Math.max(minW, w);
      h = Math.max(minH, h);

      // Clamp within screen and taskbar area
      const maxX = vw - w;
      x = Math.min(Math.max(0, x), maxX);

      const maxY = vh - taskbarH - h;
      y = Math.min(Math.max(0, y), maxY);

      // Re-clamp in case y clamp changed usable height
      h = Math.min(h, vh - taskbarH - y);
      w = Math.min(w, vw - x);

      setTermRect({ x, y, w, h });
    };

    const onUp = () => {
      resizingRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const cur = termRectRef.current;
      if (!dragRef.current || !cur) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = cur.w;
      const h = cur.h;
      const nextX = Math.min(Math.max(0, dragRef.current.originX + dx), vw - w);
      const nextY = Math.min(Math.max(0, dragRef.current.originY + dy), vh - h);
      setTermRect((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(() => {
    setLines(initialLines);
    setCmd("");
    setHistory([]);
    setHistoryIdx(null);
  }, [initialLines]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  useEffect(() => {
    if (injectKey === undefined) return;
    if (!injectLines?.length) return;
    // Append external "system" lines (context menu actions, etc.)
    setLines((prev) => [...prev, ...injectLines]);
  }, [injectKey]);

  const helpText = useMemo(() => {
    const isRu = lang === "ru";
    if (isRu) {
      return [
        "Доступные команды:",
        "  help            — показать справку",
        "  whoami          — показать пользователя",
        "  ip              — показать виртуальный IP",
        "  profile         — показать профиль",
        "  clear           — очистить терминал",
        "  exit            — выйти из игры",
        "  logout          — выйти из аккаунта",
        "  contracts       — контракты (заглушка)",
        "  market          — чёрный рынок (заглушка)",
        "  ctf             — турниры (заглушка)",
        "  clan            — клан (заглушка)",
        "  hackrun <file> — запустить HackScript из Scripts/"
      ].join("\n");
    }
    return [
      "Available commands:",
      "  help            — show help",
      "  whoami          — show current user",
      "  ip              — show virtual IP",
      "  profile         — show profile",
      "  clear           — clear terminal",
      "  exit            — exit game",
      "  logout          — logout account",
      "  contracts       — contracts (stub)",
      "  market          — black market (stub)",
      "  ctf             — tournaments (stub)",
      "  clan            — clan (stub)",
      "  hackrun <file> — run HackScript from Scripts/"
    ].join("\n");
  }, [lang]);

  const terminalCommands = useMemo(() => {
    return [
      "help",
      "whoami",
      "ip",
      "profile",
      "clear",
      "exit",
      "logout",
      "contracts",
      "market",
      "ctf",
      "clan",
      "hackrun"
    ];
  }, []);

  const printLines = (extra: string[]) => {
    if (!extra.length) return;
    setLines((prev) => [...prev, ...extra]);
  };

  const completeFromCandidates = (candidates: string[], prefix: string) => {
    const p = prefix.toLowerCase();
    const matches = candidates.filter((c) => c.toLowerCase().startsWith(p));
    return matches;
  };

  const listHackFiles = async (): Promise<string[]> => {
    await initGameFs();
    const items = await listFs("Scripts");
    return items
      .filter((i) => i.kind === "file" && (i.ext ?? "").toLowerCase() === "hack")
      .map((i) => i.name);
  };

  const onTabComplete = async () => {
    const raw = cmd;
    const cleaned = raw.trim();

    // If input is empty -> do nothing
    if (!cleaned && !raw.endsWith(" ")) return;

    const hasTrailingSpace = /\s$/.test(raw);
    const words = cleaned.length ? cleaned.split(/\s+/) : [];

    const isRu = lang === "ru";

    // Case A: completing first command word
    if (words.length <= 1 && !hasTrailingSpace) {
      const prefix = words[0] ?? "";
      if (!prefix) return;
      const matches = completeFromCandidates(terminalCommands, prefix);
      if (!matches.length) return;
      if (matches.length === 1) {
        setCmd(matches[0]);
        return;
      }
      printLines([isRu ? "Варианты:" : "Matches:", ...matches]);
      return;
    }

    // Case B: completing after command with hackrun
    const command = words[0]?.toLowerCase() ?? "";
    if (command === "hackrun") {
      // When user typed "hackrun " -> list all
      const argPrefix = hasTrailingSpace ? "" : words[1] ?? "";
      const hackFiles = await listHackFiles();

      const matches = hackFiles.filter((f) => f.toLowerCase().startsWith(argPrefix.toLowerCase()));
      if (!matches.length) {
        printLines([isRu ? "Нет совпадений." : "No matches."]);
        return;
      }

      if (hasTrailingSpace) {
        // Linux-like: show list when multiple options
        printLines([isRu ? "Доступные файлы:" : "Available files:", ...matches]);
        return;
      }

      if (matches.length === 1) {
        // Replace only the arg part; keep other text intact (we always append at end)
        const next = `hackrun ${matches[0]}`;
        setCmd(next);
        return;
      }

      printLines([isRu ? "Варианты:" : "Matches:", ...matches]);
      return;
    }

    // Fallback: completing first word even if there is a trailing space is not supported
    if (words.length === 1 && hasTrailingSpace) return;
  };

  const runCommand = (rawCmd: string) => {
    const normalized = normalizeCommand(rawCmd);
    if (!normalized) return;

    setHistory((h) => [...h, normalized]);
    setHistoryIdx(null);

    const out: string[] = [];
    const parts = normalized.split(" ");
    const command = parts[0]!.toLowerCase();
    const args = parts.slice(1);

    const isRu = lang === "ru";

    // echo the command line
    setLines((prev) => [...prev, `${prompt} ${normalized}`]);

    if (command === "hackrun") {
      const target = args.join(" ").trim();

      if (!target) {
        setLines((prev) => [
          ...prev,
          isRu ? "Использование: hackrun <file>" : "Usage: hackrun <file>"
        ]);
        setCmd("");
        return;
      }

      const normalizedTarget = target.replace(/\\/g, "/");
      const withHackExt = normalizedTarget.endsWith(".hack") ? normalizedTarget : `${normalizedTarget}.hack`;
      const scriptRelPath = withHackExt.startsWith("Scripts/")
        ? withHackExt
        : `Scripts/${withHackExt.replace(/^\.\//, "")}`;

      const runToken = ++execTokenRef.current;
      void (async () => {
        try {
          const source = await readTextFs(scriptRelPath);
          if (execTokenRef.current !== runToken) return;
          const res = runHackScript(source);
          if (execTokenRef.current !== runToken) return;
          setLines((prev) => [...prev, ...res.output]);
        } catch (e) {
          if (execTokenRef.current !== runToken) return;
          const msg = e instanceof Error ? e.message : String(e);
          setLines((prev) => [
            ...prev,
            isRu ? `HackScript ошибка: ${msg}` : `HackScript error: ${msg}`
          ]);
        } finally {
          if (execTokenRef.current === runToken) setCmd("");
        }
      })();

      return;
    }

    const push = (s: string) => out.push(s);

    switch (command) {
      case "help":
        push(helpText);
        break;
      case "whoami":
        push(isRu ? `Вы вошли как: ${username}` : `Signed in as: ${username}`);
        break;
      case "ip":
        push(isRu ? `Виртуальный IP: ${ip}` : `Virtual IP: ${ip}`);
        break;
      case "profile":
        push(
          isRu
            ? `Профиль\n  id: ${user?.id ?? "n/a"}\n  email: ${user?.email ?? "n/a"}\n  level: ${level}\n  xp: ${xp}`
            : `Profile\n  id: ${user?.id ?? "n/a"}\n  email: ${user?.email ?? "n/a"}\n  level: ${level}\n  xp: ${xp}`
        );
        break;
      case "clear":
        setLines(initialLines);
        setCmd("");
        return;
      case "exit":
        push(isRu ? "Закрываем сессию окружения…" : "Closing environment session…");
        out.push("");
        break;
      case "logout":
        push(isRu ? "Выход из аккаунта…" : "Logging out account…");
        out.push("");
        break;
      case "contracts":
      case "market":
      case "ctf":
      case "clan": {
        const map: Record<string, string> = {
          contracts: isRu ? "contracts: проверяем доступ к контрактам…" : "contracts: checking access…",
          market: isRu ? "market: открываем чёрный рынок…" : "market: opening black market…",
          ctf: isRu ? "ctf: поднимаем турнирный канал…" : "ctf: opening tournament channel…",
          clan: isRu ? "clan: синхронизируем клан…" : "clan: syncing clan feed…"
        };
        const target = map[command] ?? (isRu ? "Выполняем команду…" : "Executing command…");
        push(`${target}\n${isRu ? "OK. (заглушка)" : "OK. (stub)"}`);
        if (args.length > 0) push(isRu ? `Аргументы: ${args.join(", ")}` : `Args: ${args.join(", ")}`);
        break;
      }
      default:
        push(isRu ? `Команда не найдена: ${command}. Попробуй: help` : `Command not found: ${command}. Try: help`);
        break;
    }

    setLines((prev) => [...prev, ...out]);
    setCmd("");

    if (command === "exit") {
      window.setTimeout(() => onExitGame(), 250);
    }
    if (command === "logout") {
      window.setTimeout(() => onLogout(), 250);
    }
  };

  runCommandRef.current = runCommand;

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ cmd?: string }>;
      const cmd = ce.detail?.cmd;
      if (!cmd) return;
      runCommandRef.current(cmd);
    };
    window.addEventListener("zeroday:terminal-run", handler as EventListener);
    return () => window.removeEventListener("zeroday:terminal-run", handler as EventListener);
  }, []);

  const toggleMaximize = () => {
    const taskbarH = 48;
    const pad = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const getDefaultRect = () => {
      const w = Math.min(1080, Math.floor(vw * 0.82));
      const h = Math.min(700, Math.floor((vh - taskbarH) * 0.72));
      const x = Math.max(10, Math.floor((vw - w) / 2));
      const y = Math.max(10, Math.floor((vh - taskbarH - h) / 2));
      return { x, y, w, h };
    };

    const getMaxRect = () => {
      const w = Math.max(320, vw - pad * 2);
      const h = Math.max(220, vh - taskbarH - pad * 2);
      return { x: pad, y: pad, w, h };
    };

    if (maximizedRef.current) {
      setMaximized(false);
      setTermRect(prevRectRef.current ?? getDefaultRect());
      prevRectRef.current = null;
      return;
    }

    if (termRect) prevRectRef.current = termRect;
    setMaximized(true);
    setTermRect(getMaxRect());
  };

  return (
    <div
      className={`terminal-window fixed z-[70] relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl transition-all duration-180 ease-out ${
        minimized ? "pointer-events-none opacity-0 scale-95" : ""
      }`}
      onMouseDown={() => onFocus?.()}
      style={
        termRect
          ? {
              left: termRect.x,
              top: termRect.y,
              width: termRect.w,
              height: termRect.h,
              ...(zIndex !== undefined ? { zIndex } : {})
            }
          : zIndex !== undefined
            ? { zIndex }
            : undefined
      }
    >
      <div
        className="flex cursor-grab items-center border-b border-white/10 bg-[#2d3139] px-4 py-2.5"
        onMouseDown={(e) => {
          // Don't start drag when interacting with buttons inside header
          const target = e.target as HTMLElement | null;
          if (target && (target.closest("button") || target.closest("input") || target.closest(".resize-handle"))) return;
          if (maximizedRef.current) return;
          if (!termRect) return;
          dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            originX: termRect.x,
            originY: termRect.y
          };
        }}
        role="presentation"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="close"
            className="h-3 w-3 rounded-full bg-[#ff5f57] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
          />
          <button
            type="button"
            aria-label="minimize"
            className="h-3 w-3 rounded-full bg-[#febc2e] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onMinimize}
          />
          <button
            type="button"
            aria-label="maximize"
            className="h-3 w-3 rounded-full bg-[#28c840] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleMaximize}
          />
        </div>
        <div className="flex-1 text-center text-xs text-slate-400">{t.terminalWindowTitle}</div>
      </div>

      {/* Resizing handles (hidden, but mouse cursor changes) */}
      {!maximized && (
        <>
          <div className="resize-handle resize-handle--n" onPointerDown={(e) => {
            onFocus?.();
            if (!termRect) return;
            e.stopPropagation();
            e.preventDefault();
            resizingRef.current = { dir: "n", startX: e.clientX, startY: e.clientY, startRect: termRect, pointerId: e.pointerId };
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }} />
          <div className="resize-handle resize-handle--s" onPointerDown={(e) => {
            onFocus?.();
            if (!termRect) return;
            e.stopPropagation();
            e.preventDefault();
            resizingRef.current = { dir: "s", startX: e.clientX, startY: e.clientY, startRect: termRect, pointerId: e.pointerId };
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }} />
          <div className="resize-handle resize-handle--e" onPointerDown={(e) => {
            onFocus?.();
            if (!termRect) return;
            e.stopPropagation();
            e.preventDefault();
            resizingRef.current = { dir: "e", startX: e.clientX, startY: e.clientY, startRect: termRect, pointerId: e.pointerId };
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }} />
          <div className="resize-handle resize-handle--w" onPointerDown={(e) => {
            onFocus?.();
            if (!termRect) return;
            e.stopPropagation();
            e.preventDefault();
            resizingRef.current = { dir: "w", startX: e.clientX, startY: e.clientY, startRect: termRect, pointerId: e.pointerId };
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }} />

          <div className="resize-handle resize-handle--nw" onPointerDown={(e) => {
            onFocus?.();
            if (!termRect) return;
            e.stopPropagation();
            e.preventDefault();
            resizingRef.current = { dir: "nw", startX: e.clientX, startY: e.clientY, startRect: termRect, pointerId: e.pointerId };
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }} />
          <div className="resize-handle resize-handle--ne" onPointerDown={(e) => {
            onFocus?.();
            if (!termRect) return;
            e.stopPropagation();
            e.preventDefault();
            resizingRef.current = { dir: "ne", startX: e.clientX, startY: e.clientY, startRect: termRect, pointerId: e.pointerId };
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }} />
          <div className="resize-handle resize-handle--sw" onPointerDown={(e) => {
            onFocus?.();
            if (!termRect) return;
            e.stopPropagation();
            e.preventDefault();
            resizingRef.current = { dir: "sw", startX: e.clientX, startY: e.clientY, startRect: termRect, pointerId: e.pointerId };
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }} />
          <div className="resize-handle resize-handle--se" onPointerDown={(e) => {
            onFocus?.();
            if (!termRect) return;
            e.stopPropagation();
            e.preventDefault();
            resizingRef.current = { dir: "se", startX: e.clientX, startY: e.clientY, startRect: termRect, pointerId: e.pointerId };
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }} />
        </>
      )}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 select-none overflow-y-auto p-4 font-mono text-xs leading-relaxed text-green-300"
      >
        {lines.map((l, i) => (
          <div key={`${i}-${l.slice(0, 12)}`} className="whitespace-pre-wrap break-words">
            {l.length === 0 ? "\u00a0" : l}
          </div>
        ))}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-green-200">{prompt}</span>
          <input
            className="terminal-input w-full select-text bg-transparent p-0 text-sm text-green-100 outline-none"
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => {
              const key = e.key.toLowerCase();
              if (e.ctrlKey && key === "l") {
                e.preventDefault();
                setLines(initialLines);
                setCmd("");
                return;
              }
              if (e.ctrlKey && key === "c") {
                e.preventDefault();
                execTokenRef.current += 1; // invalidate pending hackrun output
                setCmd("");
                const msg = lang === "ru" ? "Интеррупт (Ctrl+C)" : "Interrupted (Ctrl+C)";
                setLines((prev) => [...prev, msg]);
                return;
              }
              if (e.ctrlKey && key === "u") {
                e.preventDefault();
                setCmd("");
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                runCommand(cmd);
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                if (!history.length) return;
                const nextIdx =
                  historyIdx === null ? history.length - 1 : Math.max(0, historyIdx - 1);
                setHistoryIdx(nextIdx);
                setCmd(history[nextIdx] ?? "");
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (!history.length) return;
                if (historyIdx === null) return;
                const nextIdx = Math.min(history.length - 1, historyIdx + 1);
                setHistoryIdx(nextIdx);
                setCmd(history[nextIdx] ?? "");
              }
              if (e.key === "Tab") {
                e.preventDefault();
                void onTabComplete();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

