# Мессенджер ZeroDay

Мессенджер в стиле Signal, встроенный в игру ZeroDay.

## Требования

1. **PostgreSQL** - база данных
2. **Rust** - для backend
3. **Node.js** - для frontend

## Настройка базы данных

1. Установите PostgreSQL (если не установлен)
2. Создайте базу данных:

```sql
CREATE DATABASE zeroday;
```

3. Или обновите `DATABASE_URL` в файле `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@host:port/zeroday
```

## Запуск

```bash
# Из корня проекта
npm run dev
```

## Компоненты мессенджера

### Backend

- **migrations/008_messenger.sql** - миграция БД для таблиц мессенджера
- **src/messenger.rs** - логика обработки сообщений
- **src/websocket.rs** - WebSocket сервер с поддержкой мессенджера

### Frontend

- **src/components/Messenger.tsx** - UI компонент мессенджера
- **src/hooks/useMessenger.ts** - хук для управления состоянием
- **src/types/auth.ts** - типы данных (добавлены Conversation, Message)

## Функционал

- ✅ Регистрация/авторизация через WebSocket
- ✅ Создание личных чатов
- ✅ Отправка сообщений в реальном времени
- ✅ Статусы прочтения (✓ и ✓✓)
- ✅ Индикатор "печатает..."
- ✅ Список чатов с последними сообщениями
- ✅ Подсчет непрочитанных сообщений
- ✅ Мгновенная доставка через WebSocket

## API мессенджера

### WebSocket сообщения

**Запросы:**
- `CreateConversation` - создать чат
- `GetConversations` - получить список чатов
- `GetMessages` - получить сообщения чата
- `SendMessage` - отправить сообщение
- `MarkAsRead` - отметить как прочитанное
- `TypingStart` - начал печатать
- `TypingStop` - перестал печатать

**Ответы:**
- `ConversationCreated` - чат создан
- `ConversationsList` - список чатов
- `MessagesList` - сообщения чата
- `MessageSent` - сообщение отправлено
- `MessageReceived` - получено новое сообщение
- `MessageRead` - сообщение прочитано
- `UserTyping` - пользователь печатает
- `UserStoppedTyping` - пользователь перестал печатать

## Структура БД

### conversations
- `id` - UUID чата
- `name` - имя (для групповых)
- `is_group` - флаг группового чата
- `created_by` - создатель
- `created_at`, `updated_at`

### conversation_members
- `conversation_id` - чат
- `user_id` - участник
- `role` - роль (admin/member)
- `last_read_message_at` - последнее прочитанное

### messages
- `id` - UUID сообщения
- `conversation_id` - чат
- `sender_id` - отправитель
- `content` - текст
- `message_type` - тип (text/image/file)
- `is_read` - прочитано ли
- `created_at`

### message_read_receipts
- `message_id` - сообщение
- `user_id` - прочитавший
- `read_at` - время прочтения
