import { Link, useLocation } from "react-router-dom";

type AuthLayoutProps = {
  children: React.ReactNode;
  /** After first install: only login (no register tab). */
  variant?: "full" | "menu";
};

export function AuthLayout({ children, variant = "full" }: AuthLayoutProps) {
  const location = useLocation();
  const isLogin = location.pathname === "/login";
  const showRegisterTab = variant === "full";

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center gap-8 px-6 py-10">
        <div className="hidden flex-1 rounded-2xl border border-cyan-900/50 bg-slate-950/70 p-8 shadow-2xl md:block">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-cyan-400">ZeroDay Online</p>
          <h1 className="mb-3 text-4xl font-bold leading-tight">
            Join The Underground
            <br />
            Hacker Simulation
          </h1>
          <p className="max-w-md text-sm text-slate-300">
            Build your legend, complete contracts, and survive the digital black market.
            Authenticate to boot into your custom Linux command center.
          </p>
        </div>

        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl">
          {showRegisterTab ? (
            <div className="mb-6 flex rounded-lg bg-slate-900 p-1 text-sm">
              <Link
                to="/login"
                className={`flex-1 rounded-md px-3 py-2 text-center transition ${
                  isLogin ? "bg-slate-200 font-medium text-slate-900" : "text-slate-300 hover:text-white"
                }`}
              >
                Login
              </Link>
              <Link
                to="/register"
                className={`flex-1 rounded-md px-3 py-2 text-center transition ${
                  !isLogin ? "bg-slate-200 font-medium text-slate-900" : "text-slate-300 hover:text-white"
                }`}
              >
                Register
              </Link>
            </div>
          ) : (
            <div className="mb-4 rounded-lg border border-cyan-900/40 bg-slate-900/80 px-3 py-2 text-center text-xs text-cyan-200">
              Online session — sign in with your operative credentials
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

