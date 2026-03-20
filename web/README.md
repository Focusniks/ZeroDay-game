# ZeroDay Game - Web Application

Веб-приложение для игры ZeroDay: система аутентификации, торговая площадка, документация HackScript.

## Технологии

- **Next.js 14** — React фреймворк
- **NextAuth.js** — аутентификация
- **Prisma** — ORM для работы с БД
- **Tailwind CSS** — стилизация

## Запуск

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Структура

- `/src/app/docs` — документация языка HackScript
- `/src/app/marketplace` — торговая площадка
- `/src/app/account` — личный кабинет пользователя
- `/src/app/api/auth` — API аутентификации

## HackScript

Встроенный язык программирования для игры. См. полную документацию на `/docs`.

### Быстрый старт

```hack
# Переменные
name = "agent"
level = 1

# Условие
if level >= 5:
  print("experienced")
else:
  print("newbie")

# Цикл for
for i in range(5):
  print(i)

# Цикл while
x = 0
while x < 3:
  print(x)
  x = x + 1

# Встроенные функции
print(len("hello"))     # 5
print(sqrt(16))         # 4
print(max(1, 10, 3))    # 10
print(upper("hack"))    # HACK
```

### Запуск в терминале

```bash
cd Scripts
hackrun script.hack
```

## Лицензия

Proprietary — ZeroDay Game
