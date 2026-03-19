"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type NavItem = { href: string; label: string };

export default function AppHeader({
  subtitle = "Exploit Network",
  nav = [],
}: {
  subtitle?: string;
  nav?: NavItem[];
}) {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const docsItem = { href: "/docs", label: "Документация" };
  const mergedNav = nav.some((item) => item.href === docsItem.href) ? nav : [...nav, docsItem];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05060a]/65 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3 rounded-xl p-1 hover:bg-white/5">
          <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-cyan-400/20 bg-cyan-500/10">
            <Image src="/zd-logo.svg" alt="Zero Day" fill sizes="40px" className="object-cover" priority />
          </div>
          <div>
            <div className="text-base font-semibold text-zinc-50">Zero Day</div>
            <div className="text-sm text-cyan-200/80">{subtitle}</div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-2 lg:flex">
            {mergedNav.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-base text-zinc-200 hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {status === "authenticated" && session?.user?.name ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/15"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="max-w-[120px] truncate">{session.user.name}</span>
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M5.25 7.75a.75.75 0 0 1 1.06 0L10 11.44l3.69-3.69a.75.75 0 1 1 1.06 1.06l-4.22 4.22a.75.75 0 0 1-1.06 0L5.25 8.81a.75.75 0 0 1 0-1.06Z" />
                </svg>
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#070912]/90 p-1 shadow-[0_12px_36px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                >
                  <Link href="/account" role="menuitem" className="block rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-white/10" onClick={() => setMenuOpen(false)}>
                    Профиль
                  </Link>
                  <Link href="/account?tab=notifications" role="menuitem" className="block rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-white/10" onClick={() => setMenuOpen(false)}>
                    Уведомления
                  </Link>
                  <Link href="/account?tab=settings" role="menuitem" className="block rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-white/10" onClick={() => setMenuOpen(false)}>
                    Настройки
                  </Link>
                  <button
                    role="menuitem"
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-200 hover:bg-red-500/15"
                    onClick={() => {
                      setMenuOpen(false);
                      void signOut({ callbackUrl: "/" });
                    }}
                  >
                    Выйти
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
              aria-label="Войти"
              title="Войти"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d="M15 8V6a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3v-2"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <path
                  d="M10 12h10m0 0-3-3m3 3-3 3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
