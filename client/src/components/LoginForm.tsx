import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useGameConfig } from "../hooks/useGameConfig";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const navigate = useNavigate();
  const { login, wsState } = useAuth();
  const { config, patchConfig } = useGameConfig();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hint = config.lastLoginEmailHint?.trim();
    if (hint) {
      setEmail((prev) => (prev ? prev : hint));
    }
  }, [config.lastLoginEmailHint]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Invalid email format");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      await patchConfig({ lastLoginEmailHint: email.trim() });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Email</label>
        <input
          type="email"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@zeroday.net"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Password</label>
        <input
          type="password"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="********"
        />
      </div>

      <div className="text-xs text-slate-400">WebSocket: {wsState}</div>
      {error ? <p className="rounded bg-red-900/40 p-2 text-xs text-red-200">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-60"
      >
        {loading ? "Authenticating..." : "Login"}
      </button>
    </form>
  );
}

