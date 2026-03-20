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

function AddContactModal({ onClose, onAdd, profile, foundProfileState, setFoundProfileState }: { 
  onClose: () => void; 
  onAdd: (messengerId: string) => void; 
  profile: MessengerProfile | null;
  foundProfileState: MessengerProfile | null;
  setFoundProfileState: (p: MessengerProfile | null) => void;
}) {
  const [messengerId, setMessengerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const { sendJson } = useAuth();

  // Поиск пользователя при вводе
  useEffect(() => {
    const timer = setTimeout(() => {
      if (messengerId.trim().length >= 2) {
        setSearching(true);
        setFoundProfileState(null);
        setError("");
        sendJson({ type: "SearchUsers", query: messengerId.trim() });
      } else {
        setFoundProfileState(null);
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [messengerId, sendJson, setFoundProfileState]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messengerId.trim()) {
      setError("Введите уникальное имя");
      return;
    }

    if (!foundProfileState) {
      setError("Пользователь не найден");
      return;
    }

    if (foundProfileState.user_id === profile?.user_id) {
      setError("Нельзя добавить себя в друзья");
      return;
    }

    setLoading(true);
    setError("");
    onAdd(foundProfileState.messenger_id);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Добавить контакт</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Уникальное имя пользователя
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">@</span>
              <Input
                value={messengerId}
                onChange={(e: any) => {
                  setMessengerId(e.target.value);
                  setFoundProfileState(null);
                }}
                placeholder="username"
                className="pl-8"
                autoFocus
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Введите @username пользователя, которого хотите добавить
            </p>
          </div>

          {/* Найденный профиль */}
          {foundProfileState && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <Avatar name={foundProfileState.display_name} url={foundProfileState.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{foundProfileState.display_name}</p>
                  <p className="text-sm text-slate-400">@{foundProfileState.messenger_id}</p>
                </div>
                <Check className="w-5 h-5 text-green-500" />
              </div>
              {foundProfileState.about && (
                <p className="text-sm text-slate-400 mt-3 pt-3 border-t border-slate-700">
                  {foundProfileState.about}
                </p>
              )}
            </div>
          )}

          {/* Сообщения об ошибках */}
          {error && (
            <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
              error === "Пользователь не найден" 
                ? "bg-blue-900/30 border border-blue-800 text-blue-200"
                : "bg-red-900/40 border border-red-800 text-red-200"
            }`}>
              {error === "Пользователь не найден" ? (
                <Search className="w-4 h-4 flex-shrink-0" />
              ) : (
                <X className="w-4 h-4 flex-shrink-0" />
              )}
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="flex-1" onClick={onClose} type="button">
              Отмена
            </Button>
            <Button 
              variant="primary" 
              className="flex-1" 
              disabled={loading || !foundProfileState} 
              type="submit"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Отправка...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Отправить запрос
                </span>
              )}
            </Button>
          </div>
        </form>
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
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"chats" | "contacts">("chats");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null);
  const [foundProfileState, setFoundProfileState] = useState<MessengerProfile | null>(null);
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
      case "ProfilesList":
        console.log("Search results:", data.profiles);
        // Ищем точное совпадение с текущим запросом
        if (searchQuery && data.profiles.length > 0) {
          const exactMatch = data.profiles.find(
            (p: MessengerProfile) => p.messenger_id.toLowerCase() === searchQuery.toLowerCase()
          );
          if (exactMatch) {
            setFoundProfileState(exactMatch);
          }
        }
        setSearchResults(data.profiles);
        break;
      case "FriendRequestSent":
        console.log("Friend request sent:", data.request);
        setNotification({
          type: "success",
          message: `Запрос в друзья отправлен пользователю @${data.request.receiver_user_id}`
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
  };

  // Поиск пользователей
  const handleSearchUsers = useCallback((query: string) => {
    console.log("Searching for:", query);
    if (query.trim()) {
      sendJson({ type: "SearchUsers", query: query.trim() });
    } else {
      setSearchResults([]);
    }
  }, [sendJson]);

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
    console.log("Adding contact:", messengerId);
    sendJson({ type: "SendFriendRequest", receiver_messenger_id: messengerId });
    setShowAddContact(false);
    // Показываем уведомление
    setNotification({
      type: "success",
      message: `Запрос в друзья отправлен пользователю @${messengerId}`
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
              onChange={(e: any) => {
                setSearchQuery(e.target.value);
                handleSearchUsers(e.target.value);
              }}
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
          <button
            onClick={() => setShowAddContact(true)}
            className="p-3 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-xl transition-all"
            title="Добавить контакт"
          >
            <UserPlus className="w-5 h-5" />
          </button>
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

              {/* Результаты поиска */}
              {searchResults.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Результаты поиска
                  </h3>
                  <div className="space-y-2">
                    {searchResults.map((profile) => (
                      <div key={profile.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Avatar name={profile.display_name} url={profile.avatar_url} size="sm" />
                          <div>
                            <div className="font-medium text-slate-100">{profile.display_name}</div>
                            <div className="text-xs text-slate-500">@{profile.messenger_id}</div>
                          </div>
                        </div>
                        <Button variant="primary" size="sm" onClick={() => handleAddFriend(profile.messenger_id)}>
                          <UserPlus className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
          onClose={() => {
            setShowAddContact(false);
            setFoundProfileState(null);
          }}
          onAdd={handleAddContact}
          profile={profile}
          foundProfileState={foundProfileState}
          setFoundProfileState={setFoundProfileState}
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
