import { useEffect, useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useMessenger } from "../hooks/useMessenger";
import { Conversation, Message } from "../types/auth";
import { Send, Paperclip, Smile, Search, MoreVertical, Phone, Video, ArrowLeft } from "lucide-react";

// Форматирование даты
function formatMessageDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } else if (days === 1) {
    return "Вчера";
  } else if (days < 7) {
    return date.toLocaleDateString("ru-RU", { weekday: "long" });
  } else {
    return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  }
}

function formatLastMessageDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = diff / (1000 * 60 * 60);
  
  if (hours < 24) {
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } else if (hours < 48) {
    return "Вчера";
  } else {
    return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  }
}

// Компонент аватара
function Avatar({ username, size = "md", url }: { username: string; size?: "sm" | "md" | "lg"; url?: string | null }) {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {url ? (
        <img src={url} alt={username} className="w-full h-full object-cover rounded-full" />
      ) : (
        username.charAt(0).toUpperCase()
      )}
    </div>
  );
}

// Компонент сообщения
function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[70%] ${isOwn ? "order-1" : "order-2"}`}>
        <div
          className={`px-4 py-2 rounded-2xl ${
            isOwn
              ? "bg-blue-600 text-white rounded-br-sm"
              : "bg-slate-700 text-slate-100 rounded-bl-sm"
          }`}
        >
          {message.reply_to_id && (
            <div className={`text-xs mb-1 pb-1 border-b ${isOwn ? "border-blue-500" : "border-slate-600"} opacity-70`}>
              Ответ на сообщение
            </div>
          )}
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className={`flex items-center gap-1 mt-1 text-xs ${isOwn ? "justify-end" : "justify-start"}`}>
          <span className="text-slate-400">{formatMessageDate(message.created_at)}</span>
          {isOwn && (
            <span className={message.is_read ? "text-blue-400" : "text-slate-500"}>
              {message.is_read ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Компонент чата в списке
function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const displayName = conversation.is_group
    ? conversation.name || "Групповой чат"
    : conversation.other_user?.username || "Неизвестный пользователь";

  const lastMessage = conversation.last_message;
  const lastMessageText = lastMessage
    ? lastMessage.content.length > 40
      ? lastMessage.content.substring(0, 40) + "..."
      : lastMessage.content
    : "Нет сообщений";

  const lastMessageSender = lastMessage && lastMessage.sender_id !== (conversation as any).currentUserId
    ? lastMessage.sender_username + ": "
    : "";

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
        isSelected ? "bg-slate-700/50" : "hover:bg-slate-800/50"
      }`}
    >
      <Avatar
        username={displayName}
        size="md"
        url={conversation.is_group ? conversation.avatar_url : conversation.other_user?.avatar_url}
      />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <h3 className="font-medium text-slate-100 truncate">{displayName}</h3>
          {lastMessage && (
            <span className="text-xs text-slate-500 ml-2">
              {formatLastMessageDate(lastMessage.created_at)}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center">
          <p className="text-sm text-slate-400 truncate">
            {lastMessageSender}
            {lastMessageText}
          </p>
          {conversation.unread_count > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">
              {conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Основной компонент мессенджера
export function Messenger() {
  const { user, isAuthenticated, sendJson, lastMessage } = useAuth();
  const {
    conversations,
    currentConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSending,
    error,
    loadConversations,
    selectConversation,
    loadMessages,
    sendMessage,
    createConversation,
    markAsRead,
    typingStart,
    typingStop,
  } = useMessenger({ sendJson, lastMessage, isAuthenticated });

  const [messageInput, setMessageInput] = useState("");
  const [showMobileList, setShowMobileList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Загружаем чаты при монтировании
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated]);

  // Автопрокрутка к новому сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Обработка отправки сообщения
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageInput.trim() || !currentConversation || isSending) return;

    try {
      await sendMessage(messageInput.trim());
      setMessageInput("");
      typingStop(currentConversation.id);
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Обработка ввода текста (индикатор печати)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessageInput(value);

    if (currentConversation && value.length > 0) {
      typingStart(currentConversation.id);

      // Сбрасываем предыдущий таймаут
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Устанавливаем новый таймаут для остановки печати
      typingTimeoutRef.current = setTimeout(() => {
        typingStop(currentConversation.id);
      }, 2000);
    }
  };

  // Выбор чата
  const handleSelectConversation = (conv: Conversation) => {
    selectConversation(conv);
    setShowMobileList(false);
    // Отмечаем сообщения как прочитанные
    const unreadMessages = messages.filter(m => !m.is_read && m.sender_id !== user?.id);
    if (unreadMessages.length > 0) {
      markAsRead(conv.id, unreadMessages.map(m => m.id));
    }
  };

  // Возврат к списку чатов (мобильная версия)
  const handleBackToList = () => {
    setShowMobileList(true);
  };

  // Фильтрация чатов по поиску
  const filteredConversations = conversations.filter(conv => {
    const name = conv.is_group
      ? conv.name || ""
      : conv.other_user?.username || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex h-full bg-slate-900">
      {/* Список чатов */}
      <div
        className={`${
          showMobileList ? "flex" : "hidden md:flex"
        } flex-col w-full md:w-80 lg:w-96 border-r border-slate-700 bg-slate-800/50`}
      >
        {/* Заголовок */}
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-slate-100 mb-3">Сообщения</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск чатов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Список */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              Загрузка чатов...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              {searchQuery ? "Чаты не найдены" : "Нет чатов"}
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={currentConversation?.id === conv.id}
                onClick={() => handleSelectConversation(conv)}
              />
            ))
          )}
        </div>
      </div>

      {/* Окно переписки */}
      <div
        className={`${
          showMobileList ? "hidden md:flex" : "flex"
        } flex-1 flex-col bg-slate-900`}
      >
        {currentConversation ? (
          <>
            {/* Заголовок чата */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToList}
                  className="md:hidden p-2 hover:bg-slate-700 rounded-lg text-slate-400"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Avatar
                  username={
                    currentConversation.is_group
                      ? currentConversation.name || "Групповой чат"
                      : currentConversation.other_user?.username || "Неизвестный"
                  }
                  size="md"
                  url={
                    currentConversation.is_group
                      ? currentConversation.avatar_url
                      : currentConversation.other_user?.avatar_url
                  }
                />
                <div>
                  <h3 className="font-semibold text-slate-100">
                    {currentConversation.is_group
                      ? currentConversation.name || "Групповой чат"
                      : currentConversation.other_user?.username || "Неизвестный"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {currentConversation.is_group
                      ? `${conversations.length} участников`
                      : currentConversation.other_user?.is_online
                      ? "Онлайн"
                      : "Офлайн"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400">
                  <Video className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  Загрузка сообщений...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  Начните общение прямо сейчас!
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.sender_id === user?.id}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Ввод сообщения */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-slate-700 bg-slate-800/50"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={messageInput}
                  onChange={handleInputChange}
                  placeholder="Напишите сообщение..."
                  className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-full text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                  disabled={isSending}
                />
                <button
                  type="button"
                  className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <button
                  type="submit"
                  disabled={!messageInput.trim() || isSending}
                  className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-full text-white transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            Выберите чат для начала общения
          </div>
        )}
      </div>
    </div>
  );
}
