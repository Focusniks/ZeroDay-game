# 🚀 Zerogram - Подключение к серверу Timeweb

## ✅ IP сервера обновлен

Все клиенты теперь подключаются к серверу: **85.239.35.171**

## 📋 Что сделано:

1. **Исправлено предупреждение компиляции** в `messenger.rs`
2. **Обновлен IP сервера** во всех файлах клиента:
   - `useAuth.tsx` - WebSocket подключение
   - `useWebSocket.ts` - дефолтный URL
   - `SettingsApp.tsx` - настройки сети

## 🔧 Настройка сервера Timeweb

### 1. Проверьте .env файл на сервере:

```bash
cd /var/www/zerogram/backend
nano .env
```

**Содержимое .env:**
```env
DATABASE_URL=postgresql://postgres@localhost:5432/zerogram
JWT_SECRET=ваш_secret_key
WS_HOST=0.0.0.0
WS_PORT=8080
HTTP_HOST=0.0.0.0
HTTP_PORT=8000
WEB_ORIGIN=http://85.239.35.171:5173
```

### 2. Откройте порты в firewall:

```bash
ufw allow 8080/tcp  # WebSocket
ufw allow 8000/tcp  # HTTP API
ufw allow 5173/tcp  # Frontend dev
ufw allow 80/tcp    # HTTP production
ufw allow 443/tcp   # HTTPS production
ufw status
```

### 3. Запустите backend:

```bash
cd /var/www/zerogram/backend
cargo build --release
./target/release/zeroday-backend
```

Или через systemd:
```bash
systemctl restart zerogram
systemctl status zerogram
```

### 4. Запустите frontend (dev режим):

```bash
cd /var/www/zerogram/client
npm install
npm run dev -- --host 0.0.0.0
```

## 🌐 Доступ к приложению

### Из игры (когда frontend запущен):
- Откройте браузер
- Перейдите на `http://85.239.35.171:5173`
- Используйте zeroday:// URLs внутри браузера

### Прямой доступ к сайтам:
- **Zerogram:** `zeroday://messenger`
- **Crypto:** `zeroday://crypto`
- **Hosting:** `zeroday://hosting/cloudpro`
- **Internet:** `zeroday://isp/freenet`

## 🔍 Проверка подключения

### 1. Проверьте backend:
```bash
# Проверка логов
journalctl -u zerogram -f

# Проверка портов
netstat -tlnp | grep :8080
netstat -tlnp | grep :8000
```

### 2. Проверьте WebSocket:
```bash
# С вашего ПК (PowerShell):
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ws.ConnectAsync("ws://85.239.35.171:8080", [System.Threading.CancellationToken]::None)
```

### 3. Проверьте frontend:
Откройте в браузере: `http://85.239.35.171:5173`

## ⚠️ Возможные проблемы

### "WebSocket connection failed"
- Проверьте, что backend запущен
- Проверьте firewall (порт 8080)
- Убедитесь, что WS_HOST=0.0.0.0

### "Database connection failed"
```bash
# Проверьте PostgreSQL
systemctl status postgresql
sudo -u postgres psql -c "SELECT 1"
```

### "Port already in use"
```bash
# Найдите процесс на порту
netstat -tlnp | grep :8080
# Убейте процесс
kill -9 <PID>
```

## 📱 Тестирование

1. Откройте браузер в игре
2. Перейдите на `zeroday://messenger`
3. Зарегистрируйтесь (получите 100 ZEROCOIN)
4. Откройте `zeroday://crypto` - проверьте баланс
5. Откройте `zeroday://isp/freenet` - подключите бесплатный интернет
6. Откройте `zeroday://hosting/cloudpro` - посмотрите тарифы

## 🎉 Готово!

Мессенджер Zerogram и все сайты работают на сервере **85.239.35.171**
