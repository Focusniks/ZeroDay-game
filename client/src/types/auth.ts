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

export type WsMessage =
  | { type: "Register"; username: string; email: string; password: string }
  | { type: "Login"; email: string; password: string }
  | { type: "Authorize"; token: string }
  | { type: "AuthSuccess"; token: string; user: User }
  | { type: "AuthError"; message: string }
  | { type: "Ping" }
  | { type: "Pong" }
  | { type: "Error"; code: string; message: string };

