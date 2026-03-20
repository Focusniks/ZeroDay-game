import { useMemo } from "react";
import type { NetworkNode, NetworkState } from "../../hooks/useNetworkSimulation";

type Props = {
  state: NetworkState;
  onConnect: (node: NetworkNode) => void;
  onDisconnect: () => void;
  onScan: () => Promise<void>;
  onHack: (nodeId: string) => Promise<boolean>;
  onToggleFirewall: () => void;
  onAddProxy: (proxy: string) => void;
  onRemoveProxy: (index: number) => void;
  lang: "ru" | "en";
};

const PROXY_LOCATIONS = ["Netherlands", "Germany", "Singapore", "USA", "Japan"];

export function NetworkPopover({
  state,
  onConnect,
  onDisconnect,
  onScan,
  onHack,
  onToggleFirewall,
  onAddProxy,
  onRemoveProxy,
  lang
}: Props) {
  const statusText = useMemo(() => {
    const texts = {
      offline: { ru: "Нет подключения", en: "No connection" },
      connecting: { ru: "Подключение...", en: "Connecting..." },
      connected: { ru: "Подключено", en: "Connected" },
      compromised: { ru: "ВЗЛОМАНО", en: "COMPROMISED" },
      hidden: { ru: "Скрытый режим", en: "Hidden mode" }
    };
    return texts[state.status][lang];
  }, [state.status, lang]);

  const statusColor = {
    offline: "text-slate-400",
    connecting: "text-amber-400",
    connected: "text-emerald-400",
    compromised: "text-red-500 animate-pulse",
    hidden: "text-cyan-400"
  }[state.status];

  const traceColor = state.traceLevel > 75 ? "bg-red-500" : state.traceLevel > 50 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="w-[420px] bg-slate-900/95 border border-cyan-500/20 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-cyan-500/10 bg-gradient-to-r from-cyan-500/10 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
              {lang === "ru" ? "Сетевое подключение" : "Network Connection"}
            </h3>
            <p className={`text-xs font-mono mt-1 ${statusColor}`}>{statusText}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">{lang === "ru" ? "Пропускная способность" : "Bandwidth"}</div>
            <div className="text-lg font-mono font-bold text-white">{state.bandwidth} <span className="text-xs text-slate-500">Mbps</span></div>
          </div>
        </div>
      </div>

      {/* Trace Meter */}
      <div className="p-4 border-b border-cyan-500/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {lang === "ru" ? "Уровень отслеживания" : "Trace Level"}
          </span>
          <span className={`text-sm font-mono font-bold ${state.traceLevel > 75 ? "text-red-400 animate-pulse" : "text-slate-300"}`}>
            {state.traceLevel}%
          </span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div
            className={`h-full ${traceColor} transition-all duration-500`}
            style={{ width: `${state.traceLevel}%` }}
          />
        </div>
        {state.traceLevel > 50 && (
          <p className="text-xs text-amber-400 mt-2">
            {lang === "ru" ? "⚠ ВНИМАНИЕ: Высокий уровень отслеживания! Используйте прокси." : "⚠ WARNING: High trace level! Use proxies."}
          </p>
        )}
      </div>

      {/* Current Node */}
      {state.currentNode && (
        <div className="p-4 border-b border-cyan-500/10">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className={`w-3 h-3 rounded-full ${
              state.currentNode.status === "alert" ? "bg-red-500 animate-pulse" : 
              state.currentNode.hacked ? "bg-emerald-500" : "bg-cyan-500"
            }`} />
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{state.currentNode.name}</div>
              <div className="text-xs text-slate-400">
                {state.currentNode.location} • {state.currentNode.owner}
              </div>
            </div>
            <button
              onClick={onDisconnect}
              className="px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition"
            >
              {lang === "ru" ? "Отключить" : "Disconnect"}
            </button>
          </div>
        </div>
      )}

      {/* Firewall & Proxy */}
      <div className="p-4 border-b border-cyan-500/10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {lang === "ru" ? "Файрвол" : "Firewall"}
          </span>
          <button
            onClick={onToggleFirewall}
            className={`px-3 py-1.5 text-xs font-medium rounded transition ${
              state.firewall 
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                : "bg-slate-700 text-slate-400 border border-slate-600"
            }`}
          >
            {state.firewall ? (lang === "ru" ? "ВКЛ" : "ON") : (lang === "ru" ? "ВЫКЛ" : "OFF")}
          </button>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {lang === "ru" ? "Прокси-цепочка" : "Proxy Chain"}
          </span>
          <select
            onChange={(e) => { if (e.target.value) onAddProxy(e.target.value); e.target.value = ""; }}
            className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 outline-none focus:border-cyan-500/50"
          >
            <option value="">{lang === "ru" ? "+ Добавить" : "+ Add"}</option>
            {PROXY_LOCATIONS.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          {state.proxyChain.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              {lang === "ru" ? "Прокси не настроены" : "No proxies configured"}
            </p>
          ) : (
            state.proxyChain.map((proxy, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-slate-800/50 rounded px-2 py-1.5 border border-slate-700">
                <span className="text-cyan-400 font-mono">{i + 1}. {proxy}</span>
                <button onClick={() => onRemoveProxy(i)} className="text-slate-500 hover:text-red-400">×</button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Scan Results */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {lang === "ru" ? "Доступные узлы" : "Available Nodes"}
          </span>
          <button
            onClick={onScan}
            disabled={state.status === "connecting"}
            className="px-3 py-1.5 text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/30 transition disabled:opacity-50"
          >
            {lang === "ru" ? "Сканировать" : "Scan"}
          </button>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {state.scanResults.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-4">
              {lang === "ru" ? "Нажмите 'Сканировать' для поиска узлов" : "Click 'Scan' to search for nodes"}
            </p>
          ) : (
            state.scanResults.map(node => (
              <div
                key={node.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                  node.hacked 
                    ? "bg-emerald-500/10 border-emerald-500/30" 
                    : node.status === "alert"
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-slate-800/50 border-slate-700"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${
                  node.status === "alert" ? "bg-red-500 animate-pulse" : 
                  node.hacked ? "bg-emerald-500" : "bg-cyan-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{node.name}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>{node.location}</span>
                    <span>•</span>
                    <span className={node.owner === "Gov" ? "text-red-400" : node.owner === "DarkNet" ? "text-purple-400" : "text-slate-400"}>
                      {node.owner}
                    </span>
                    <span>•</span>
                    <span className="text-amber-400">🔒 {node.security}/10</span>
                  </div>
                </div>
                {!node.hacked && state.status !== "offline" && (
                  <button
                    onClick={() => onHack(node.id)}
                    className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/30 transition"
                  >
                    {lang === "ru" ? "Взломать" : "Hack"}
                  </button>
                )}
                {node.hacked && (
                  <span className="text-xs font-semibold text-emerald-400 px-2 py-1">
                    {lang === "ru" ? "ВЗЛОМАН" : "HACKED"}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
