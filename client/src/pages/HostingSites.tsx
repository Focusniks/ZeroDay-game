import { useState } from "react";
import { Server, Cloud, Shield, Zap, Headphones, Check, X } from "lucide-react";

type HostingPlan = {
  name: string;
  price: number;
  storage: string;
  bandwidth: string;
  features: string[];
  popular?: boolean;
};

interface HostingSiteProps {
  name: string;
  color: string;
  plans: HostingPlan[];
  description: string;
}

export function HostingSite({ name, color, plans, description }: HostingSiteProps) {
  const [selectedPlan, setSelectedPlan] = useState<HostingPlan | null>(null);
  const [isPurchased, setIsPurchased] = useState(false);

  const handlePurchase = () => {
    setIsPurchased(true);
    setTimeout(() => setIsPurchased(false), 3000);
  };

  const colorClasses: Record<string, string> = {
    blue: "from-blue-600 to-cyan-600",
    purple: "from-purple-600 to-pink-600",
    green: "from-green-600 to-emerald-600",
    orange: "from-orange-600 to-red-600",
  };

  const buttonColors: Record<string, string> = {
    blue: "bg-blue-600 hover:bg-blue-500",
    purple: "bg-purple-600 hover:bg-purple-500",
    green: "bg-green-600 hover:bg-green-500",
    orange: "bg-orange-600 hover:bg-orange-500",
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <div className={`bg-gradient-to-r ${colorClasses[color]} py-16`}>
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Cloud className="w-12 h-12 text-white" />
            <h1 className="text-4xl font-bold text-white">{name}</h1>
          </div>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">{description}</p>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-900/50 rounded-xl p-6 text-center">
            <Server className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-1">NVMe SSD</h3>
            <p className="text-slate-400 text-sm">Быстрые диски</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-6 text-center">
            <Shield className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-1">DDoS защита</h3>
            <p className="text-slate-400 text-sm">24/7 мониторинг</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-6 text-center">
            <Headphones className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-1">Поддержка</h3>
            <p className="text-slate-400 text-sm">Всегда на связи</p>
          </div>
        </div>

        {/* Plans */}
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
                  <Check className="w-4 h-4 text-green-500" />
                  {plan.storage} хранилище
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-green-500" />
                  {plan.bandwidth} трафик
                </li>
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  setSelectedPlan(plan);
                  handlePurchase();
                }}
                disabled={isPurchased}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  isPurchased
                    ? "bg-green-600 text-white"
                    : buttonColors[color] + " text-white"
                }`}
              >
                {isPurchased ? "Куплено!" : "Выбрать план"}
              </button>
            </div>
          ))}
        </div>

        {selectedPlan && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Оформление заказа</h3>
                <button onClick={() => setSelectedPlan(null)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-white font-semibold">{selectedPlan.name}</p>
                  <p className="text-slate-400 text-sm">${selectedPlan.price}/мес</p>
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
                  handlePurchase();
                  setTimeout(() => setSelectedPlan(null), 1000);
                }}
                className={`w-full py-4 rounded-xl font-semibold text-white bg-gradient-to-r ${colorClasses[color]}`}
              >
                Оплатить ${selectedPlan.price}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Предустановленные конфиги для хостингов
export const hostingSites = {
  cloudpro: {
    name: "CloudPro Hosting",
    color: "blue" as const,
    description: "Профессиональный хостинг для вашего бизнеса с гарантией 99.9% uptime",
    plans: [
      { name: "Start", price: 299, storage: "10 GB", bandwidth: "100 GB", features: ["1 сайт", "SSL сертификат", "Email хостинг"] },
      { name: "Business", price: 599, storage: "50 GB", bandwidth: "500 GB", features: ["10 сайтов", "SSL сертификат", "Приоритетная поддержка", "Daily бэкапы"], popular: true },
      { name: "Enterprise", price: 1299, storage: "200 GB", bandwidth: "Unlimited", features: ["Безлимит сайтов", "Выделенный IP", "Персональный менеджер", "SLA 99.9%"] },
    ] as HostingPlan[],
  },
  fasthost: {
    name: "FastHost",
    color: "purple" as const,
    description: "Скоростной хостинг с NVMe дисками для максимальной производительности",
    plans: [
      { name: "Lite", price: 199, storage: "5 GB", bandwidth: "50 GB", features: ["1 сайт", "Бесплатный SSL", "Панель управления"] },
      { name: "Pro", price: 499, storage: "25 GB", bandwidth: "250 GB", features: ["5 сайтов", "CDN включен", "Оптимизация WordPress"], popular: true },
      { name: "Max", price: 999, storage: "100 GB", bandwidth: "1 TB", features: ["Безлимит сайтов", "VPS мощность", "Git интеграция", "Staging среда"] },
    ] as HostingPlan[],
  },
  securehost: {
    name: "SecureHost",
    color: "green" as const,
    description: "Максимальная безопасность ваших данных с продвинутой защитой от атак",
    plans: [
      { name: "Basic", price: 349, storage: "15 GB", bandwidth: "150 GB", features: ["2 сайта", "WAF защита", "SSL сертификат", "Anti-DDoS"] },
      { name: "Secure", price: 749, storage: "75 GB", bandwidth: "750 GB", features: ["15 сайтов", "Malware сканер", "Бэкапы каждый час"], popular: true },
      { name: "Fortress", price: 1499, storage: "300 GB", bandwidth: "Unlimited", features: ["Безлимит сайтов", "Penetration тесты", "Security аудит", "24/7 мониторинг"] },
    ] as HostingPlan[],
  },
  budgethost: {
    name: "BudgetHost",
    color: "orange" as const,
    description: "Доступный хостинг без компромиссов в качестве",
    plans: [
      { name: "Economy", price: 99, storage: "2 GB", bandwidth: "20 GB", features: ["1 сайт", "Панель управления", "1 база данных"] },
      { name: "Value", price: 249, storage: "10 GB", bandwidth: "100 GB", features: ["3 сайта", "Бесплатный домен", "Неограниченно баз данных"], popular: true },
      { name: "Deluxe", price: 449, storage: "40 GB", bandwidth: "400 GB", features: ["10 сайтов", "Маркетинг $100", "Бэкапы", "SSL"] },
    ] as HostingPlan[],
  },
};
