import { useEffect, useRef, useState } from "react";
import type { GameLanguage } from "../lib/gameConfig";
import { type BootPhase, getBootConsoleSequence } from "../lib/bootConsoleSequence";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type LoadingScreenProps = {
  /** Язык подписей rescue/подсказок в консоли */
  lang?: GameLanguage;
  /** Ранняя загрузка конфига или сессия после логина */
  phase?: BootPhase;
  /** Плавно скрыть консоль (при переходе на следующий экран). */
  fadeOut?: boolean;
  fadeMs?: number;
};

/**
 * Полноэкранная «консоль» в духе boot Linux / systemd.
 */
export function LoadingScreen({
  lang = "ru",
  phase = "early",
  fadeOut = false,
  fadeMs = 450
}: LoadingScreenProps) {
  const [lines, setLines] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef(getBootConsoleSequence(lang, phase));

  useEffect(() => {
    stepsRef.current = getBootConsoleSequence(lang, phase);
  }, [lang, phase]);

  useEffect(() => {
    let cancelled = false;
    setLines([]);

    const run = async () => {
      const steps = stepsRef.current;
      for (const step of steps) {
        if (cancelled) return;
        await sleep(Math.max(15, step.pauseMs));
        if (cancelled) return;
        setLines((prev) => [...prev, step.line]);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [lang, phase]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
      style={{
        opacity: fadeOut ? 0 : 1,
        transition: `opacity ${fadeMs}ms ease-in-out`,
        willChange: "opacity",
        pointerEvents: fadeOut ? "none" : "auto"
      }}
    >
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 pt-4 font-mono text-[13px] leading-snug tracking-tight sm:px-6 sm:text-sm"
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, "Cascadia Code", "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, monospace',
          textShadow: "0 0 1px rgba(255,255,255,0.08)"
        }}
        aria-busy="true"
        aria-live="polite"
      >
        {lines.map((line, i) => (
          <div
            key={`${i}-${line.slice(0, 24)}`}
            className={`whitespace-pre-wrap break-all ${/\[\s*OK\s*\]/i.test(line) ? "text-emerald-400" : "text-white"}`}
          >
            {line.length === 0 ? "\u00a0" : line}
          </div>
        ))}
        <div className="mt-0.5 flex items-center gap-0.5">
          <span className="boot-cursor opacity-90">_</span>
        </div>
      </div>
    </div>
  );
}
