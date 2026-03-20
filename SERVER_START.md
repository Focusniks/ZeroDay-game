# 🚀 Инструкция по запуску на сервере Timeweb (85.239.35.171)

## ✅ Что исправлено:

1. **CORS настроен** для:
   - `http://localhost:5173`
   - `http://85.239.35.171:5173`
   - `http://85.239.35.171`

2. **WebSocket** и **HTTP API** готовы к работе

---

## 📋 Шаг 1: Подключение к серверу

```bash
ssh root@85.239.35.171
```

---

## 📋 Шаг 2: Проверка .env файла

```bash
cd /var/www/zeroday/backend
cat .env
```

**Должно быть:**
```env
DATABASE_URL=postgresql://postgres@localhost:5432/zeroday
JWT_SECRET=ваш_secret_key
WS_HOST=0.0.0.0
WS_PORT=8080
HTTP_HOST=0.0.0.0
HTTP_PORT=8000
WEB_ORIGIN=http://85.239.35.171:5173
```

**Если нет - исправьте:**
```bash
nano .env
```

---

## 📋 Шаг 3: Открытие портов

```bash
# Проверка статуса
ufw status

# Открытие портов
ufw allow 8080/tcp    # WebSocket
ufw allow 8000/tcp    # HTTP API
ufw allow 5173/tcp    # Frontend
ufw reload

# Проверка
ufw status
```

---

## 📋 Шаг 4: Запуск backend

### Вариант A: Вручную (для тестирования)

```bash
cd /var/www/zeroday/backend

# Сборка
cargo build --release

# Запуск
./target/release/zeroday-backend
```

**Должно появиться:**
```
WebSocket server listening on ws://0.0.0.0:8080
HTTP server listening on http://0.0.0.0:8000
```

### Вариант B: Через systemd сервис (для production)

```bash
nano /etc/systemd/system/zeroday.service
```

**Содержимое:**
```ini
[Unit]
Description=Zeroday Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/zeroday/backend
ExecStart=/var/www/zeroday/backend/target/release/zeroday-backend
Restart=always
RestartSec=10
Environment=PATH=/root/.cargo/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
```

**Запуск:**
```bash
systemctl daemon-reload
systemctl enable zeroday
systemctl start zeroday
systemctl status zeroday
```

---

## 📋 Шаг 5: Запуск frontend

### Для разработки (с авто-обновлением):

```bash
cd /var/www/zeroday/client
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

### Для production:

```bash
cd /var/www/zeroday/client
npm install
npm run build

# Frontend будет в папке dist/
# Можно настроить nginx для раздачи статики
```

---

## 📋 Шаг 6: Проверка работы

### С вашего ПК (PowerShell):

```powershell
# Проверка WebSocket порта
Test-NetConnection 85.239.35.171 -Port 8080

# Проверка HTTP порта
Test-NetConnection 85.239.35.171 -Port 8000

# Проверка frontend
Test-NetConnection 85.239.35.171 -Port 5173
```

**Если `TcpTestSucceeded: True`** - порт открыт ✅

**Если `TcpTestSucceeded: False`** - порт закрыт ❌

---

## 📋 Шаг 7: Доступ к приложению

### Frontend:
Откройте в браузере: **http://85.239.35.171:5173**

### В игре ZeroDay:
- Откройте браузер
- Перейдите на `zeroday://messenger`
- Настройте профиль
- Добавьте контакты

---

## 🔍 Диагностика проблем

### "WebSocket connection failed"

1. Проверьте, запущен ли backend:
   ```bash
   ps aux | grep zeroday-backend
   # или
   systemctl status zeroday
   ```

2. Проверьте порты:
   ```bash
   netstat -tlnp | grep :8080
   netstat -tlnp | grep :8000
   ```

3. Проверьте firewall:
   ```bash
   ufw status
   ```

### "CORS error"

Убедитесь, что в `.env` правильно указан `WEB_ORIGIN`:
```env
WEB_ORIGIN=http://85.239.35.171:5173
```

И перезапустите backend:
```bash
systemctl restart zeroday
```

### "Database connection failed"

```bash
# Проверьте PostgreSQL
systemctl status postgresql

# Создайте базу данных
sudo -u postgres psql
CREATE DATABASE zeroday;
\q
```

---

## 📝 Полезные команды

```bash
# Перезапуск backend
systemctl restart zeroday

# Просмотр логов
journalctl -u zeroday -f

# Остановка backend
systemctl stop zeroday

# Автозапуск при загрузке
systemctl enable zeroday
```

---

## 🎉 Готово!

Теперь Zeroday доступен по адресу:
- **Frontend:** http://85.239.35.171:5173
- **WebSocket:** ws://85.239.35.171:8080
- **HTTP API:** http://85.239.35.171:8000

**Для подключения из игры:**
1. Откройте браузер в игре
2. Перейдите на `zeroday://messenger`
3. Настройте профиль
4. Добавьте контакты через кнопку "+"
