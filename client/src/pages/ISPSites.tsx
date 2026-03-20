import { useState } from "react";
import { Wifi, Zap, Shield, Globe, Check, X, Router } from "lucide-react";

type ISPPlan = {
  name: string;
  price: number;
  speed: string;
  features: string[];
  popular?: boolean;
};

interface ISPSiteProps {
  name: string;
  color: string;
  plans: ISPPlan[];
  description: string;
  isFree?: boolean;
}

export function ISPSite({ name, color, plans, description, isFree }: ISPSiteProps) {
  const [selectedPlan, setSelectedPlan] = useState<ISPPlan | null>(null);
  const [isConnected, setIsConnected] = useState(isFree || false);

  const handleConnect = () => {
    if (isFree) {
      setIsConnected(true);
    } else {
      setSelectedPlan(plans[0]);
    }
  };

  const colorClasses: Record<string, string> = {
    blue: "from-blue-600 to-cyan-600",
    purple: "from-purple-600 to-pink-600",
    green: "from-green-600 to-emerald-600",
    red: "from-red-600 to-orange-600",
  };

  const buttonColors: Record<string, string> = {
    blue: "bg-blue-600 hover:bg-blue-500",
    purple: "bg-purple-600 hover:bg-purple-500",
    green: "bg-green-600 hover:bg-green-500",
    red: "bg-red-600 hover:bg-red-500",
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Status Bar */}
      <div className={`h-1 ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>

      {/* Hero */}
      <div className={`bg-gradient-to-r ${colorClasses[color]} py-12`}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Wifi className="w-10 h-10 text-white" />
                <h1 className="text-3xl font-bold text-white">{name}</h1>
              </div>
              <p className="text-white/80 max-w-xl">{description}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-white mb-2">
                {isConnected ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Подключено</span>
                  </>
                ) : (
                  <>
                    <X className="w-5 h-5" />
                    <span>Не подключено</span>
                  </>
                )}
              </div>
              {isConnected && (
                <p className="text-white/60 text-sm">IP: 10.0.0.{Math.floor(Math.random() * 255)}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-slate-900/50 rounded-xl p-4 text-center">
            <Zap className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-slate-400 text-xs mb-1">Скорость</p>
            <p className="text-white font-bold">{isConnected ? plans[0]?.speed : "—"}</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center">
            <Globe className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-slate-400 text-xs mb-1">Пинг</p>
            <p className="text-white font-bold">{isConnected ? `${Math.floor(Math.random() * 20 + 5)} ms` : "—"}</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center">
            <Shield className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-slate-400 text-xs mb-1">Статус</p>
            <p className="text-white font-bold">{isConnected ? "Активен" : "Не активен"}</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 text-center">
            <Router className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <p className="text-slate-400 text-xs mb-1">Роутер</p>
            <p className="text-white font-bold">{isConnected ? "Online" : "Offline"}</p>
          </div>
        </div>

        {isFree ? (
          /* Free Provider */
          <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800 p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Бесплатный доступ в интернет</h2>
            <p className="text-slate-400 mb-8 max-w-xl mx-auto">
              Базовый тариф с ограниченной скоростью. Идеально подходит для браузинга и социальных сетей.
            </p>

            {!isConnected ? (
              <button
                onClick={handleConnect}
                className={`px-8 py-4 rounded-xl font-semibold text-white bg-gradient-to-r ${colorClasses[color]} hover:opacity-90 transition-opacity`}
              >
                Подключиться бесплатно
              </button>
            ) : (
              <div className="bg-green-900/30 border border-green-800 rounded-xl p-6">
                <p className="text-green-400 font-semibold mb-2">✓ Вы подключены к интернету</p>
                <p className="text-slate-400 text-sm">
                  Скорость: {plans[0]?.speed} | Трафик: Безлимитный
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 mt-8 text-center">
              <div>
                <p className="text-2xl font-bold text-white">{plans[0]?.speed}</p>
                <p className="text-slate-500 text-xs">Скорость</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">∞</p>
                <p className="text-slate-500 text-xs">Трафик</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">$0</p>
                <p className="text-slate-500 text-xs">Цена</p>
              </div>
            </div>
          </div>
        ) : (
          /* Paid Providers */
          <>
            <h2 className="text-2xl font-bold text-white text-center mb-8">Тарифные планы</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan, index) => (
                <div
                  key={index}
                  className={`bg-slate-900/50 backdrop-blur-xl rounded-2xl border ${
                    plan.popular ? "border-" + color.split("-")[0] + "-500" : "border-slate-800"
                  } p-6 relative overflow-hidden`}
                >
                  {plan.popular && (
                    <div className={`absolute top-0 right-0 px-4 py-1 bg-gradient-to-r ${colorClasses[color]} text-white text-xs font-semibold rounded-bl-xl`}>
                      Популярный
                    </div>
                  )}
                  
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-white">${plan.price}</span>
                    <span className="text-slate-400">/мес</span>
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-2 text-slate-300">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      {plan.speed}
                    </li>
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-slate-300">
                        <Check className="w-4 h-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full py-3 rounded-xl font-semibold transition-all ${buttonColors[color]} text-white`}
                  >
                    Подключить
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Connection Modal */}
        {selectedPlan && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Подключение тарифа</h3>
                <button onClick={() => setSelectedPlan(null)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-white font-semibold">{selectedPlan.name}</p>
                  <p className="text-slate-400 text-sm">{selectedPlan.speed} | ${selectedPlan.price}/мес</p>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Адрес подключения</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    placeholder="ул. Примерная, д. 1, кв. 1"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  setIsConnected(true);
                  setSelectedPlan(null);
                }}
                className={`w-full py-4 rounded-xl font-semibold text-white bg-gradient-to-r ${colorClasses[color]}`}
              >
                Оплатить и подключить ${selectedPlan.price}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Предустановленные конфиги для провайдеров
export const ispSites = {
  freeNet: {
    name: "FreeNet",
    color: "green" as const,
    description: "Бесплатный интернет для всех! Базовая скорость для браузинга и общения.",
    isFree: true,
    plans: [{ name: "Free", price: 0, speed: "10 Mbps", features: ["Безлимитный трафик", "Без контракта", "Мгновенное подключение"] }] as ISPPlan[],
  },
  speedMax: {
    name: "SpeedMax",
    color: "red" as const,
    description: "Максимальная скорость для геймеров и стримеров",
    plans: [
      { name: "Gamer", price: 799, speed: "100 Mbps", features: ["Низкий пинг", "Игровой приоритет", "Статический IP"] },
      { name: "Streamer", price: 1299, speed: "500 Mbps", features: ["Upload 100 Mbps", "Приоритет трафика", "2 статических IP"], popular: true },
      { name: "Pro", price: 2499, speed: "1 Gbps", features: ["Симметричный канал", "Выделенная линия", "SLA 99.9%", "Персональный IP"] },
    ] as ISPPlan[],
  },
  homeNet: {
    name: "HomeNet",
    color: "blue" as const,
    description: "Надежный интернет для дома и семьи",
    plans: [
      { name: "Start", price: 399, speed: "50 Mbps", features: ["Безлимит", "Wi-Fi роутер", "ТВ 50 каналов"] },
      { name: "Family", price: 599, speed: "100 Mbps", features: ["Безлимит", "Wi-Fi 6 роутер", "ТВ 150 каналов", "Антивирус"], popular: true },
      { name: "Premium", price: 899, speed: "300 Mbps", features: ["Безлимит", "Mesh система", "ТВ 300 каналов", "Умный дом"] },
    ] as ISPPlan[],
  },
  fiberOptic: {
    name: "FiberOptic",
    color: "purple" as const,
    description: "Оптоволоконный интернет нового поколения",
    plans: [
      { name: "Fiber 200", price: 699, speed: "200 Mbps", features: ["Оптоволокно", "Симметричный", "Игровой режим"] },
      { name: "Fiber 500", price: 999, speed: "500 Mbps", features: ["Оптоволокно до квартиры", "Wi-Fi 6E", "Облачное хранилище 1TB"], popular: true },
      { name: "Fiber 1000", price: 1599, speed: "1 Gbps", features: ["Гигабит до устройства", "Умная квартира", "Видеонаблюдение", "Сервер"] },
    ] as ISPPlan[],
  },
};
