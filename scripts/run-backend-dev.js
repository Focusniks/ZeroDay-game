/**
 * Dev helper: on Windows, old zeroday-backend.exe often stays locked → cargo can't overwrite (error 5).
 * Kill the previous instance before `cargo run`.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";

if (isWin) {
  spawnSync("taskkill", ["/F", "/IM", "zeroday-backend.exe"], {
    stdio: "ignore",
    windowsHide: true
  });
}

// Run from `backend/` so `dotenv` loads `backend/.env` (CWD is not repo root).
const backendDir = path.join(root, "backend");
const result = spawnSync("cargo", ["run"], {
  cwd: backendDir,
  stdio: "inherit",
  shell: isWin,
  env: process.env
});

process.exit(result.status === null ? 1 : result.status);
