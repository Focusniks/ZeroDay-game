import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "../../types/auth";
import type { GameLanguage } from "../../lib/gameConfig";
import { useI18n } from "../../hooks/useI18n";
import { initGameFs, listFs, readTextFs, writeTextFs, type FsEntry } from "../../lib/gameFs";
import { execTerminalFsLine } from "../../lib/terminalCommands";
import {
  formatPromptCwd,
  resolveVirtualPath,
  shellSplit,
  splitPathCompletionArg
} from "../../lib/terminalFs";
import { runHackScript } from "../../lib/hackScript";
import {
  playWindowClose,
  playWindowMaximize,
  playWindowMinimize,
  playWindowRestore
} from "../../lib/osSounds";
import { useWindowFrame } from "../../desktop/modules/WindowFrameModule";

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

/** Keep prompt on one line when cwd/user contains spaces (avoid break-words splitting). */
function nbPath(s: string): string {
  return s.replace(/ /g, "\u00a0");
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

  const [cwdRel, setCwdRel] = useState("");
  const cwdRef = useRef("");
  cwdRef.current = cwdRel;

  const prompt = useMemo(
    () => `user@${nbPath(username)}:${nbPath(formatPromptCwd(cwdRel))}$`,
    [username, cwdRel]
  );

  const [lines, setLines] = useState<string[]>([]);
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const runCommandRef = useRef<(cmd: string) => void>(() => {});
  // Used to "interrupt" long-running-ish commands (currently only hackrun uses async file read).
  const execTokenRef = useRef(0);

  const { rect, maximized, startDrag, startResize, toggleMaximize } = useWindowFrame({
    defaultSize: { w: 1080, h: 700 },
    minSize: { w: 320, h: 220 }
  });

  const maximizedRef = useRef(maximized);
  useEffect(() => {
    maximizedRef.current = maximized;
  }, [maximized]);

  useEffect(() => {
    setLines([]);
    setCmd("");
    setHistory([]);
    setHistoryIdx(null);
    setCwdRel("");
  }, [user?.id]);

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
        "Файловая система (относительно текущей папки, как в Linux):",
        "  pwd, cd [путь], ls [-la] [путь…], tree [-L N] [путь]",
        "  cat <файл…>, mkdir <папка…>, rmdir <пустая_папка>",
        "  rm [-rf] <путь…>, mv <откуда> <куда>, cp <файл> <файл>",
        "  touch <файл…>, df — диск, echo [текст] [>|>> файл]",
        "  hackrun <скрипт.hack> — выполнить HackScript",
        "",
        "Информация о системе:",
        "  whoami, ip, profile, hostname, date, uptime",
        "",
        "Прочее:",
        "  help, clear, exit, logout"
      ].join("\n");
    }
    return [
      "Filesystem (paths relative to current directory, Linux-like):",
      "  pwd, cd [path], ls [-la] [path…], tree [-L N] [path]",
      "  cat <file…>, mkdir <dir…>, rmdir <empty_dir>",
      "  rm [-rf] <path…>, mv <src> <dst>, cp <file> <file>",
      "  touch <file…>, df — virtual disk, echo [text] [> or >> file]",
      "  hackrun <script.hack> — execute HackScript",
      "",
      "System information:",
      "  whoami, ip, profile, hostname, date, uptime",
      "",
      "Other:",
      "  help, clear, exit, logout"
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
      "pwd",
      "cd",
      "ls",
      "cat",
      "mkdir",
      "rmdir",
      "rm",
      "mv",
      "cp",
      "touch",
      "tree",
      "df",
      "echo",
      "hackrun",
      "hostname",
      "date",
      "uptime"
    ];
  }, []);

  const pathCompleteCommands = useMemo(
    () =>
      new Set([
        "cd",
        "ls",
        "cat",
        "mkdir",
        "rmdir",
        "rm",
        "mv",
        "cp",
        "touch",
        "hackrun"
      ]),
    []
  );

  const printLines = (extra: string[]) => {
    if (!extra.length) return;
    setLines((prev) => [...prev, ...extra]);
  };

  const completeFromCandidates = (candidates: string[], prefix: string) => {
    const p = prefix.toLowerCase();
    const matches = candidates.filter((c) => c.toLowerCase().startsWith(p));
    return matches;
  };

  const listPathCompletion = async (
    cwd: string,
    partial: string,
    hackOnly: boolean
  ): Promise<string[]> => {
    await initGameFs();
    const { dirPart, namePrefix } = splitPathCompletionArg(partial);
    const dirResolved = resolveVirtualPath(cwd, dirPart);
    let items: FsEntry[];
    try {
      items = await listFs(dirResolved);
    } catch {
      return [];
    }
    let names = items.map((i) => i.name);
    if (hackOnly) {
      names = names.filter((n) => n.toLowerCase().endsWith(".hack"));
    }
    return names.filter((n) => n.toLowerCase().startsWith(namePrefix.toLowerCase()));
  };

  const onTabComplete = async () => {
    const raw = cmd;
    const cleaned = raw.trim();

    // If input is empty -> do nothing
    if (!cleaned && !raw.endsWith(" ")) return;

    const hasTrailingSpace = /\s$/.test(raw);
    const words = cleaned.length ? shellSplit(cleaned) : [];

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

    const command = words[0]?.toLowerCase() ?? "";

    // Case B: path completion (cd, ls, cat, …, hackrun)
    if (pathCompleteCommands.has(command)) {
      const hackOnly = command === "hackrun";
      if (words.length === 1 && hasTrailingSpace) {
        const matches = await listPathCompletion(cwdRef.current, "", hackOnly);
        if (!matches.length) {
          printLines([isRu ? "Нет совпадений." : "No matches."]);
          return;
        }
        printLines([isRu ? "Варианты:" : "Matches:", ...matches]);
        return;
      }
      if (words.length >= 2) {
        const argPrefix = hasTrailingSpace ? "" : words[words.length - 1] ?? "";
        const matches = await listPathCompletion(cwdRef.current, argPrefix, hackOnly);
        if (!matches.length) {
          printLines([isRu ? "Нет совпадений." : "No matches."]);
          return;
        }
        if (hasTrailingSpace) {
          printLines([isRu ? "Варианты:" : "Matches:", ...matches]);
          return;
        }
        const { dirPart } = splitPathCompletionArg(argPrefix);
        if (matches.length === 1) {
          const m = matches[0]!;
          const tail = dirPart ? `${dirPart}/${m}` : m;
          const rebuilt = [...words.slice(0, -1), tail].join(" ");
          setCmd(rebuilt);
          return;
        }
        printLines([isRu ? "Варианты:" : "Matches:", ...matches]);
        return;
      }
    }

    // Fallback: completing first word even if there is a trailing space is not supported
    if (words.length === 1 && hasTrailingSpace) return;
  };

  const runCommand = (rawCmd: string) => {
    const normalized = normalizeCommand(rawCmd);
    if (!normalized) return;

    setHistory((h) => [...h, normalized]);
    setHistoryIdx(null);

    const argv = shellSplit(normalized);
    const command = argv[0]?.toLowerCase() ?? "";
    const args = argv.slice(1);

    const isRu = lang === "ru";

    setLines((prev) => [...prev, `${prompt} ${normalized}`]);

    if (command === "hackrun") {
      const target = args.join(" ").trim();

      if (!target) {
        setLines((prev) => [
          ...prev,
          isRu ? "Использование: hackrun <файл.hack>" : "Usage: hackrun <file.hack>"
        ]);
        setCmd("");
        return;
      }

      const normalizedTarget = target.replace(/\\/g, "/").replace(/^\.\//, "");
      let scriptRelPath = resolveVirtualPath(cwdRef.current, normalizedTarget);
      if (!scriptRelPath.toLowerCase().endsWith(".hack")) {
        scriptRelPath = `${scriptRelPath}.hack`;
      }

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

    if (command === "echo") {
      const rest = normalized.slice(4).trimStart();
      const da = rest.match(/^(.*?)\s*>>\s*(.+)$/);
      const ds = !da && rest.match(/^(.*?)\s*>\s*(.+)$/);
      if (da || ds) {
        const m = (da ?? ds) as RegExpMatchArray;
        const runToken = ++execTokenRef.current;
        void (async () => {
          try {
            await initGameFs();
            const text = m[1] ?? "";
            const destRaw = (m[2] ?? "").trim();
            const rel = resolveVirtualPath(cwdRef.current, destRaw);
            if (da) {
              let prev = "";
              try {
                prev = await readTextFs(rel);
              } catch {
                /* new file */
              }
              await writeTextFs(rel, prev + text);
            } else {
              await writeTextFs(rel, text);
            }
            if (execTokenRef.current !== runToken) return;
          } catch (e) {
            if (execTokenRef.current !== runToken) return;
            const msg = e instanceof Error ? e.message : String(e);
            setLines((prev) => [...prev, isRu ? `echo: ${msg}` : `echo: ${msg}`]);
          } finally {
            if (execTokenRef.current === runToken) setCmd("");
          }
        })();
        return;
      }

      const line = args.join(" ");
      setLines((prev) => [...prev, line]);
      setCmd("");
      return;
    }

    if (command === "clear") {
      setLines([]);
      setCmd("");
      return;
    }

    const fsFirst = new Set([
      "pwd",
      "cd",
      "ls",
      "cat",
      "mkdir",
      "rmdir",
      "rm",
      "mv",
      "cp",
      "touch",
      "tree",
      "df"
    ]);
    if (fsFirst.has(command)) {
      const runToken = ++execTokenRef.current;
      void (async () => {
        try {
          const fsRes = await execTerminalFsLine(argv, cwdRef.current, isRu);
          if (execTokenRef.current !== runToken) return;
          if (fsRes?.newCwd !== undefined) setCwdRel(fsRes.newCwd);
          if (fsRes && fsRes.lines.length > 0) {
            setLines((prev) => [...prev, ...fsRes.lines]);
          }
        } catch (e) {
          if (execTokenRef.current !== runToken) return;
          const msg = e instanceof Error ? e.message : String(e);
          setLines((prev) => [...prev, msg]);
        } finally {
          if (execTokenRef.current === runToken) setCmd("");
        }
      })();
      return;
    }

    const out: string[] = [];
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
      case "hostname":
        push(isRu ? `zeroday-pc` : `zeroday-pc`);
        break;
      case "date":
        const now = new Date();
        push(isRu ? now.toLocaleString("ru-RU") : now.toLocaleString("en-US"));
        break;
      case "uptime":
        const uptimeSec = Math.floor(performance.now() / 1000);
        const h = Math.floor(uptimeSec / 3600);
        const m = Math.floor((uptimeSec % 3600) / 60);
        const s = uptimeSec % 60;
        push(isRu ? `up ${h}h ${m}m ${s}s` : `up ${h}h ${m}m ${s}s`);
        break;
      case "profile":
        push(
          isRu
            ? `Профиль\n  id: ${user?.id ?? "n/a"}\n  email: ${user?.email ?? "n/a"}\n  level: ${level}\n  xp: ${xp}`
            : `Profile\n  id: ${user?.id ?? "n/a"}\n  email: ${user?.email ?? "n/a"}\n  level: ${level}\n  xp: ${xp}`
        );
        break;
      case "exit":
        push(isRu ? "Закрываем сессию окружения…" : "Closing environment session…");
        out.push("");
        break;
      case "logout":
        push(isRu ? "Выход из аккаунта…" : "Logging out account…");
        out.push("");
        break;
      default:
        push(
          isRu
            ? `Команда не найдена: ${command}. Попробуй: help`
            : `Command not found: ${command}. Try: help`
        );
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

  return (
    <div
      className={`terminal-window absolute z-[70] pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1117]/88 shadow-2xl backdrop-blur-md ${
        minimized ? "pointer-events-none opacity-0 scale-95" : ""
      }`}
      onMouseDown={() => onFocus?.()}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        ...(zIndex !== undefined ? { zIndex } : {})
      }}
    >
      <div
        className="flex cursor-grab items-center border-b border-white/10 bg-[#2d3139]/90 px-4 py-2.5 backdrop-blur-sm"
        onPointerDown={(e) => startDrag(e, e.currentTarget)}
        role="presentation"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="close"
            className="h-3 w-3 rounded-full bg-[#ff5f57] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              playWindowClose();
              onClose();
            }}
          />
          <button
            type="button"
            aria-label="minimize"
            className="h-3 w-3 rounded-full bg-[#febc2e] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              playWindowMinimize();
              onMinimize();
            }}
          />
          <button
            type="button"
            aria-label="maximize"
            className="h-3 w-3 rounded-full bg-[#28c840] hover:opacity-90"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (maximizedRef.current) playWindowRestore();
              else playWindowMaximize();
              toggleMaximize();
            }}
          />
        </div>
        <div className="flex-1 text-center text-xs text-slate-400">{t.terminalWindowTitle}</div>
      </div>

      {/* Resizing handles (hidden, but mouse cursor changes) */}
      {!maximized && (
        <>
          <div className="resize-handle resize-handle--n" onPointerDown={(e) => {
            onFocus?.();
            startResize(e, "n");
          }} />
          <div className="resize-handle resize-handle--s" onPointerDown={(e) => {
            onFocus?.();
            startResize(e, "s");
          }} />
          <div className="resize-handle resize-handle--e" onPointerDown={(e) => {
            onFocus?.();
            startResize(e, "e");
          }} />
          <div className="resize-handle resize-handle--w" onPointerDown={(e) => {
            onFocus?.();
            startResize(e, "w");
          }} />

          <div className="resize-handle resize-handle--nw" onPointerDown={(e) => {
            onFocus?.();
            startResize(e, "nw");
          }} />
          <div className="resize-handle resize-handle--ne" onPointerDown={(e) => {
            onFocus?.();
            startResize(e, "ne");
          }} />
          <div className="resize-handle resize-handle--sw" onPointerDown={(e) => {
            onFocus?.();
            startResize(e, "sw");
          }} />
          <div className="resize-handle resize-handle--se" onPointerDown={(e) => {
            onFocus?.();
            startResize(e, "se");
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
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <span className="shrink-0 whitespace-nowrap text-green-200">{prompt}</span>
          <input
            className="terminal-input min-w-0 flex-1 select-text bg-transparent p-0 text-sm text-green-100 outline-none"
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => {
              const key = e.key.toLowerCase();
              if (e.ctrlKey && key === "l") {
                e.preventDefault();
                setLines([]);
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

