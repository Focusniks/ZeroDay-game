import type { TimezoneChoice } from "../../data/timezones";
import type { GameLanguage } from "../../lib/gameConfig";

type Props = {
  zones: TimezoneChoice[];
  selectedId: string;
  onSelect: (id: string) => void;
  lang: GameLanguage;
};

export function InstallWorldMap({ zones, selectedId, onSelect, lang }: Props) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#0c4a6e]/30 via-[#0f172a] to-[#020617] shadow-inner">
      <div className="absolute left-2 top-2 z-10 max-w-[55%] rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-slate-400 backdrop-blur-sm">
        {lang === "ru"
          ? "Симуляция карты сети: выберите узел или город из списка."
          : "Network map simulation: pick a node or city from the list."}
      </div>
      <svg viewBox="0 0 100 50" className="block h-44 w-full md:h-52" role="img" aria-hidden>
        <defs>
          <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="0.15" />
          </pattern>
          <radialGradient id="glow" cx="50%" cy="40%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.15)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0)" />
          </radialGradient>
        </defs>
        <rect width="100" height="50" fill="url(#grid)" />
        <rect width="100" height="50" fill="url(#glow)" />
        {/* упрощённые «континенты» */}
        <path
          d="M 12 22 Q 20 18 28 24 T 38 28 Q 42 32 36 38 T 22 40 Q 14 36 12 22 Z"
          fill="rgba(45,212,191,0.06)"
          stroke="rgba(45,212,191,0.12)"
          strokeWidth="0.2"
        />
        <path
          d="M 44 20 Q 58 16 72 22 T 88 28 Q 92 34 84 40 T 58 42 Q 48 38 44 20 Z"
          fill="rgba(99,102,241,0.06)"
          stroke="rgba(99,102,241,0.12)"
          strokeWidth="0.2"
        />
        <path
          d="M 28 38 Q 38 36 48 42 T 62 44 Q 58 48 42 46 T 28 38 Z"
          fill="rgba(251,191,36,0.05)"
          stroke="rgba(251,191,36,0.1)"
          strokeWidth="0.2"
        />
        {zones.map((z) => {
          const active = z.id === selectedId;
          return (
            <g
              key={z.id}
              className="cursor-pointer transition-opacity hover:opacity-100"
              style={{ opacity: active ? 1 : 0.65 }}
              onClick={() => onSelect(z.id)}
            >
              <circle
                cx={z.cx}
                cy={z.cy}
                r={active ? 2.4 : 1.5}
                fill={active ? "#22d3ee" : "#64748b"}
                stroke={active ? "#a5f3fc" : "#334155"}
                strokeWidth="0.35"
              />
              {active ? (
                <circle cx={z.cx} cy={z.cy} r="4.5" fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth="0.25" />
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
