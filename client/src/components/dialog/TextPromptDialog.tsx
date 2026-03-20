import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playDialogInfo } from "../../lib/osSounds";

type Props = {
  open: boolean;
  title: string;
  defaultValue?: string;
  placeholder?: string;
  okLabel?: string;
  cancelLabel?: string;
  inputKind?: "text" | "password";
  onSubmit: (value: string | null) => void;
};

export function TextPromptDialog({
  open,
  title,
  defaultValue = "",
  placeholder,
  okLabel = "OK",
  cancelLabel = "Cancel",
  inputKind = "text",
  onSubmit
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
    playDialogInfo();
    // Let DOM paint first.
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, defaultValue]);

  const trimmedOk = useMemo(() => value.trim(), [value]);

  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/55"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        className="w-[460px] max-w-[92vw] rounded-xl border border-white/10 bg-[#0d1117] p-4 shadow-2xl"
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="mb-3 text-sm font-bold text-slate-100">{title}</div>
        <input
          ref={inputRef}
          type={inputKind}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit(trimmedOk.length ? value : null);
            if (e.key === "Escape") onSubmit(null);
          }}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onSubmit(null)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200 hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(trimmedOk.length ? value : null)}
            className="rounded-lg bg-cyan-500/20 px-3 py-1 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/30 border border-cyan-500/35"
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(node, document.body) : node;
}

