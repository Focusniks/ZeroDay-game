# Zerogram - Инструкция по развертыванию на сервере Timeweb

## 📋 Требования

- VPS сервер с Ubuntu 20.04/22.04
- Минимум 2GB RAM, 2 CPU cores
- Домен (опционально, можно использовать IP)

## 🚀 Шаг 1: Подключение к серверу

```bash
ssh root@ваш-server-ip
```

## 📦 Шаг 2: Установка зависимостей

### Обновление системы
```bash
apt update && apt upgrade -y
```

### Установка Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup default stable
```

### Установка PostgreSQL
```bash
apt install -y postgresql postgresql-contrib
```

### Установка Node.js (для сборки frontend)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### Установка nginx (опционально, для reverse proxy)
```bash
apt install -y nginx
```

## 🗄️ Шаг 3: Настройка базы данных

```bash
# Вход в PostgreSQL
sudo -u postgres psql

# Создание пользователя и базы данных
CREATE DATABASE zerogram;
CREATE USER zerogram_user WITH PASSWORD 'ваш_пароль';
GRANT ALL PRIVILEGES ON DATABASE zerogram TO zerogram_user;
\q

# Выход из PostgreSQL
```

## 📤 Шаг 4: Загрузка проекта на сервер

### Вариант A: Через Git
```bash
cd /var/www
git clone https://github.com/ваш-username/zeroday-game.git zerogram
cd zerogram
```

### Вариант B: Через SCP (локально)
```bash
# С вашего компьютера
scp -r e:\ZeroDay-game root@ваш-server-ip:/var/www/zerogram
```

## 🔧 Шаг 5: Настройка backend

```bash
cd /var/www/zerogram/backend

# Создание .env файла
nano .env
```

### Содержимое .env:
```env
DATABASE_URL=postgresql://zerogram_user:ваш_пароль@localhost:5432/zerogram
JWT_SECRET=ваш_secret_key_генерируете_случайную_строку
WS_HOST=0.0.0.0
WS_PORT=8080
HTTP_HOST=0.0.0.0
HTTP_PORT=8000
WEB_ORIGIN=http://ваш-domain-или-ip:5173
```

### Сборка и запуск backend
```bash
# Сборка релизной версии
cargo build --release

# Запуск (для тестирования)
./target/release/zeroday-backend

# Или через systemd (см. ниже)
```

## 🎨 Шаг 6: Сборка frontend

```bash
cd /var/www/zerogram/client

# Установка зависимостей
npm install

# Сборка
npm run build

# Frontend будет в папке dist/
```

## 🔐 Шаг 7: Настройка nginx (опционально, но рекомендуется)

```bash
nano /etc/nginx/sites-available/zerogram
```

### Конфигурация nginx:
```nginx
server {
    listen 80;
    server_name ваш-domain-или-ip;

    # Frontend статические файлы
    location / {
        root /var/www/zerogram/client/dist;
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

### Активация сайта
```bash
ln -s /etc/nginx/sites-available/zerogram /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## 🛡️ Шаг 8: Настройка systemd сервиса

```bash
nano /etc/systemd/system/zerogram.service
```

### Содержимое сервиса:
```ini
[Unit]
Description=Zerogram Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/zerogram/backend
ExecStart=/var/www/zerogram/backend/target/release/zeroday-backend
Restart=always
RestartSec=10
Environment=PATH=/root/.cargo/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
```

### Запуск сервиса
```bash
systemctl daemon-reload
systemctl enable zerogram
systemctl start zerogram
systemctl status zerogram
```

## 🔒 Шаг 9: Настройка firewall

```bash
# Установка ufw
apt install -y ufw

# Разрешение SSH
ufw allow ssh

# Разрешение HTTP/HTTPS
ufw allow http
ufw allow https

# Включение firewall
ufw enable
ufw status
```

## 🎯 Шаг 10: Применение миграций

Миграции применяются автоматически при первом запуске backend.

Проверка:
```bash
# Просмотр логов
journalctl -u zerogram -f

# Или если запускаете вручную
cd /var/www/zerogram/backend
./target/release/zeroday-backend
```

## 🌐 Доступ к мессенджеру

После настройки мессенджер будет доступен по адресу:

- **Через nginx:** `http://ваш-domain-или-ip/`
- **Напрямую:** `http://ваш-domain-или-ip:5173/` (только frontend)

В браузере перейдите на главную страницу и откройте `zerogram://messenger` или добавьте кнопку в интерфейс.

## 📝 Полезные команды

### Перезапуск сервиса
```bash
systemctl restart zerogram
```

### Просмотр логов
```bash
journalctl -u zerogram -f
tail -f /var/log/nginx/error.log
```

### Обновление проекта
```bash
cd /var/www/zerogram
git pull

# Backend
cd backend
cargo build --release
systemctl restart zerogram

# Frontend
cd ../client
npm install
npm run build
```

### Резервное копирование БД
```bash
sudo -u postgres pg_dump zerogram > /backup/zerogram_$(date +%Y%m%d).sql
```

## ⚠️ Решение проблем

### Backend не запускается
```bash
# Проверка логов
journalctl -u zerogram --no-pager -n 50

# Проверка портов
netstat -tlnp | grep :8080
netstat -tlnp | grep :8000
```

### Ошибки подключения к БД
```bash
# Проверка PostgreSQL
systemctl status postgresql

# Проверка подключения
psql -U zerogram_user -d zerogram -h localhost
```

### WebSocket не подключается
- Убедитесь, что nginx настроен правильно (proxy_set_header Upgrade)
- Проверьте firewall (порт 8080 должен быть открыт для nginx)
- В логах nginx: `tail -f /var/log/nginx/access.log`

## 🎉 Готово!

Мессенджер Zerogram развернут и готов к использованию!

Для доступа из игры ZeroDay:
1. Обновите конфигурацию браузера на использование нового URL
2. Или добавьте кнопку "Zerogram" в интерфейс браузера
