import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export function RegisterForm() {
  const navigate = useNavigate();
  const { register, wsState } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!USERNAME_REGEX.test(username.trim())) {
      setError("Username must be 3-20 chars: a-z, 0-9, _");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Invalid email format");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Username</label>
        <input
          type="text"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoComplete="username"
          placeholder="neo_hacker"
        />
      </div>

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
          autoComplete="new-password"
          placeholder="minimum 8 chars"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Confirm Password</label>
        <input
          type="password"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="repeat password"
        />
      </div>

      <div className="text-xs text-slate-400">WebSocket: {wsState}</div>
      {error ? <p className="rounded bg-red-900/40 p-2 text-xs text-red-200">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-60"
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>
    </form>
  );
}

