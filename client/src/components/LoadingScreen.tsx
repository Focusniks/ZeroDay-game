export function LoadingScreen({
  title,
  subtitle
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background:
          "radial-gradient(ellipse at 30% 20%, rgba(45,212,191,0.15), transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(99,102,241,0.12), transparent 45%), #0c1018"
      }}
    >
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-white/10 bg-[#1a1d24]/95 p-10 shadow-2xl shadow-black/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-600 text-xl font-black text-white shadow-lg">
            Z
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/5 animate-pulse rounded-full bg-gradient-to-r from-teal-500 to-cyan-400" />
          </div>
          <p className="text-center text-[11px] text-slate-500">ZeroDay OS</p>
        </div>
      </div>
    </div>
  );
}
