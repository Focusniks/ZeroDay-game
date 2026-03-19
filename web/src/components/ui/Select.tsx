"use client";

import { useEffect, useRef, useState } from "react";

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export default function Select({ value, options, onChange, placeholder = "Выбрать", className = "" }: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((item) => item.value === value);

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none transition hover:bg-white/10 focus:border-cyan-400/30"
      >
        <span>{selected?.label ?? placeholder}</span>
        <span className={`text-xs text-zinc-400 transition ${open ? "rotate-180" : ""}`}>v</span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0a0d16]/95 shadow-[0_0_30px_rgba(34,211,238,0.10)] backdrop-blur-xl">
          <div className="max-h-64 overflow-auto p-1">
            {options.map((option) => {
              const isActive = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={[
                    "mb-1 w-full rounded-lg px-3 py-2 text-left text-sm transition last:mb-0",
                    isActive
                      ? "bg-cyan-500/20 text-cyan-100"
                      : "text-zinc-200 hover:bg-white/10",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
