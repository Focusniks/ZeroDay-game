import { useMemo } from "react";

type Props = {
  isConnected: boolean;
  isConnecting: boolean;
  bandwidth: number;
  userIpAddress?: string | null;
  /** Сеть управляется WebSocket — ручное переключение отключено */
  onToggleConnection?: () => void;
  lang: "ru" | "en";
};

export function NetworkPopover({
  isConnected,
  isConnecting,
  bandwidth,
  userIpAddress,
  onToggleConnection,
  lang
}: Props) {
  const statusText = useMemo(() => {
    if (isConnecting) {
      return lang === "ru" ? "Подключение..." : "Connecting...";
    }
    if (isConnected) {
      return lang === "ru" ? "В сети" : "Online";
    }
    return lang === "ru" ? "Оффлайн" : "Offline";
  }, [isConnected, isConnecting, lang]);

  const statusColor = isConnecting
    ? "text-amber-400"
    : isConnected
    ? "text-emerald-400"
    : "text-slate-400";

  const networkDetails = useMemo(() => {
    if (!isConnected) return null;
    return {
      ip: userIpAddress || "192.168.0.1",
      provider: "ZeroDay Network"
    };
  }, [isConnected, userIpAddress]);

  return (
    <div className="w-[340px] bg-slate-900/95 border border-cyan-500/20 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden">
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
            <div className="text-lg font-mono font-bold text-white">{bandwidth} <span className="text-xs text-slate-500">Mbps</span></div>
          </div>
        </div>
      </div>

      {/* Info: network is driven by WebSocket */}
      <div className="p-4 border-b border-cyan-500/10">
        <p className="text-xs text-slate-400">
          {lang === "ru"
            ? "Подключение к ZeroDay Network через WebSocket. Статус обновляется автоматически."
            : "ZeroDay Network connection via WebSocket. Status updates automatically."}
        </p>
      </div>

      {/* Network Status Info */}
      <div className="p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className={`w-3 h-3 rounded-full ${
              isConnecting ? "bg-amber-500 animate-pulse" :
              isConnected ? "bg-emerald-500" : "bg-slate-500"
            }`} />
            <div className="flex-1">
              <div className="text-xs font-semibold text-slate-300">
                {lang === "ru" ? "Статус подключения" : "Connection Status"}
              </div>
              <div className={`text-xs font-mono mt-0.5 ${statusColor}`}>
                {isConnected 
                  ? (lang === "ru" ? "ZeroDay Network: подключено" : "ZeroDay Network: connected")
                  : (lang === "ru" ? "Локальный режим" : "Local mode")}
              </div>
            </div>
          </div>
          
          {isConnected && networkDetails && (
            <>
              <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-300">
                    {lang === "ru" ? "IP адрес" : "IP Address"}
                  </div>
                  <div className="text-xs font-mono text-slate-400">{networkDetails.ip}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-300">
                    {lang === "ru" ? "Провайдер" : "Provider"}
                  </div>
                  <div className="text-xs text-slate-400">{networkDetails.provider}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
