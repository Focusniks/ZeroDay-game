# Zerogram - Новые сайты и функции

## 🆕 Новые сайты

### 1. Криптокошелек (CryptoVault)
**URL:** `zeroday://crypto`

**Функционал:**
- Регистрация с бонусом 100 ZEROCOIN
- Просмотр баланса (BTC, ETH, USDT, ZEROCOIN)
- Отправка криптовалюты
- Получение криптовалюты (QR + адрес)
- История транзакций
- Конвертация валют (симуляция)

### 2. Хостинг-провайдеры (4 сайта)

#### CloudPro Hosting
**URL:** `zeroday://hosting/cloudpro`
- Тарифы: $299 - $1299/мес
- Профессиональный хостинг для бизнеса

#### FastHost
**URL:** `zeroday://hosting/fasthost`
- Тарифы: $199 - $999/мес
- Скоростной хостинг с NVMe дисками

#### SecureHost
**URL:** `zeroday://hosting/securehost`
- Тарифы: $349 - $1499/мес
- Максимальная безопасность

#### BudgetHost
**URL:** `zeroday://hosting/budgethost`
- Тарифы: $99 - $449/мес
- Доступный хостинг

### 3. Интернет-провайдеры (4 сайта)

#### FreeNet (БЕСПЛАТНЫЙ)
**URL:** `zeroday://isp/freenet`
- **Бесплатно** после регистрации
- Скорость: 10 Mbps
- Безлимитный трафик
- ✅ **Рекомендуется для начала игры**

#### SpeedMax
**URL:** `zeroday://isp/speedmax`
- Тарифы: $799 - $2499/мес
- Скорость: 100 Mbps - 1 Gbps
- Для геймеров и стримеров

#### HomeNet
**URL:** `zeroday://isp/homenet`
- Тарифы: $399 - $899/мес
- Скорость: 50 - 300 Mbps
- Семейный интернет + ТВ

#### FiberOptic
**URL:** `zeroday://isp/fiberoptic`
- Тарифы: $699 - $1599/мес
- Скорость: 200 Mbps - 1 Gbps
- Оптоволоконный интернет

## 🔍 Улучшенный поиск

Теперь при вводе поискового запроса:
1. Открывается страница `zeroday://search?q=запрос`
2. Показывается кнопка "Открыть в Google"
3. При клике открывается реальная поисковая выдача Google

**Как использовать:**
- Введите запрос в поисковую строку на домашней странице
- Нажмите Enter или кнопку поиска
- Кликните "Открыть в Google" для просмотра результатов

## 🌐 Доступ к сайтам

### На домашней странице браузера:
- 💬 **Zerogram** - мессенджер
- ₿ **Crypto** - криптокошелек
- ☁️ **Hosting** - хостинг-провайдеры
- 📡 **Internet** - интернет-провайдеры

### Через URL строку:
Введите любой из URL:
- `zeroday://messenger`
- `zeroday://crypto`
- `zeroday://hosting/cloudpro` (и другие)
- `zeroday://isp/freenet` (и другие)

---

## 🖥️ Настройка для облачного сервера

### WS_HOST конфигурация

**Для локальной разработки:**
```env
WS_HOST=127.0.0.1
WS_PORT=8080
HTTP_HOST=127.0.0.1
HTTP_PORT=8000
WEB_ORIGIN=http://localhost:5173
```

**Для облачного сервера (Timeweb):**
```env
WS_HOST=0.0.0.0
WS_PORT=8080
HTTP_HOST=0.0.0.0
HTTP_PORT=8000
WEB_ORIGIN=http://ваш-ip:5173
```

### Важно:

1. **WS_HOST=0.0.0.0** - позволяет принимать подключения со всех интерфейсов
2. **Откройте порты в firewall:**
   ```bash
   ufw allow 8080/tcp  # WebSocket
   ufw allow 8000/tcp  # HTTP API
   ufw allow 5173/tcp  # Frontend (dev)
   ufw allow 80/tcp    # HTTP (production)
   ufw allow 443/tcp   # HTTPS (production)
   ```

3. **Для подключения с клиента:**
   - В `useAuth.tsx` измените `DEFAULT_WS_URL` на IP сервера:
   ```typescript
   const DEFAULT_WS_URL = "ws://ваш-server-ip:8080";
   ```

4. **Используйте nginx как reverse proxy:**
   ```nginx
   location /ws {
       proxy_pass http://127.0.0.1:8080;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
   }
   ```

---

## 🚀 Быстрый старт

1. **Получите бесплатный интернет:**
   - Откройте `zeroday://isp/freenet`
   - Нажмите "Подключиться бесплатно"

2. **Создайте криптокошелек:**
   - Откройте `zeroday://crypto`
   - Зарегистрируйтесь (получите 100 ZEROCOIN)

3. **Напишите сообщение:**
   - Откройте `zeroday://messenger`
   - Настройте профиль
   - Добавьте друзей

4. **Выберите хостинг:**
   - Сравните тарифы на `zeroday://hosting/*`
   - Выберите подходящий план
