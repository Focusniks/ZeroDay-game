import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation, Message } from "../types/auth";

type UseMessengerOptions = {
  sendJson: (message: any) => void;
  lastMessage: string | null;
  isAuthenticated: boolean;
};

type UseMessengerReturn = {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  error: string | null;
  // Actions
  loadConversations: () => void;
  selectConversation: (conversation: Conversation) => void;
  loadMessages: (conversationId: string, before?: string) => void;
  sendMessage: (content: string, messageType?: string) => Promise<void>;
  createConversation: (userIds: string[], isGroup?: boolean, name?: string) => Promise<void>;
  markAsRead: (conversationId: string, messageIds: string[]) => void;
  typingStart: (conversationId: string) => void;
  typingStop: (conversationId: string) => void;
};

export function useMessenger({
  sendJson,
  lastMessage,
  isAuthenticated,
}: UseMessengerOptions): UseMessengerReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const pendingRequests = useRef<Map<string, { resolve: () => void; reject: (error: Error) => void }>>(new Map());
  const messageTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Обработка входящих сообщений
  useEffect(() => {
    if (!lastMessage) return;

    let data: any = null;
    try {
      data = JSON.parse(lastMessage);
    } catch {
      return;
    }

    if (!data) return;

    switch (data.type) {
      case "ConversationsList":
        setConversations(data.conversations || []);
        setIsLoadingConversations(false);
        break;

      case "ConversationCreated":
        setConversations(prev => [data.conversation, ...prev]);
        setCurrentConversation(data.conversation);
        break;

      case "MessagesList":
        setMessages(data.messages || []);
        setIsLoadingMessages(false);
        break;

      case "MessageSent":
        // Сообщение отправлено успешно
        setIsSending(false);
        // Добавляем сообщение в список, если это текущий чат
        if (currentConversation && data.message.conversation_id === currentConversation.id) {
          setMessages(prev => [...prev, data.message]);
        }
        // Обновляем последнее сообщение в списке чатов
        setConversations(prev => prev.map(conv => 
          conv.id === data.message.conversation_id 
            ? { ...conv, last_message: {
                id: data.message.id,
                content: data.message.content,
                sender_id: data.message.sender_id,
                sender_username: data.message.sender_username || "",
                created_at: data.message.created_at,
                message_type: data.message.message_type,
              },
              updated_at: data.message.created_at,
            }
            : conv
        ).sort((a, b) => {
          // Сортируем: текущий чат вверх, затем по дате
          if (a.id === currentConversation?.id) return -1;
          if (b.id === currentConversation?.id) return 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }));
        break;

      case "MessageReceived":
        // Получено новое сообщение от другого пользователя
        if (currentConversation && data.message.conversation_id === currentConversation.id) {
          setMessages(prev => [...prev, data.message]);
          // Автоматически отмечаем как прочитанное
          markAsRead(currentConversation.id, [data.message.id]);
        }
        // Обновляем последнее сообщение в списке чатов
        setConversations(prev => prev.map(conv => 
          conv.id === data.message.conversation_id 
            ? { 
                ...conv, 
                last_message: {
                  id: data.message.id,
                  content: data.message.content,
                  sender_id: data.message.sender_id,
                  sender_username: data.message.sender_username || "",
                  created_at: data.message.created_at,
                  message_type: data.message.message_type,
                },
                updated_at: data.message.created_at,
                unread_count: conv.id === currentConversation?.id ? conv.unread_count : conv.unread_count + 1,
              }
            : conv
        ).sort((a, b) => {
          if (a.id === currentConversation?.id) return -1;
          if (b.id === currentConversation?.id) return 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }));
        break;

      case "MessageRead":
        // Обновляем статус прочтения
        setMessages(prev => prev.map(msg => 
          msg.id === data.message_id 
            ? { ...msg, is_read: true }
            : msg
        ));
        break;

      case "UserTyping":
        // Пользователь начал печатать
        if (currentConversation && data.conversation_id === currentConversation.id) {
          // Можно показать индикатор "печатает..."
          console.log(`User ${data.username} is typing...`);
        }
        break;

      case "UserStoppedTyping":
        // Пользователь перестал печатать
        break;

      case "Error":
        setError(`${data.code}: ${data.message}`);
        // Отклоняем все ожидающие запросы
        pendingRequests.current.forEach((_, key) => {
          pendingRequests.current.get(key)?.reject(new Error(data.message));
        });
        pendingRequests.current.clear();
        setIsLoadingConversations(false);
        setIsLoadingMessages(false);
        setIsSending(false);
        break;
    }
  }, [lastMessage, currentConversation]);

  const loadConversations = useCallback(() => {
    if (!isAuthenticated) return;
    setIsLoadingConversations(true);
    setError(null);
    try {
      sendJson({ type: "GetConversations" });
    } catch (err) {
      setIsLoadingConversations(false);
      setError(err instanceof Error ? err.message : "Failed to send request");
    }
  }, [sendJson, isAuthenticated]);

  const selectConversation = useCallback((conversation: Conversation) => {
    setCurrentConversation(conversation);
    setMessages([]);
    // Загружаем сообщения при выборе чата
    setTimeout(() => {
      loadMessages(conversation.id);
    }, 0);
  }, []);

  const loadMessages = useCallback((conversationId: string, before?: string) => {
    if (!isAuthenticated) return;
    setIsLoadingMessages(true);
    setError(null);
    try {
      sendJson({ 
        type: "GetMessages", 
        conversation_id: conversationId,
        limit: 50,
        before,
      });
    } catch (err) {
      setIsLoadingMessages(false);
      setError(err instanceof Error ? err.message : "Failed to send request");
    }
  }, [sendJson, isAuthenticated]);

  const sendMessage = useCallback(async (content: string, messageType?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!isAuthenticated || !currentConversation) {
        reject(new Error("Not authenticated or no conversation selected"));
        return;
      }

      setIsSending(true);
      setError(null);

      // Устанавливаем таймаут
      const timeoutId = setTimeout(() => {
        setIsSending(false);
        reject(new Error("Message send timeout"));
      }, 10000);

      try {
        sendJson({
          type: "SendMessage",
          conversation_id: currentConversation.id,
          content,
          message_type: messageType,
        });
        
        // Сохраняем resolve для вызова после подтверждения
        const requestId = `send_${Date.now()}`;
        pendingRequests.current.set(requestId, {
          resolve: () => {
            clearTimeout(timeoutId);
            setIsSending(false);
            resolve();
          },
          reject: (error: Error) => {
            clearTimeout(timeoutId);
            setIsSending(false);
            reject(error);
          },
        });
      } catch (err) {
        clearTimeout(timeoutId);
        setIsSending(false);
        reject(err instanceof Error ? err : new Error("Failed to send message"));
      }
    });
  }, [sendJson, isAuthenticated, currentConversation]);

  const createConversation = useCallback(async (userIds: string[], isGroup?: boolean, name?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!isAuthenticated) {
        reject(new Error("Not authenticated"));
        return;
      }

      setError(null);
      const timeoutId = setTimeout(() => {
        reject(new Error("Create conversation timeout"));
      }, 10000);

      try {
        sendJson({
          type: "CreateConversation",
          user_ids: userIds,
          is_group: isGroup || false,
          name,
        });

        const requestId = `create_${Date.now()}`;
        pendingRequests.current.set(requestId, {
          resolve: () => {
            clearTimeout(timeoutId);
            resolve();
          },
          reject: (error: Error) => {
            clearTimeout(timeoutId);
            reject(error);
          },
        });
      } catch (err) {
        clearTimeout(timeoutId);
        reject(err instanceof Error ? err : new Error("Failed to create conversation"));
      }
    });
  }, [sendJson, isAuthenticated]);

  const markAsRead = useCallback((conversationId: string, messageIds: string[]) => {
    if (!isAuthenticated || messageIds.length === 0) return;
    
    try {
      sendJson({
        type: "MarkAsRead",
        conversation_id: conversationId,
        message_ids: messageIds,
      });
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  }, [sendJson, isAuthenticated]);

  const typingStart = useCallback((conversationId: string) => {
    if (!isAuthenticated) return;
    try {
      sendJson({ type: "TypingStart", conversation_id: conversationId });
    } catch (err) {
      console.error("Failed to send typing start:", err);
    }
  }, [sendJson, isAuthenticated]);

  const typingStop = useCallback((conversationId: string) => {
    if (!isAuthenticated) return;
    try {
      sendJson({ type: "TypingStop", conversation_id: conversationId });
    } catch (err) {
      console.error("Failed to send typing stop:", err);
    }
  }, [sendJson, isAuthenticated]);

  return {
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
  };
}
