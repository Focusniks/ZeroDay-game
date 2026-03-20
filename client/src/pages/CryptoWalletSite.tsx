import { useState } from "react";
import { Wallet, Send, Download, Upload, Shield, TrendingUp, Clock, CheckCircle, X, Copy, RefreshCw } from "lucide-react";

type Transaction = {
  id: string;
  type: "receive" | "send";
  amount: number;
  currency: string;
  from?: string;
  to?: string;
  date: string;
  status: "pending" | "completed";
};

type CryptoWallet = {
  btc: number;
  eth: number;
  usdt: number;
  zerocoin: number;
};

export function CryptoWalletSite() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [wallet, setWallet] = useState<CryptoWallet>({ btc: 0, eth: 0, usdt: 0, zerocoin: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<"wallet" | "send" | "receive" | "history">("wallet");
  const [sendAmount, setSendAmount] = useState("");
  const [sendAddress, setSendAddress] = useState("");
  const [sendCurrency, setSendCurrency] = useState<"btc" | "eth" | "usdt" | "zerocoin">("btc");
  const [notification, setNotification] = useState<string | null>(null);

  const myWalletAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    // Бонус за регистрацию
    setWallet({ btc: 0, eth: 0, usdt: 0, zerocoin: 100 });
    setTransactions([{
      id: "1",
      type: "receive",
      amount: 100,
      currency: "ZEROCOIN",
      from: "ZeroDay Bonus",
      date: new Date().toISOString(),
      status: "completed"
    }]);
    setIsRegistered(true);
    setShowRegisterForm(false);
    showNotification("Кошелек создан! Вам начислено 100 ZEROCOIN");
  };

  const handleSend = () => {
    if (!sendAmount || !sendAddress) return;
    const amount = parseFloat(sendAmount);
    if (wallet[sendCurrency] < amount) {
      showNotification("Недостаточно средств");
      return;
    }
    
    setWallet(prev => ({ ...prev, [sendCurrency]: prev[sendCurrency] - amount }));
    setTransactions(prev => [{
      id: Date.now().toString(),
      type: "send",
      amount,
      currency: sendCurrency.toUpperCase(),
      to: sendAddress,
      date: new Date().toISOString(),
      status: "completed"
    }, ...prev]);
    
    setSendAmount("");
    setSendAddress("");
    showNotification("Транзакция отправлена!");
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(myWalletAddress);
    showNotification("Адрес скопирован");
  };

  // Главная страница
  if (!isRegistered) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/30">
              <Wallet className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">CryptoVault</h1>
            <p className="text-slate-400">Безопасный криптокошелек нового поколения</p>
          </div>

          {!showRegisterForm ? (
            <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 p-8 shadow-2xl">
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 text-slate-300">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <span>Военное шифрование</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span>Мгновенные переводы</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-blue-400" />
                  <span>Бонус 100 ZEROCOIN при регистрации</span>
                </div>
              </div>

              <button
                onClick={() => setShowRegisterForm(true)}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-purple-500/30"
              >
                Создать кошелек
              </button>

              <p className="text-center text-xs text-slate-500 mt-4">
                Уже есть кошелек? <button className="text-purple-400 hover:underline">Войти</button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 p-8 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-6">Регистрация</h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Пароль</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button type="submit" className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-purple-500/30">
                Создать кошелек
              </button>

              <button
                type="button"
                onClick={() => setShowRegisterForm(false)}
                className="w-full py-3 mt-3 text-slate-400 hover:text-white transition-colors"
              >
                Назад
              </button>
            </form>
          )}
        </div>

        {notification && (
          <div className="fixed bottom-4 right-4 px-6 py-3 bg-slate-800 border border-purple-500/50 rounded-xl text-white shadow-xl animate-pulse">
            {notification}
          </div>
        )}
      </div>
    );
  }

  // Интерфейс кошелька
  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">CryptoVault</h1>
              <p className="text-xs text-slate-400">{email}</p>
            </div>
          </div>
          <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <RefreshCw className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Баланс */}
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-xl rounded-3xl border border-purple-500/30 p-6">
          <p className="text-slate-400 text-sm mb-2">Общий баланс</p>
          <h2 className="text-4xl font-bold text-white mb-4">
            ${((wallet.btc * 43000) + (wallet.eth * 2300) + wallet.usdt + (wallet.zerocoin * 0.1)).toFixed(2)}
          </h2>
          
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-400">BTC</p>
              <p className="text-white font-semibold">{wallet.btc.toFixed(6)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-400">ETH</p>
              <p className="text-white font-semibold">{wallet.eth.toFixed(4)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-400">USDT</p>
              <p className="text-white font-semibold">{wallet.usdt.toFixed(2)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-400">ZEROCOIN</p>
              <p className="text-white font-semibold">{wallet.zerocoin.toFixed(0)}</p>
            </div>
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex gap-2">
          {(["wallet", "send", "receive", "history"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                activeTab === tab
                  ? "bg-purple-600 text-white"
                  : "bg-slate-900/50 text-slate-400 hover:text-white"
              }`}
            >
              {tab === "wallet" && "Кошелек"}
              {tab === "send" && "Отправить"}
              {tab === "receive" && "Получить"}
              {tab === "history" && "История"}
            </button>
          ))}
        </div>

        {/* Контент вкладок */}
        {activeTab === "wallet" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Ваши активы</h3>
            {wallet.btc === 0 && wallet.eth === 0 && wallet.usdt === 0 && wallet.zerocoin === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Wallet className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Нет активов</p>
              </div>
            ) : (
              <div className="space-y-3">
                {wallet.btc > 0 && (
                  <div className="bg-slate-900/50 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <span className="text-orange-500 font-bold">₿</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold">Bitcoin</p>
                        <p className="text-xs text-slate-400">{wallet.btc.toFixed(6)} BTC</p>
                      </div>
                    </div>
                    <p className="text-white">${(wallet.btc * 43000).toFixed(2)}</p>
                  </div>
                )}
                {wallet.eth > 0 && (
                  <div className="bg-slate-900/50 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <span className="text-blue-500 font-bold">♦</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold">Ethereum</p>
                        <p className="text-xs text-slate-400">{wallet.eth.toFixed(4)} ETH</p>
                      </div>
                    </div>
                    <p className="text-white">${(wallet.eth * 2300).toFixed(2)}</p>
                  </div>
                )}
                {wallet.usdt > 0 && (
                  <div className="bg-slate-900/50 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <span className="text-green-500 font-bold">$</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold">Tether</p>
                        <p className="text-xs text-slate-400">{wallet.usdt.toFixed(2)} USDT</p>
                      </div>
                    </div>
                    <p className="text-white">${wallet.usdt.toFixed(2)}</p>
                  </div>
                )}
                {wallet.zerocoin > 0 && (
                  <div className="bg-slate-900/50 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <span className="text-purple-500 font-bold">ZC</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold">ZeroCoin</p>
                        <p className="text-xs text-slate-400">{wallet.zerocoin.toFixed(0)} ZC</p>
                      </div>
                    </div>
                    <p className="text-white">${(wallet.zerocoin * 0.1).toFixed(2)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "send" && (
          <div className="bg-slate-900/50 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Отправить криптовалюту</h3>
            
            <div>
              <label className="block text-sm text-slate-400 mb-2">Валюта</label>
              <select
                value={sendCurrency}
                onChange={(e) => setSendCurrency(e.target.value as any)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
              >
                <option value="btc">Bitcoin (BTC)</option>
                <option value="eth">Ethereum (ETH)</option>
                <option value="usdt">Tether (USDT)</option>
                <option value="zerocoin">ZeroCoin (ZC)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Адрес получателя</label>
              <input
                type="text"
                value={sendAddress}
                onChange={(e) => setSendAddress(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
                placeholder="0x..."
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Сумма</label>
              <div className="relative">
                <input
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  placeholder="0.00"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  {sendCurrency.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Доступно: {wallet[sendCurrency].toFixed(6)} {sendCurrency.toUpperCase()}
              </p>
            </div>

            <button
              onClick={handleSend}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-purple-500/30"
            >
              Отправить
            </button>
          </div>
        )}

        {activeTab === "receive" && (
          <div className="bg-slate-900/50 rounded-xl p-6 text-center space-y-4">
            <h3 className="text-lg font-semibold text-white">Получить криптовалюту</h3>
            
            <div className="bg-white p-4 rounded-xl inline-block">
              <div className="w-48 h-48 bg-slate-900 flex items-center justify-center">
                <p className="text-slate-400 text-xs text-center">QR Code<br/>(симуляция)</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-400 mb-2">Ваш адрес кошелька</p>
              <div className="flex items-center gap-2 bg-slate-800 rounded-xl p-3">
                <code className="text-xs text-purple-400 flex-1 truncate">{myWalletAddress}</code>
                <button onClick={copyAddress} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                  <Copy className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Отправляйте только BTC, ETH, USDT (TRC20/ERC20) и ZEROCOIN на этот адрес
            </p>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">История транзакций</h3>
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Нет транзакций</p>
              </div>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="bg-slate-900/50 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.type === "receive" ? "bg-green-500/20" : "bg-red-500/20"
                    }`}>
                      {tx.type === "receive" ? (
                        <Download className="w-5 h-5 text-green-500" />
                      ) : (
                        <Upload className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-white font-semibold">
                        {tx.type === "receive" ? "Получено" : "Отправлено"} {tx.currency}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(tx.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${tx.type === "receive" ? "text-green-500" : "text-red-500"}`}>
                      {tx.type === "receive" ? "+" : "-"}{tx.amount} {tx.currency}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">{tx.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {notification && (
        <div className="fixed bottom-4 right-4 px-6 py-3 bg-slate-800 border border-purple-500/50 rounded-xl text-white shadow-xl z-50">
          {notification}
        </div>
      )}
    </div>
  );
}
