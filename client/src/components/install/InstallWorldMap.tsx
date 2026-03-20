import { useEffect, useMemo, useState } from "react";
import type { TimezoneChoice } from "../../data/timezones";
import type { GameLanguage } from "../../lib/gameConfig";

type Props = {
  zones: TimezoneChoice[];
  selectedId: string;
  onSelect: (id: string) => void;
  lang: GameLanguage;
};

// Симуляция "сетевых узлов" с анимацией
type NetworkNode = {
  x: number;
  y: number;
  id: string;
  status: "online" | "busy" | "offline";
  ping: number;
};

// Упрощённые контуры континентов для фоновой карты (SVG paths)
const CONTINENTS = {
  northAmerica: "M 15 12 L 18 10 L 25 10 L 30 14 L 28 20 L 22 22 L 18 20 L 14 18 Z",
  southAmerica: "M 22 24 L 26 24 L 28 28 L 26 35 L 23 38 L 20 32 L 20 26 Z",
  europe: "M 48 12 L 52 11 L 56 12 L 58 16 L 54 18 L 50 17 L 47 15 Z",
  africa: "M 45 20 L 52 20 L 56 24 L 54 32 L 50 35 L 45 30 L 43 24 Z",
  asia: "M 58 10 L 75 10 L 82 16 L 78 24 L 68 24 L 60 20 L 56 15 Z",
  australia: "M 78 30 L 86 30 L 88 35 L 84 38 L 78 36 Z",
  greenland: "M 38 6 L 44 6 L 46 10 L 42 11 L 38 9 Z"
};

export function InstallWorldMap({ zones, selectedId, onSelect, lang }: Props) {
  const [networkNodes, setNetworkNodes] = useState<NetworkNode[]>([]);
  const [scanLine, setScanLine] = useState(0);

  // Инициализация сетевых узлов на основе часовых поясов
  useEffect(() => {
    const nodes: NetworkNode[] = zones.map((z) => ({
      x: z.cx * 10,
      y: z.cy * 10,
      id: z.id,
      status: Math.random() > 0.1 ? "online" : Math.random() > 0.5 ? "busy" : "offline",
      ping: Math.floor(Math.random() * 80) + 5
    }));
    setNetworkNodes(nodes);

    // Анимация "сканирования сети"
    const interval = setInterval(() => {
      setScanLine((prev) => (prev + 1) % 100);
      // Периодически обновляем статус узлов
      if (Math.random() > 0.7) {
        setNetworkNodes((prev) =>
          prev.map((node) => ({
            ...node,
            status: Math.random() > 0.05 ? node.status : Math.random() > 0.5 ? "online" : "busy"
          }))
        );
      }
    }, 100);

    return () => clearInterval(interval);
  }, [zones]);

  const selectedNode = useMemo(() => 
    networkNodes.find((n) => n.id === selectedId),
    [networkNodes, selectedId]
  );

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-b from-[#0c4a6e]/40 via-[#0f172a] to-[#020617] shadow-inner">
      {/* Статус бар сети */}
      <div className="absolute left-2 right-2 top-2 z-20 flex items-center justify-between gap-2 rounded-lg border border-cyan-500/20 bg-black/60 px-3 py-2 text-xs backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="h-2 w-2 rounded-full bg-red-400" />
          </div>
          <span className="text-[10px] text-slate-400">
            {lang === "ru" ? "Сеть: " : "Network: "}
            <span className="font-mono text-emerald-400">{networkNodes.filter(n => n.status === "online").length}/{networkNodes.length} {lang === "ru" ? "узлов" : "nodes"}</span>
          </span>
        </div>
        {selectedNode && (
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="text-slate-400">{selectedNode.id.split("/")[1] || selectedNode.id}</span>
            <span className="text-cyan-400">{selectedNode.ping}ms</span>
            <span className={`rounded px-1.5 py-0.5 ${
              selectedNode.status === "online" ? "bg-emerald-500/20 text-emerald-400" :
              selectedNode.status === "busy" ? "bg-amber-500/20 text-amber-400" :
              "bg-red-500/20 text-red-400"
            }`}>
              {selectedNode.status.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="absolute left-2 top-12 z-10 max-w-[60%] rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-slate-400 backdrop-blur-sm">
        {lang === "ru"
          ? "Интерактивная карта сети ZeroDay. Выберите узел для синхронизации времени."
          : "ZeroDay interactive network map. Select a node to sync time."}
      </div>

      <svg viewBox="0 0 100 50" className="block h-48 w-full md:h-56" role="img" aria-label={lang === "ru" ? "Карта сети" : "Network map"}>
        <defs>
          <pattern id="grid" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M 4 0 L 0 0 0 4" fill="none" stroke="rgba(34,211,238,0.06)" strokeWidth="0.2" />
          </pattern>
          <radialGradient id="glow" cx="50%" cy="40%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.12)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0)" />
          </radialGradient>
          <linearGradient id="scanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(34,211,238,0)" />
            <stop offset="50%" stopColor="rgba(34,211,238,0.3)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </linearGradient>
          <filter id="nodeGlow">
            <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(15,32,39,0.8)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0.9)" />
          </linearGradient>
        </defs>
        
        {/* Океан */}
        <rect width="100" height="50" fill="url(#oceanGradient)" />
        
        {/* Сетка */}
        <rect width="100" height="50" fill="url(#grid)" />
        <rect width="100" height="50" fill="url(#glow)" />
        
        {/* Сканирующая линия */}
        <rect x="0" y={scanLine * 0.5} width="100" height="2" fill="url(#scanGradient)" opacity="0.5" />
        
        {/* Реальная карта мира - континенты */}
        <g opacity="0.15">
          <path d={CONTINENTS.northAmerica} fill="rgba(34,197,94,0.4)" stroke="rgba(34,197,94,0.6)" strokeWidth="0.3" />
          <path d={CONTINENTS.southAmerica} fill="rgba(34,197,94,0.4)" stroke="rgba(34,197,94,0.6)" strokeWidth="0.3" />
          <path d={CONTINENTS.europe} fill="rgba(59,130,246,0.4)" stroke="rgba(59,130,246,0.6)" strokeWidth="0.3" />
          <path d={CONTINENTS.africa} fill="rgba(251,191,36,0.4)" stroke="rgba(251,191,36,0.6)" strokeWidth="0.3" />
          <path d={CONTINENTS.asia} fill="rgba(168,85,247,0.4)" stroke="rgba(168,85,247,0.6)" strokeWidth="0.3" />
          <path d={CONTINENTS.australia} fill="rgba(239,68,68,0.4)" stroke="rgba(239,68,68,0.6)" strokeWidth="0.3" />
          <path d={CONTINENTS.greenland} fill="rgba(148,163,184,0.4)" stroke="rgba(148,163,184,0.6)" strokeWidth="0.3" />
        </g>
        
        {/* Линии связи между узлами */}
        {networkNodes.slice(0, 8).map((node, i) => {
          const nextNode = networkNodes[(i + 1) % networkNodes.length];
          if (!nextNode) return null;
          return (
            <line
              key={`link-${i}`}
              x1={node.x / 10}
              y1={node.y / 10}
              x2={nextNode.x / 10}
              y2={nextNode.y / 10}
              stroke="rgba(34,211,238,0.12)"
              strokeWidth="0.2"
              strokeDasharray="1.5,1"
            />
          );
        })}

        {/* Узлы сети */}
        {networkNodes.map((node) => {
          const active = node.id === selectedId;
          const nodeColor = node.status === "online" ? "#10b981" : node.status === "busy" ? "#f59e0b" : "#ef4444";
          const nodeGlow = active ? "#22d3ee" : nodeColor;
          
          return (
            <g
              key={node.id}
              className="cursor-pointer transition-opacity hover:opacity-100"
              style={{ opacity: active ? 1 : 0.7 }}
              onClick={() => onSelect(node.id)}
              filter={active ? "url(#nodeGlow)" : undefined}
            >
              {/* Пульсация для активных узлов */}
              {active && (
                <circle cx={node.x / 10} cy={node.y / 10} r="6" fill="none" stroke="rgba(34,211,238,0.25)" strokeWidth="0.3">
                  <animate attributeName="r" from="3" to="6" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.8" to="0" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
              
              {/* Основной маркер */}
              <circle
                cx={node.x / 10}
                cy={node.y / 10}
                r={active ? 3 : 2}
                fill={active ? "#22d3ee" : nodeColor}
                stroke={nodeGlow}
                strokeWidth="0.5"
              />
              
              {/* Индикатор статуса */}
              <circle
                cx={node.x / 10 + 3}
                cy={node.y / 10 - 3}
                r="1"
                fill={nodeColor}
                opacity="0.9"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
