# Мессенджер ZeroDay - Полная Документация

## Обзор

Мессенджер встроен непосредственно в браузер ZeroDay и доступен по адресу `zeroday://messenger`. 

## Функционал

### 1. Настройка профиля при первом запуске
- Уникальное имя пользователя (@messenger_id)
- Отображаемое имя (display_name)
- Статус "О себе"
- Аватар (URL)

### 2. Контакты и друзья
- **Поиск пользователей** по @messenger_id или имени
- **Отправка запросов в друзья**
- **Входящие запросы** с возможностью принять/отклонить
- **Список контактов** с пользовательскими именами
- **Блокировка контактов**
- **Удаление контактов**

### 3. Чаты
- **Личные чаты** с друзьями
- **Групповые чаты** (создание с несколькими участниками)
- **История сообщений** с подгрузкой старых сообщений
- **Статусы прочтения** (✓ - отправлено, ✓✓ - прочитано)
- **Индикатор "печатает..."**

### 4. Сообщения
- Текстовые сообщения
- Поддержка медиа (изображения, файлы)
- Ответы на сообщения (reply)
- Редактирование сообщений

## Архитектура

### База данных

#### messenger_profiles
```sql
- id UUID
- user_id UUID (ссылка на users)
- messenger_id TEXT (уникальное имя @username)
- display_name TEXT
- avatar_url TEXT
- about TEXT
- privacy_settings JSONB
- is_setup_complete BOOLEAN
```

#### messenger_contacts
```sql
- id UUID
- owner_user_id UUID
- contact_user_id UUID
- status (pending/accepted/blocked)
- custom_name TEXT
- added_by UUID
```

#### friend_requests
```sql
- id UUID
- sender_user_id UUID
- receiver_user_id UUID
- status (pending/accepted/declined)
```

#### conversations (из 008_messenger.sql)
```sql
- id UUID
- name TEXT (для групповых)
- is_group BOOLEAN
- created_by UUID
```

#### messages
```sql
- id UUID
- conversation_id UUID
- sender_id UUID
- content TEXT
- message_type (text/image/file)
- is_read BOOLEAN
```

### WebSocket API

#### Запросы клиента → сервер

**Профиль:**
```typescript
{ type: "SetupProfile", messenger_id: string, display_name: string, about?: string }
{ type: "GetProfile" }
{ type: "UpdateProfile", display_name?: string, avatar_url?: string, about?: string }
{ type: "SearchUsers", query: string }
```

**Друзья:**
```typescript
{ type: "SendFriendRequest", receiver_messenger_id: string }
{ type: "GetFriendRequests" }
{ type: "RespondToFriendRequest", request_id: string, accept: boolean }
{ type: "GetContacts" }
{ type: "RemoveContact", contact_user_id: string }
{ type: "BlockContact", contact_user_id: string }
```

**Чаты:**
```typescript
{ type: "CreateConversation", user_ids: string[], is_group: boolean, name?: string }
{ type: "GetConversations" }
{ type: "GetMessages", conversation_id: string, limit?: number, before?: string }
{ type: "SendMessage", conversation_id: string, content: string, message_type?: string }
{ type: "MarkAsRead", conversation_id: string, message_ids: string[] }
{ type: "TypingStart", conversation_id: string }
{ type: "TypingStop", conversation_id: string }
```

#### Ответы сервера → клиент

**Профиль:**
```typescript
{ type: "Profile", profile: MessengerProfile }
{ type: "ProfilesList", profiles: MessengerProfile[] }
```

**Друзья:**
```typescript
{ type: "ContactsList", contacts: Contact[] }
{ type: "FriendRequestsList", requests: FriendRequest[] }
{ type: "FriendRequestSent", request: FriendRequest }
{ type: "FriendRequestResponded", request_id: string, accepted: boolean }
```

**Чаты:**
```typescript
{ type: "ConversationCreated", conversation: Conversation }
{ type: "ConversationsList", conversations: Conversation[] }
{ type: "MessagesList", messages: Message[], has_more: boolean }
{ type: "MessageSent", message: Message }
{ type: "MessageReceived", message: Message }
{ type: "MessageRead", message_id: string, user_id: string, read_at: string }
{ type: "UserTyping", conversation_id: string, user_id: string, username: string }
```

## Использование

### 1. Запуск мессенджера

1. Откройте Zero Browser
2. Перейдите на `zeroday://messenger` или нажмите на иконку Messenger на домашней странице
3. При первом запуске настройте профиль

### 2. Добавление друзей

**Способ 1: Поиск по имени**
1. Нажмите "Добавить" в панели контактов
2. Введите @messenger_id или имя пользователя
3. Нажмите кнопку добавления

**Способ 2: Принятие запроса**
1. Входящие запросы отображаются вверху списка контактов
2. Нажмите ✓ для принятия или ✗ для отклонения

### 3. Начало чата

1. Найдите контакт в списке
2. Нажмите на иконку сообщения справа от контакта
3. Или создайте групповой чат через меню

### 4. Отправка сообщений

1. Введите текст в поле ввода
2. Нажмите Enter или кнопку отправки
3. Статусы: ✓ (отправлено), ✓✓ (прочитано)

## Интеграция в проект

### Файлы

**Backend:**
- `backend/migrations/008_messenger.sql` - базовые таблицы чатов
- `backend/migrations/009_messenger_profiles.sql` - профили и контакты
- `backend/src/messenger.rs` - логика мессенджера
- `backend/src/websocket.rs` - WebSocket обработчики

**Frontend:**
- `client/src/pages/MessengerPage.tsx` - основной компонент
- `client/src/types/auth.ts` - типы данных
- `client/src/components/browser/ZeroBrowser.tsx` - интеграция в браузер

### Настройка

1. Примените миграции:
```bash
cd backend
# Миграции применяются автоматически при запуске
```

2. Запустите проект:
```bash
npm run dev
```

3. Откройте браузер и перейдите на `zeroday://messenger`

## Будущие улучшения

- [ ] Голосовые/видео звонки
- [ ] Исчезающие сообщения
- [ ] Каналы (публичные чаты)
- [ ] Реакции на сообщения
- [ ] Пересылка сообщений
- [ ] Закрепленные чаты
- [ ] Темная/светлая тема
- [ ] End-to-end шифрование

## Безопасность

- JWT аутентификация для всех запросов
- Валидация messenger_id (уникальность)
- Защита от спама запросами в друзья
- Возможность блокировки пользователей
- Приватность через настройки (показ статуса онлайн, прочтения)
