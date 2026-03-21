import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import type { MessengerProfile, Contact, FriendRequest, Conversation, Message } from "../types/auth";
import { 
  Send, Users, UserPlus, Settings, Search, Phone, Video, MoreVertical, 
  ArrowLeft, Check, CheckCheck, X, Image as ImageIcon, Paperclip, Smile,
  MessageSquare, LogOut, Mic, Trash2, Ban, UserX, Edit2, Download,
  ChevronDown, Info, Star, Bell, BellOff, CheckCircle
} from "lucide-react";

// ==================== UI Компоненты ====================

function Avatar({ name, url, size = "md", online = false }: { name: string; url?: string | null; size?: "sm" | "md" | "lg" | "xl"; online?: boolean }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base", xl: "w-20 h-20 text-2xl" };
  
  return (
    <div className="relative flex-shrink-0">
      <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold overflow-hidden shadow-lg`}>
        {url ? (
          <img src={url} alt={name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = ''; }} />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></span>
      )}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", className = "", disabled = false, size = "md" }: any) {
  const variants: any = {
    primary: "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/30",
    secondary: "bg-slate-700/80 hover:bg-slate-600 text-slate-100 backdrop-blur-sm",
    danger: "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg shadow-red-500/30",
    ghost: "hover:bg-slate-700/50 text-slate-300",
    icon: "hover:bg-slate-700/50 text-slate-400 hover:text-white",
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
    icon: "p-2",
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${sizes[size as keyof typeof sizes]} rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, className = "", type = "text", onKeyDown }: any) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={`w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all ${className}`}
    />
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Вчера';
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'long' });
  } else {
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  }
}

// ==================== Настройки профиля ====================

function ProfileSettings({ profile, onClose }: { profile: MessengerProfile; onClose: () => void }) {
  const { sendJson } = useAuth();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [about, setAbout] = useState(profile.about || "");
  const [avatarData, setAvatarData] = useState<string | null>(profile.avatar_url);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarData(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setLoading(true);
    sendJson({
      type: "UpdateProfile",
      display_name: displayName.trim(),
      avatar_url: avatarData || undefined,
      about: about.trim() || undefined,
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Настройки профиля</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="p-6 space-y-5">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div 
              className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold shadow-xl cursor-pointer overflow-hidden mb-3"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarData && !avatarData.startsWith('http') ? (
                <img src={avatarData} alt="Avatar" className="w-full h-full object-cover" />
              ) : avatarData ? (
                <img src={avatarData} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = ''; }} />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="w-4 h-4 mr-2 inline" />
              Изменить аватар
            </Button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Отображаемое имя
            </label>
            <Input
              value={displayName}
              onChange={(e: any) => setDisplayName(e.target.value)}
              placeholder="Ваше имя"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              О себе
            </label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Расскажите о себе"
              rows={4}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleSave} disabled={loading}>
              {loading ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupProfileScreen({ error, onError }: { error: string; onError: (error: string) => void }) {
  const { sendJson } = useAuth();
  const [messengerId, setMessengerId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [about, setAbout] = useState("");
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarData(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messengerId.trim() || !displayName.trim()) {
      onError("Заполните обязательные поля");
      return;
    }

    setLoading(true);
    onError("");
    
    sendJson({
      type: "SetupProfile",
      messenger_id: messengerId.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
      display_name: displayName.trim(),
      about: about.trim() || undefined,
    });
    
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-full bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950 p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="relative h-32 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
            <div className="absolute inset-0 bg-black/20"></div>
          </div>
          
          {/* Avatar */}
          <div className="relative px-8 -mt-16 mb-6">
            <div className="relative inline-block">
              <div 
                className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-5xl font-bold shadow-2xl cursor-pointer overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarData ? (
                  <img src={avatarData} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  displayName.charAt(0).toUpperCase() || "?"
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button 
                className="absolute bottom-0 right-0 w-10 h-10 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center shadow-lg transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">Создание профиля</h1>
              <p className="text-slate-400 text-sm">Настройте свой профиль в мессенджере</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Уникальное имя *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">@</span>
                <Input
                  value={messengerId}
                  onChange={(e: any) => setMessengerId(e.target.value)}
                  placeholder="username"
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Только латиница, цифры и _
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Отображаемое имя *
              </label>
              <Input
                value={displayName}
                onChange={(e: any) => setDisplayName(e.target.value)}
                placeholder="Как вас называть"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                О себе
              </label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Расскажите немного о себе"
                rows={3}
                className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-900/30 border border-red-800/50 rounded-xl text-red-200 text-sm flex items-center gap-3">
                <X className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button className="w-full py-3.5 text-base font-semibold" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Сохранение...
                </span>
              ) : (
                "Готово"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ==================== Сообщение ====================

function MessageBubble({ message, isOwn, showAvatar, conversation }: { message: Message; isOwn: boolean; showAvatar: boolean; conversation?: any }) {
  return (
    <div className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""} group`}>
      {!isOwn && showAvatar && (
        <Avatar name={message.sender_username || "User"} size="sm" />
      )}
      {!isOwn && !showAvatar && <div className="w-8" />}
      
      <div className={`max-w-[65%] ${isOwn ? "order-1" : ""}`}>
        {!isOwn && showAvatar && (
          <div className="text-xs text-slate-400 mb-1 ml-1">{message.sender_username}</div>
        )}
        
        <div
          className={`px-4 py-2.5 rounded-2xl ${
            isOwn
              ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-md shadow-lg shadow-blue-500/20"
              : "bg-slate-800/80 text-slate-100 rounded-bl-md backdrop-blur-sm"
          }`}
        >
          {message.reply_to_id && (
            <div className={`text-xs mb-2 pb-2 border-b ${isOwn ? "border-blue-400/30" : "border-slate-600/30"} opacity-70`}>
              ↩ Ответ на сообщение
            </div>
          )}
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        </div>
        
        <div className={`flex items-center gap-1.5 mt-1 text-xs ${isOwn ? "justify-end" : "justify-start"}`}>
          <span className="text-slate-500">{formatTime(message.created_at)}</span>
          {isOwn && (
            <span className={message.is_read ? "text-blue-400" : "text-slate-500"}>
              {message.is_read ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Чат в списке ====================

function ChatItem({ conversation, isSelected, onClick }: { conversation: Conversation; isSelected: boolean; onClick: () => void }) {
  const displayName = conversation.is_group
    ? conversation.name || "Групповой чат"
    : conversation.other_user?.username || "Неизвестный";

  const lastMessage = conversation.last_message;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3.5 cursor-pointer transition-all duration-200 ${
        isSelected 
          ? "bg-blue-600/20 border-l-2 border-blue-500" 
          : "hover:bg-slate-800/50 border-l-2 border-transparent"
      }`}
    >
      <Avatar
        name={displayName}
        url={conversation.is_group ? conversation.avatar_url : conversation.other_user?.avatar_url}
        online={!conversation.is_group && conversation.other_user?.is_online}
      />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <h3 className="font-semibold text-slate-100 truncate">{displayName}</h3>
          {lastMessage && (
            <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
              {formatTime(lastMessage.created_at)}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center">
          <p className="text-sm text-slate-400 truncate">
            {lastMessage ? (
              <>
                {lastMessage.sender_id !== conversation.id && (
                  <span className="text-slate-500">{lastMessage.sender_username}: </span>
                )}
                {lastMessage.content}
              </>
            ) : (
              <span className="text-slate-600">Нет сообщений</span>
            )}
          </p>
          {conversation.unread_count > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full flex-shrink-0 min-w-[20px] text-center">
              {conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Контакт ====================

function ContactItem({ contact, onSelect, onMessage, onRemove }: any) {
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-slate-800/50 rounded-xl transition-all group">
      <Avatar
        name={contact.contact_display_name || "User"}
        url={contact.contact_avatar_url}
        online={contact.is_online}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-100 truncate">
          {contact.custom_name || contact.contact_display_name}
        </div>
        <div className="text-sm text-slate-500">@{contact.contact_messenger_id}</div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="icon" size="icon" onClick={() => onMessage(contact)}>
          <MessageSquare className="w-4 h-4" />
        </Button>
        <Button variant="icon" size="icon" onClick={() => onRemove(contact.contact_user_id)}>
          <UserX className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ==================== Запрос в друзья ====================

function FriendRequestItem({ request, onAccept, onDecline }: any) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl border border-slate-700/50">
      <Avatar name={request.sender_display_name || "User"} url={request.sender_avatar_url} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-100 truncate">{request.sender_display_name}</div>
        <div className="text-xs text-slate-500">@{request.sender_messenger_id}</div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onAccept(request.id)}
          className="p-2 bg-green-600 hover:bg-green-500 rounded-lg text-white transition-colors"
          title="Принять"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDecline(request.id)}
          className="p-2 bg-red-600 hover:bg-red-500 rounded-lg text-white transition-colors"
          title="Отклонить"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ==================== Модальное окно добавления контакта ====================

function AddContactModal({ onClose, onAdd, profile }: {
  onClose: () => void;
  onAdd: (messengerId: string) => void;
  profile: MessengerProfile | null;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessengerProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<MessengerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { sendJson, lastMessage } = useAuth();

  // Поиск пользователя при вводе с задержкой
  useEffect(() => {
    const timer = setTimeout(() => {
      const query = searchQuery.trim();
      if (query.length >= 2) {
        setLoading(true);
        setError("");
        setSearchResults([]);
        setSelectedUser(null);
        sendJson({ type: "SearchUsers", query });
      } else {
        setSearchResults([]);
        setSelectedUser(null);
        setLoading(false);
      }
    }, 500); // Уменьшенная задержка для более быстрого поиска

    return () => clearTimeout(timer);
  }, [searchQuery, sendJson]);

  // Обработка результатов поиска через lastMessage
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const data = JSON.parse(lastMessage);
      console.log('[AddContact] Received message:', data);
      
      if (data.type === "ProfilesList") {
        setLoading(false);
        const results = data.profiles || [];
        console.log('[AddContact] Found profiles:', results);
        
        // Фильтруем самого пользователя
        const filtered = profile
          ? results.filter((p: MessengerProfile) => p.user_id !== profile.user_id)
          : results;
        setSearchResults(filtered);

        if (filtered.length === 0) {
          setError("Никто не найден. Проверьте правильность ввода.");
        } else {
          setError("");
        }
      } else if (data.type === "Error") {
        setLoading(false);
        console.error('[AddContact] Error:', data);
        
        if (data.code === "no_profile") {
          setError("У вас нет профиля мессенджера. Создайте его в настройках.");
        } else if (data.code === "search_error") {
          setError(data.message || "Ошибка при поиске");
        } else if (data.code === "not_authorized") {
          setError("Требуется авторизация");
        } else {
          setError(data.message || "Ошибка при поиске");
        }
      }
    } catch (err) {
      console.error('[AddContact] Parse error:', err);
      // ignore parse errors
    }
  }, [lastMessage, profile]);

  const handleSelectUser = (user: MessengerProfile) => {
    // Проверяем что user_id существует и совпадает с текущим пользователем
    if (profile && user.user_id && user.user_id === profile.user_id) {
      setError("Нельзя добавить себя в друзья");
      return;
    }
    setSelectedUser(user);
    setError("");
  };

  const handleSendRequest = async () => {
    if (!selectedUser) return;

    setSending(true);
    setError("");

    try {
      onAdd(selectedUser.messenger_id);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError("Не удалось отправить запрос. Попробуйте снова.");
    } finally {
      setSending(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-green-900/90 to-emerald-900/90 rounded-3xl border border-green-700/50 p-8 max-w-sm w-full shadow-2xl text-center">
          <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4 animate-bounce">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Готово!</h3>
          <p className="text-green-100">Запрос в друзья отправлен</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900/95 rounded-2xl border border-slate-700/50 max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-5">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Добавить контакт</h3>
              <p className="text-blue-100 text-xs">Поиск по messenger_id или имени</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-5">
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Messenger ID или имя
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="@username или имя"
                className="w-full pl-10 pr-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                autoFocus
              />
              {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Введите минимум 2 символа для поиска
            </p>
          </div>

          {/* Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Найдено: {searchResults.length}
              </p>
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    selectedUser?.id === user.id
                      ? "bg-blue-600/20 border-blue-500"
                      : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {user.avatar_url && !user.avatar_url.startsWith('http') ? (
                      <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover rounded-full" />
                    ) : user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = ''; }} />
                    ) : (
                      user.display_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-white truncate text-sm">{user.display_name}</p>
                    <p className="text-xs text-slate-400 truncate">@{user.messenger_id}</p>
                  </div>
                  {selectedUser?.id === user.id && (
                    <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {!loading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-slate-400 text-sm">Никто не найден</p>
              <p className="text-xs text-slate-500 mt-1">Проверьте правильность ввода</p>
            </div>
          )}

          {/* Initial state */}
          {!loading && searchQuery.trim().length < 2 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-slate-400 text-sm">Начните вводить для поиска</p>
              <p className="text-xs text-slate-500 mt-1">Минимум 2 символа</p>
            </div>
          )}

          {/* Error */}
          {error && !error.includes("Никто не найден") && (
            <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-3 flex items-start gap-3 mb-4">
              <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Selected user action */}
          {selectedUser && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                  {selectedUser.avatar_url && !selectedUser.avatar_url.startsWith('http') ? (
                    <img src={selectedUser.avatar_url} alt={selectedUser.display_name} className="w-full h-full object-cover rounded-full" />
                  ) : selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt={selectedUser.display_name} className="w-full h-full object-cover rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = ''; }} />
                  ) : (
                    selectedUser.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm">{selectedUser.display_name}</p>
                  <p className="text-xs text-slate-400">@{selectedUser.messenger_id}</p>
                </div>
              </div>
              {selectedUser.about && (
                <p className="text-sm text-slate-400 italic mb-3">"{selectedUser.about}"</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-medium text-sm"
            >
              Отмена
            </button>
            <button
              onClick={handleSendRequest}
              disabled={!selectedUser || sending}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm ${
                selectedUser && !sending
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/30"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Отправка...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Отправить запрос
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Модальное окно создания группового чата ====================

function CreateGroupChatModal({ onClose, onCreate, contacts, profile }: {
  onClose: () => void;
  onCreate: (userIds: string[], name: string) => void;
  contacts: Contact[];
  profile: MessengerProfile | null;
}) {
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(false);

  const filteredContacts = contacts.filter(contact => {
    const name = (contact.custom_name || contact.contact_display_name || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || contact.contact_messenger_id?.toLowerCase().includes(query);
  });

  const toggleContact = (userId: string) => {
    setSelectedContacts(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
    setError("");
  };

  const handleCreate = async () => {
    if (selectedContacts.length < 2) {
      setError("Выберите минимум 2 участников");
      return;
    }
    if (!groupName.trim()) {
      setError("Введите название группы");
      return;
    }

    setCreating(true);
    setError("");

    try {
      onCreate(selectedContacts, groupName.trim());
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError("Не удалось создать группу. Попробуйте снова.");
    } finally {
      setCreating(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-green-900/90 to-emerald-900/90 rounded-3xl border border-green-700/50 p-8 max-w-sm w-full shadow-2xl text-center">
          <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4 animate-bounce">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Группа создана!</h3>
          <p className="text-green-100">Можно начинать общение</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900/95 rounded-3xl border border-slate-700/50 max-w-lg w-full shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 p-6 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Создать группу</h3>
              <p className="text-purple-100 text-sm">Выберите участников</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Group name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Название группы *
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Введите название группы"
              maxLength={50}
              className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
            <p className="text-xs text-slate-500 mt-1">{groupName.length}/50</p>
          </div>

          {/* Search */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Поиск контактов
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Фильтр контактов..."
                className="w-full pl-12 pr-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>
          </div>

          {/* Selected count */}
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Выбрано: <span className="text-purple-400 font-semibold">{selectedContacts.length}</span>
            </p>
            {selectedContacts.length > 0 && (
              <button
                onClick={() => setSelectedContacts([])}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Сбросить
              </button>
            )}
          </div>

          {/* Contacts list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredContacts.length > 0 ? (
              filteredContacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => toggleContact(contact.contact_user_id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    selectedContacts.includes(contact.contact_user_id)
                      ? "bg-purple-600/20 border-purple-500"
                      : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                  }`}
                >
                  <div className="relative">
                    <Avatar
                      name={contact.contact_display_name || "User"}
                      url={contact.contact_avatar_url}
                      size="md"
                      online={contact.is_online}
                    />
                    {selectedContacts.includes(contact.contact_user_id) && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-slate-100">
                      {contact.custom_name || contact.contact_display_name}
                    </p>
                    <p className="text-xs text-slate-500">@{contact.contact_messenger_id}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Нет доступных контактов</p>
                <p className="text-sm mt-1">Добавьте друзей для создания группы</p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-800/50 rounded-xl text-red-200 text-sm flex items-center gap-2">
              <X className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-medium"
          >
            Отмена
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || selectedContacts.length < 2 || !groupName.trim()}
            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              creating || selectedContacts.length < 2 || !groupName.trim()
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/30"
            }`}
          >
            {creating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Создание...
              </>
            ) : (
              <>
                <Users className="w-5 h-5" />
                Создать группу
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Главный компонент ====================

export function MessengerWeb() {
  const { user, sendJson, lastMessage } = useAuth();
  const [profile, setProfile] = useState<MessengerProfile | null>(null);
  const [profileSetupComplete, setProfileSetupComplete] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentChat, setCurrentChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"chats" | "contacts">("chats");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emojis = ["😀", "😂", "😍", "🥰", "😊", "😎", "🤔", "👍", "❤️", "🔥", "🎉", "👋", "🙏", "💯", "✨", "🚀"];

  // Загрузка данных
  useEffect(() => {
    sendJson({ type: "GetProfile" });
    sendJson({ type: "GetContacts" });
    sendJson({ type: "GetFriendRequests" });
    sendJson({ type: "GetConversations" });
  }, []);

  // Обработка входящих сообщений
  useEffect(() => {
    if (!lastMessage) return;
    let data: any = null;
    try {
      data = JSON.parse(lastMessage);
    } catch {
      return;
    }

    switch (data.type) {
      case "Profile":
        setProfile(data.profile);
        if (data.profile.is_setup_complete) {
          setProfileSetupComplete(true);
        }
        break;
      case "ContactsList":
        setContacts(data.contacts);
        break;
      case "FriendRequestsList":
        setFriendRequests(data.requests);
        break;
      case "ConversationsList":
        setConversations(data.conversations);
        break;
      case "MessagesList":
        setMessages(data.messages.reverse());
        break;
      case "MessageSent":
      case "MessageReceived":
        setMessages(prev => {
          const exists = prev.find(m => m.id === data.message.id);
          return exists ? prev : [...prev, data.message];
        });
        // Обновляем последнее сообщение в списке чатов
        setConversations(prev => prev.map(conv => 
          conv.id === data.message.conversation_id 
            ? { ...conv, last_message: data.message, updated_at: data.message.created_at }
            : conv
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
        break;
      case "FriendRequestSent":
        setNotification({
          type: "success",
          message: `Запрос в друзья отправлен`
        });
        setTimeout(() => setNotification(null), 3000);
        break;
      case "UserTyping":
        if (currentChat && data.conversation_id === currentChat.id) {
          setTypingUsers(prev => new Set(prev).add(data.username));
        }
        break;
      case "UserStoppedTyping":
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(data.username);
          return next;
        });
        break;
      case "Error":
        console.error("Messenger error:", data);
        if (data.code === "setup_error") {
          setSetupError(data.message);
        } else if (data.code === "request_error" || data.code === "send_error") {
          setNotification({
            type: "error",
            message: data.message
          });
          setTimeout(() => setNotification(null), 5000);
        } else {
          setNotification({
            type: "error",
            message: data.message || "Произошла ошибка"
          });
          setTimeout(() => setNotification(null), 5000);
        }
        break;
    }
  }, [lastMessage, currentChat]);

  // Автопрокрутка к новым сообщениям
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Отправка сообщения
  const handleSendMessage = useCallback(() => {
    if (!messageInput.trim() || !currentChat) return;
    
    sendJson({
      type: "SendMessage",
      conversation_id: currentChat.id,
      content: messageInput.trim(),
    });
    setMessageInput("");
    setShowEmojiPicker(false);
  }, [messageInput, currentChat, sendJson]);

  // Индикатор печати
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessageInput(value);

    if (currentChat && value.length > 0) {
      sendJson({ type: "TypingStart", conversation_id: currentChat.id });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        sendJson({ type: "TypingStop", conversation_id: currentChat.id });
      }, 2000);
    }
  };

  // Выбор чата
  const handleSelectChat = (chat: Conversation) => {
    setCurrentChat(chat);
    setMessages([]);
    sendJson({ type: "GetMessages", conversation_id: chat.id, limit: 50 });
    setShowMobileChat(true);
    
    // Отмечаем как прочитанное
    const unreadMessages = messages.filter(m => !m.is_read && m.sender_id !== user?.id);
    if (unreadMessages.length > 0) {
      sendJson({
        type: "MarkAsRead",
        conversation_id: chat.id,
        message_ids: unreadMessages.map(m => m.id),
      });
    }
  };

  // Добавление друга
  const handleAddFriend = (messengerId: string) => {
    sendJson({ type: "SendFriendRequest", receiver_messenger_id: messengerId });
    // Уведомление будет показано в обработчике FriendRequestSent или Error
  };

  // Поиск пользователей используется только в AddContactModal

  // Ответ на запрос в друзья
  const handleRequestRespond = (requestId: string, accept: boolean) => {
    sendJson({ type: "RespondToFriendRequest", request_id: requestId, accept });
  };

  // Удаление контакта
  const handleRemoveContact = (contactUserId: string) => {
    sendJson({ type: "RemoveContact", contact_user_id: contactUserId });
  };

  // Добавление контакта по messenger_id
  const handleAddContact = (messengerId: string) => {
    sendJson({ type: "SendFriendRequest", receiver_messenger_id: messengerId });
    // Уведомление показывается в обработчике FriendRequestSent или Error
  };

  // Создание группового чата
  const handleCreateGroup = (userIds: string[], name: string) => {
    sendJson({
      type: "CreateConversation",
      user_ids: userIds,
      is_group: true,
      name,
    });
    setShowCreateGroup(false);
    setNotification({
      type: "success",
      message: `Группа "${name}" создана`
    });
    setTimeout(() => setNotification(null), 3000);
  };

  // Создание чата с контактом
  const handleCreateChat = (userId: string) => {
    sendJson({
      type: "CreateConversation",
      user_ids: [userId],
      is_group: false,
    });
    setActiveTab("chats");
  };

  // Проверка профиля
  if (!profileSetupComplete && (!profile || !profile.is_setup_complete)) {
    return <SetupProfileScreen error={setupError} onError={setSetupError} />;
  }

  return (
    <div className="h-full flex bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Боковая панель */}
      <div className={`${showMobileChat ? "hidden md:flex" : "flex"} w-full md:w-80 lg:w-96 flex-col border-r border-slate-800/50 backdrop-blur-xl`}>
        {/* Профиль пользователя */}
        <div className="p-4 border-b border-slate-800/50 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <Avatar name={profile?.display_name || "User"} url={profile?.avatar_url} size="md" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-100 truncate">{profile?.display_name}</div>
              <div className="text-xs text-slate-500">@{profile?.messenger_id}</div>
            </div>
            <Button variant="icon" size="icon" onClick={() => setShowSettings(true)}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Поиск */}
        <div className="p-4 border-b border-slate-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e: any) => setSearchQuery(e.target.value)}
              placeholder="Поиск контактов..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex border-b border-slate-800/50">
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex-1 py-3 text-sm font-medium transition-all relative ${
              activeTab === "chats"
                ? "text-blue-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Чаты
            {activeTab === "chats" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex-1 py-3 text-sm font-medium transition-all relative ${
              activeTab === "contacts"
                ? "text-blue-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Контакты
            {activeTab === "contacts" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"></div>
            )}
            {friendRequests.length > 0 && (
              <span className="absolute top-2 right-3 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
          <div className="flex">
            <button
              onClick={() => setShowCreateGroup(true)}
              className="p-3 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-xl transition-all"
              title="Создать группу"
            >
              <Users className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowAddContact(true)}
              className="p-3 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-xl transition-all"
              title="Добавить контакт"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "chats" ? (
            <div className="divide-y divide-slate-800/30">
              {conversations.length > 0 ? (
                conversations.map((conv) => (
                  <ChatItem
                    key={conv.id}
                    conversation={conv}
                    isSelected={currentChat?.id === conv.id}
                    onClick={() => handleSelectChat(conv)}
                  />
                ))
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Нет чатов</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Запросы в друзья */}
              {friendRequests.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Запросы в друзья ({friendRequests.length})
                  </h3>
                  <div className="space-y-2">
                    {friendRequests.map((req) => (
                      <FriendRequestItem
                        key={req.id}
                        request={req}
                        onAccept={(id: string) => handleRequestRespond(id, true)}
                        onDecline={(id: string) => handleRequestRespond(id, false)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Контакты */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Друзья ({contacts.length})
                </h3>
                {contacts.length > 0 ? (
                  <div className="space-y-1">
                    {contacts.map((contact) => (
                      <ContactItem
                        key={contact.id}
                        contact={contact}
                        onSelect={() => {}}
                        onMessage={() => handleCreateChat(contact.contact_user_id)}
                        onRemove={handleRemoveContact}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    Нет контактов
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Окно чата */}
      <div className={`${showMobileChat ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
        {currentChat ? (
          <>
            {/* Заголовок */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="md:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-400"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Avatar
                  name={currentChat.name || currentChat.other_user?.username || "Chat"}
                  url={currentChat.avatar_url}
                  online={!currentChat.is_group && currentChat.other_user?.is_online}
                />
                <div>
                  <h3 className="font-semibold text-slate-100">
                    {currentChat.name || currentChat.other_user?.username}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {typingUsers.size > 0 
                      ? `${Array.from(typingUsers).join(", ")} печатает...`
                      : currentChat.is_group 
                        ? "Групповой чат" 
                        : currentChat.other_user?.is_online 
                          ? "Онлайн" 
                          : "Офлайн"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="icon" size="icon">
                  <Phone className="w-5 h-5" />
                </Button>
                <Button variant="icon" size="icon">
                  <Video className="w-5 h-5" />
                </Button>
                <Button variant="icon" size="icon">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length > 0 ? (
                messages.map((msg, index) => {
                  const isOwn = msg.sender_id === user?.id;
                  const showAvatar = !isOwn && (index === 0 || messages[index - 1]?.sender_id !== msg.sender_id);
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={isOwn}
                      showAvatar={showAvatar}
                    />
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-slate-500">
                    <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium mb-2">Начните общение</p>
                    <p className="text-sm">Отправьте первое сообщение</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Ввод сообщения */}
            <div className="p-4 border-t border-slate-800/50 bg-slate-900/50 backdrop-blur-xl">
              <div className="flex items-end gap-2">
                <Button variant="icon" size="icon" className="hidden sm:flex">
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Button variant="icon" size="icon" className="hidden sm:flex">
                  <ImageIcon className="w-5 h-5" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    value={messageInput}
                    onChange={handleInputChange}
                    onKeyDown={(e: any) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Напишите сообщение..."
                    className="pr-20"
                  />
                  <div className="absolute right-2 bottom-2 flex gap-1">
                    <div className="relative">
                      <Button variant="icon" size="icon" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                        <Smile className="w-5 h-5" />
                      </Button>
                      {showEmojiPicker && (
                        <div className="absolute bottom-full right-0 mb-2 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-xl grid grid-cols-8 gap-1 z-10">
                          {emojis.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => {
                                setMessageInput(prev => prev + emoji);
                                setShowEmojiPicker(false);
                              }}
                              className="w-8 h-8 hover:bg-slate-700 rounded-lg transition-colors text-lg"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="primary"
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim()}
                      className="rounded-xl"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-slate-500">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center">
                <MessageSquare className="w-12 h-12 opacity-50" />
              </div>
              <h2 className="text-2xl font-bold text-slate-300 mb-2">Zerogram</h2>
              <p className="text-slate-500 max-w-md">
                Выберите чат или контакт для начала общения
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно настроек */}
      {showSettings && profile && (
        <ProfileSettings profile={profile} onClose={() => setShowSettings(false)} />
      )}

      {/* Модальное окно добавления контакта */}
      {showAddContact && (
        <AddContactModal
          onClose={() => setShowAddContact(false)}
          onAdd={handleAddContact}
          profile={profile}
        />
      )}

      {/* Модальное окно создания группы */}
      {showCreateGroup && (
        <CreateGroupChatModal
          onClose={() => setShowCreateGroup(false)}
          onCreate={handleCreateGroup}
          contacts={contacts}
          profile={profile}
        />
      )}

      {/* Уведомление */}
      {notification && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-xl z-50 flex items-center gap-3 animate-pulse ${
          notification.type === "success"
            ? "bg-green-600 text-white"
            : "bg-red-600 text-white"
        }`}>
          {notification.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <X className="w-5 h-5" />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}
    </div>
  );
}
