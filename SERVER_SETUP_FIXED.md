# 🚀 Zeroday - Развертывание на сервере Timeweb

## 📁 Структура проекта

```
/var/www/zeroday/
├── backend/           # Rust backend
│   ├── .env          # Конфигурация
│   ├── Cargo.toml
│   └── src/
├── client/           # React frontend
│   ├── package.json
│   └── src/
└── ...
```

## 🔧 Настройка сервера

### 1. Подключение к серверу

```bash
ssh root@85.239.35.171
```

### 2. Проверка .env файла

```bash
cd /var/www/zeroday/backend
cat .env
```

**Правильное содержимое:**
```env
DATABASE_URL=postgresql://postgres@localhost:5432/zeroday
JWT_SECRET=ваш_secret_key_генерируете_случайную_строку
WS_HOST=0.0.0.0
WS_PORT=8080
HTTP_HOST=0.0.0.0
HTTP_PORT=8000
WEB_ORIGIN=http://85.239.35.171:5173
```

**Важно:**
- `WS_HOST=0.0.0.0` - слушать все интерфейсы (не 127.0.0.1!)
- `HTTP_HOST=0.0.0.0` - слушать все интерфейсы
- Порт 8080 для WebSocket
- Порт 8000 для HTTP API

### 3. Открытие портов в firewall

```bash
# Проверка статуса
ufw status

# Открытие портов
ufw allow 8080/tcp    # WebSocket
ufw allow 8000/tcp    # HTTP API
ufw allow 5173/tcp    # Frontend (dev)
ufw allow 80/tcp      # HTTP (production)
ufw allow 443/tcp     # HTTPS (production)

# Перезагрузка firewall
ufw reload
ufw status
```

### 4. Запуск backend

**Вариант A: Вручную**
```bash
cd /var/www/zeroday/backend
cargo build --release
./target/release/zeroday-backend
```

Должно появиться:
```
WebSocket server listening on ws://0.0.0.0:8080
HTTP server listening on http://0.0.0.0:8000
```

**Вариант B: Через systemd сервис**

Создайте сервис:
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

Запуск:
```bash
systemctl daemon-reload
systemctl enable zeroday
systemctl start zeroday
systemctl status zeroday
```

### 5. Запуск frontend

```bash
cd /var/www/zeroday/client
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Для production сборки:
```bash
npm run build
# Frontend будет в папке dist/
```

### 6. Настройка nginx (опционально, для production)

```bash
nano /etc/nginx/sites-available/zeroday
```

**Конфигурация:**
```nginx
server {
    listen 80;
    server_name 85.239.35.171;

    # Frontend статические файлы
    location / {
        root /var/www/zeroday/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # HTTP API proxy
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Активация:
```bash
ln -s /etc/nginx/sites-available/zeroday /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## 🔍 Проверка работы

### 1. Проверка backend

```bash
# Проверка процесса
ps aux | grep zeroday-backend

# Проверка портов
netstat -tlnp | grep :8080
netstat -tlnp | grep :8000

# Просмотр логов systemd
journalctl -u zeroday -f
```

### 2. Проверка с вашего ПК

**PowerShell:**
```powershell
# Проверка WebSocket порта
Test-NetConnection 85.239.35.171 -Port 8080

# Проверка HTTP порта
Test-NetConnection 85.239.35.171 -Port 8000

# Если TcpTestSucceeded: True - порт открыт
```

**Браузер:**
- Откройте `http://85.239.35.171:5173`
- Должен загрузиться frontend

### 3. Проверка PostgreSQL

```bash
# Статус сервиса
systemctl status postgresql

# Проверка подключения
sudo -u postgres psql -c "SELECT 1"

# Проверка базы данных
sudo -u postgres psql -c "\l" | grep zeroday
```

## ⚠️ Решение проблем

### "Connection timed out"

1. Проверьте firewall: `ufw status`
2. Проверьте, что backend запущен: `ps aux | grep zeroday`
3. Проверьте порты: `netstat -tlnp`

### "Database connection failed"

```bash
# Проверьте PostgreSQL
systemctl status postgresql

# Создайте базу данных
sudo -u postgres psql
CREATE DATABASE zeroday;
\q
```

### "Port already in use"

```bash
# Найти процесс на порту
netstat -tlnp | grep :8080

# Убить процесс
kill -9 <PID>

# Или изменить порт в .env
WS_PORT=8081
```

### "WebSocket connection failed"

1. Убедитесь, что `WS_HOST=0.0.0.0` в .env
2. Проверьте firewall: `ufw allow 8080/tcp`
3. Перезапустите backend

## 📝 Полезные команды

```bash
# Перезапуск backend
systemctl restart zeroday

# Просмотр логов
journalctl -u zeroday -f
tail -f /var/log/nginx/error.log

# Обновление проекта
cd /var/www/zeroday
git pull

# Backend
cd backend
cargo build --release
systemctl restart zeroday

# Frontend
cd ../client
npm install
npm run build
```

## 🎉 Готово!

Теперь Zeroday доступен по адресу:
- **Frontend:** `http://85.239.35.171:5173`
- **WebSocket:** `ws://85.239.35.171:8080`
- **HTTP API:** `http://85.239.35.171:8000`

В браузере игры используйте zeroday:// URLs для доступа к сайтам.
