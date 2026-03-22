# Zero Day: Exploit Network

> Многопользовательская онлайн-игра-симуляция про взлом сетей, веба и социальную инженерию в безопасной виртуальной среде.

![Rust](https://img.shields.io/badge/Rust-000?style=for-the-badge&logo=rust)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)

## 🎮 Об игре

**Zero Day** — это киберпанк-симулятор хакерской деятельности, где игроки:

- 🖥️ Управляют собственным Linux-подобным рабочим столом
- 🌐 Исследуют симулированные сети и веб-сайты
- 💬 Общаются через встроенный мессенджер с другими игроками
- 📡 Используют кастомный скриптовый язык **HackScript** для автоматизации
- 🔐 Проходят CTF-челленджи и контракты
- 💰 Зарабатывают криптовалюту

## 🏗️ Архитектура проекта

```
ZeroDay-game/
├── backend/          # Rust + Actix-web API сервер
│   ├── src/
│   │   ├── auth.rs        # JWT аутентификация
│   │   ├── browser.rs     # Управление закладками браузера
│   │   ├── fs_online.rs   # Виртуальная файловая система
│   │   ├── messenger.rs   # P2P мессенджер
│   │   ├── sites.rs      # Симуляция веб-сайтов
│   │   └── websocket.rs   # Real-time коммуникация
│   └── migrations/    # SQLx миграции базы данных
│
├── client/           # React + Tauri desktop приложение
│   └── src/
│       ├── components/    # UI компоненты
│       │   ├── browser/       # ZeroBrowser — встроенный браузер
│       │   ├── code/          # CodeEditor — редактор с подсветкой синтаксиса
│       │   ├── files/        # Nautilus-подобный файловый менеджер
│       │   ├── terminal/      # Эмулятор терминала
│       │   └── ...
│       ├── lib/
│       │   ├── hackScript.ts  # Интерпретатор HackScript
│       │   └── gameFs.ts      # Управление виртуальным ФС
│       └── pages/
│           └── DashboardPage  # Главный рабочий стол (Linux DE)
│
├── client-src-tauri/  # Rust биндинги для Tauri
│
└── web/              # Next.js публичный сайт
    └── src/app/
        ├── landing/      # Лендинг с описанием игры
        ├── marketplace/  # Торговая площадка
        └── docs/         # Документация по HackScript
```

## 🚀 Технологии

### Backend
| Технология | Назначение |
|-----------|------------|
| **Rust** | Язык программирования |
| **Actix-web** | HTTP/WebSocket сервер |
| **SQLx** | Асинхронная работа с PostgreSQL |
| **jsonwebtoken** | JWT авторизация |
| **serde** | Сериализация данных |

### Client
| Технология | Назначение |
|-----------|------------|
| **React 18** | UI фреймворк |
| **TypeScript** | Типизация |
| **Tailwind CSS** | Стилизация |
| **Tauri 2** | Desktop билд |
| **Vite** | Бандлинг |

### Web
| Технология | Назначение |
|-----------|------------|
| **Next.js 14** | Фреймворк |
| **NextAuth** | Аутентификация |
| **Prisma** | ORM для БД |
| **Framer Motion** | Анимации |

## 🎯 HackScript

Кастомный скриптовый язык для автоматизации в игре:

```hack
# Простой скрипт
count = 5
sum = 0

for i in range(count):
  sum = sum + i

if sum >= 10:
  print("sum is " + sum)
else:
  print("too small")
```

### Встроенные функции
- `len(x)` — длина строки
- `str(x)`, `int(x)`, `float(x)` — преобразования типов
- `upper(x)`, `lower(x)` — регистр строк
- `sqrt(x)`, `abs(x)`, `min(...)`, `max(...)` — математика

## 🔧 Установка и запуск

### Требования
- Rust 1.70+
- Node.js 18+
- PostgreSQL 14+
- pnpm (или npm/yarn)

### Backend

```bash
cd backend
# Настройка переменных окружения
export DATABASE_URL="postgres://user:pass@localhost/zeroday"
export JWT_SECRET="your-secret-key"
export WS_HOST="127.0.0.1"
export WS_PORT=8080
export HTTP_PORT=8000

# Запуск миграций и сервера
cargo run
```

### Client (Development)

```bash
cd client
pnpm install
pnpm dev
```

### Web

```bash
cd web
pnpm install
pnpm dev
```

## 📁 Структура базы данных

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   users     │────▶│game_files   │◀────│ file_chunks │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│  profiles   │     │disk_usage   │
└─────────────┘     └─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│conversations│────▶│  messages   │◀────│attachments  │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 🎨 Интерфейс

### Desktop клиент
- **Рабочий стол** — GNOME-подобный Linux DE
- **Окна** — drag, resize, minimize, maximize, close
- **Панель задач** — start menu, запущенные приложения, system tray
- **Браузер** — ZeroBrowser с вкладками и закладками
- **Терминал** — эмулятор с подсветкой синтаксиса и autocomplete

### Web интерфейс
- **Лендинг** — информация об игре
- **Marketplace** — торговля предметами
- **Личный кабинет** — статистика, настройки
- **Документация** — HackScript справочник

## 🔒 Безопасность

> ⚠️ Все игровые механики — симуляция. Никакие реальные системы не взламываются.

- JWT токены с refresh механизмом
- HTTP-only cookies для сессий
- Валидация всех входных данных
- Симуляция сетей не имеет доступа к реальным системам

## 📝 Лицензия

Приватный проект. Все права защищены.

---

*Zero Day*
