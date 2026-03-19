import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel
}: Props) {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55">
      <div className="w-[420px] max-w-[92vw] rounded-xl border border-white/10 bg-[#0d1117] p-4 shadow-2xl">
        <div className="mb-2 text-sm font-bold text-slate-100">{title}</div>
        <div className="mb-4 text-sm text-slate-200">{message}</div>

        <div className="flex justify-end gap-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200 hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-3 py-1 text-sm font-semibold ${
              danger
                ? "bg-red-500/20 text-red-100 hover:bg-red-500/30 border border-red-500/35"
                : "bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30 border border-cyan-500/35"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

