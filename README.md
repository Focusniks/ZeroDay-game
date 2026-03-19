# ZeroDay — Stage 1 (Authentication via WebSocket)

Two separate projects:
- `backend/`: Rust (Actix-web) + PostgreSQL (SQLx) + JWT/bcrypt + WebSocket server (tokio-tungstenite)
- `client/`: Tauri v2 desktop app (React 18 + TypeScript + Vite + TailwindCSS) with WebSocket connection to backend

## Requirements

### Backend
- Rust stable
- PostgreSQL (remote or local)
- (Optional) `sqlx-cli` for manual migrations:
  - `cargo install sqlx-cli --no-default-features --features postgres`

### Client
- Node.js 18+ (recommended)
- Rust toolchain (Tauri uses Rust)
- Tauri prerequisites for Windows (WebView2 is typically already present on Win10/11)

## Backend setup & run

1) Create a PostgreSQL database (example):

```sql
CREATE DATABASE zeroday;
```

2) Configure env:
- Edit `backend/.env`:
  - `DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/zeroday`
  - `JWT_SECRET=...`
  - `WS_HOST=127.0.0.1`
  - `WS_PORT=8080`

3) Run backend:

```bash
cd backend
cargo run
```

Backend will:
- Connect to PostgreSQL
- Run migrations from `backend/migrations`
- Start HTTP on `HTTP_HOST:HTTP_PORT` (defaults to `127.0.0.1:8000`)
- Start WebSocket on `WS_HOST:WS_PORT` (defaults to `127.0.0.1:8080`)

### Backend endpoints and WS auth
- `GET /health` → `{ "ok": true }`
- `WS ws://127.0.0.1:8080`:
  - Register request:
    - `{"type":"Register","username":"neo_1","email":"neo@mail.com","password":"password123"}`
  - Login request:
    - `{"type":"Login","email":"neo@mail.com","password":"password123"}`
  - Success response:
    - `{"type":"AuthSuccess","token":"...","user":{...}}`
  - Error response:
    - `{"type":"AuthError","message":"..."}`

## Client setup & run (Tauri)

1) Configure WebSocket URL:
- Edit `client/.env`:
  - `VITE_WS_URL=ws://127.0.0.1:8080`

2) Install deps and run:

```bash
cd client
npm install
npm run tauri:dev
```

### One command: backend + desktop client

`npm run tauri:dev` **does not** start the Rust backend. From the **repo root**:

```bash
npm install
npm run dev
```

This runs `cargo run` in `backend/` and `npm run tauri:dev` in `client/` together (via `concurrently`).

#### Windows: `failed to remove ... zeroday-backend.exe` / «Отказано в доступе» (os error 5)

Usually the **previous** `zeroday-backend.exe` is still running, so Cargo cannot overwrite the file. The root script `npm run dev` tries to `taskkill` it first on Windows.

If it still happens: close the old terminal / stop the process in Task Manager, or run:

`taskkill /F /IM zeroday-backend.exe`

Rarely: antivirus locks the `.exe` — add an exclusion for `zeroday/backend/target` or the project folder.

### First run vs returning player

- **First launch** (no config file): the game runs a **graphical Linux-style installer** at `/install` (welcome → keyboard → timezone → disk → account) with a **long file-copy phase**; **WebSocket URL is not shown** there — use `client/.env` (`VITE_WS_URL`) / `zeroday_game.json` (`wsUrl`) for server address. Registration happens as “create administrator account”.
- **Next launches**: after a short loading screen, you go to **main menu** `/login` only (registration is not in the menu).
- **Config file** (next to the game executable): `zeroday_game.json`  
  See `zeroday_game.example.json` in the repo for fields (`setupComplete`, `wsUrl`, `lastLoginEmailHint`, …).

The client has:
- `/install` — first-run OS installation wizard + registration
- `/login` — main menu login (returning players)
- `/register` — redirects to `/install` or `/login`
- protected `/dashboard` route
- token persistence in `localStorage`
- game-like loading screen before launcher and system boot
- Linux-like dashboard after successful auth

## Expected result

- `cd backend && cargo run` → server works, WS listens on `:8080`
- `cd client && npm install && npm run tauri:dev` → desktop app runs (backend must be running separately unless you use root `npm run dev`)
- From repo root: `npm run dev` → **backend + Tauri** together
- WebSocket connection is established for login / install registration

