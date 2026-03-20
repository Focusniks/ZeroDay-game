export type User = {
  id: string;
  username: string;
  email: string;
  ip_address: string;
  level: number;
  xp: number;
  reputation: number;
  disk_capacity_mb?: number;
};

export type OtherUserInfo = {
  id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
};

export type LastMessageInfo = {
  id: string;
  content: string;
  sender_id: string;
  sender_username: string;
  created_at: string;
  message_type: string;
};

export type Conversation = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  is_group: boolean;
  created_at: string;
  updated_at: string;
  other_user?: OtherUserInfo;
  last_message?: LastMessageInfo;
  unread_count: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_username: string | null;
  content: string;
  message_type: string;
  media_url: string | null;
  media_metadata: any | null;
  reply_to_id: string | null;
  edited: boolean;
  deleted: boolean;
  created_at: string;
  is_read: boolean;
};

// Messenger Profile & Contacts
export type MessengerProfile = {
  id: string;
  user_id: string;
  messenger_id: string;
  display_name: string;
  avatar_url: string | null;
  about: string | null;
  privacy_settings: any | null;
  is_setup_complete: boolean;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  owner_user_id: string;
  contact_user_id: string;
  status: string;
  custom_name: string | null;
  created_at: string;
  contact_display_name: string | null;
  contact_avatar_url: string | null;
  contact_messenger_id: string | null;
  contact_about: string | null;
  is_online: boolean;
};

export type FriendRequest = {
  id: string;
  sender_user_id: string;
  receiver_user_id: string;
  status: string;
  created_at: string;
  responded_at: string | null;
  sender_display_name: string | null;
  sender_avatar_url: string | null;
  sender_messenger_id: string | null;
};

export type WsMessage =
  // Auth messages
  | { type: "Register"; username: string; email: string; password: string }
  | { type: "Login"; email: string; password: string }
  | { type: "Authorize"; token: string }
  | { type: "AuthSuccess"; token: string; user: User }
  | { type: "AuthError"; message: string }
  // Messenger requests
  | { type: "CreateConversation"; user_ids: string[]; name?: string; is_group: boolean }
  | { type: "GetConversations" }
  | { type: "GetMessages"; conversation_id: string; limit?: number; before?: string }
  | { type: "SendMessage"; conversation_id: string; content: string; message_type?: string; media_url?: string; reply_to_id?: string }
  | { type: "MarkAsRead"; conversation_id: string; message_ids: string[] }
  | { type: "TypingStart"; conversation_id: string }
  | { type: "TypingStop"; conversation_id: string }
  // Profile & Contacts
  | { type: "SetupProfile"; messenger_id: string; display_name: string; about?: string }
  | { type: "GetProfile" }
  | { type: "UpdateProfile"; display_name?: string; avatar_url?: string; about?: string }
  | { type: "SearchUsers"; query: string }
  | { type: "SendFriendRequest"; receiver_messenger_id: string }
  | { type: "GetFriendRequests" }
  | { type: "RespondToFriendRequest"; request_id: string; accept: boolean }
  | { type: "GetContacts" }
  | { type: "RemoveContact"; contact_user_id: string }
  | { type: "BlockContact"; contact_user_id: string }
  // Messenger responses
  | { type: "ConversationCreated"; conversation: Conversation }
  | { type: "ConversationsList"; conversations: Conversation[] }
  | { type: "MessagesList"; messages: Message[]; has_more: boolean }
  | { type: "MessageSent"; message: Message }
  | { type: "MessageReceived"; message: Message }
  | { type: "MessageRead"; message_id: string; user_id: string; read_at: string }
  | { type: "UserTyping"; conversation_id: string; user_id: string; username: string }
  | { type: "UserStoppedTyping"; conversation_id: string; user_id: string }
  // Profile & Contacts responses
  | { type: "Profile"; profile: MessengerProfile }
  | { type: "ProfilesList"; profiles: MessengerProfile[] }
  | { type: "ContactsList"; contacts: Contact[] }
  | { type: "FriendRequestsList"; requests: FriendRequest[] }
  | { type: "FriendRequestSent"; request: FriendRequest }
  | { type: "FriendRequestResponded"; request_id: string; accepted: boolean }
  // Common
  | { type: "Ping" }
  | { type: "Pong" }
  | { type: "Error"; code: string; message: string };

