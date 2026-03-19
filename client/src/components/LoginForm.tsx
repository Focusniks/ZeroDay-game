import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useGameConfig } from "../hooks/useGameConfig";
import { useI18n } from "../hooks/useI18n";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export function LoginForm() {
  const navigate = useNavigate();
  const { login, wsState } = useAuth();
  const { config, patchConfig } = useGameConfig();
  const { lang, t } = useI18n();

  const connHint =
    wsState === "connecting"
      ? t.connConnecting
      : wsState === "open"
        ? t.connOpen
        : wsState === "closed"
          ? t.connClosed
          : t.connError;

  const hint = config.lastLoginEmailHint?.trim();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editIdentifier, setEditIdentifier] = useState(false);

  const exitApp = () => {
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().destroy();
      } catch {
        window.close();
      }
    })();
  };

  useEffect(() => {
    if (hint) {
      setIdentifier((prev) => (prev ? prev : hint));
      setEditIdentifier(false);
    }
  }, [config.lastLoginEmailHint]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const id = identifier.trim();
    const looksEmail = id.includes("@");
    if (looksEmail && !EMAIL_REGEX.test(id)) {
      setError(t.loginErrEmail);
      return;
    }
    if (!looksEmail && !USERNAME_REGEX.test(id)) {
      setError(t.loginErrEmail);
      return;
    }
    if (password.length < 8) {
      setError(t.loginErrPassword);
      return;
    }

    setLoading(true);
    try {
      await login(id, password);
      await patchConfig({ lastLoginEmailHint: id });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loginErrGeneric);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1220]/70 p-6 shadow-2xl shadow-black/40 backdrop-blur-md relative">
      <div className="absolute right-3 top-3">
        <button
          type="button"
          onClick={exitApp}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
        >
          {lang === "ru" ? "Выход" : "Exit"}
        </button>
      </div>
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl shadow-inner">
          {(identifier || "U")[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">ZeroDay Login</div>
          <div className="truncate text-lg font-semibold text-white">
            {hint && !editIdentifier ? identifier : identifier ? identifier : "Select user"}
          </div>
          {hint && !editIdentifier ? (
            <button
              type="button"
              onClick={() => setEditIdentifier(true)}
              className="mt-1 text-xs font-medium text-cyan-300/90 hover:text-cyan-200"
            >
              Change user
            </button>
          ) : null}
        </div>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        {editIdentifier ? (
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">{t.loginEmail}</label>
            <input
              type="text"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-500"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              placeholder="username or you@example.com"
            />
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">{t.loginPassword}</label>
          <input
            type="password"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="********"
          />
        </div>

        <div className="text-xs text-slate-400">
          {connHint}
        </div>
        {error ? <p className="rounded bg-red-900/40 p-2 text-xs text-red-200">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-60"
        >
          {loading ? t.loginSubmitLoading : t.loginSubmit}
        </button>
      </form>
    </div>
  );
}

