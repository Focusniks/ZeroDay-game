"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type DialogContextValue = {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

type AlertState = {
  open: boolean;
  title: string;
  message: string;
  resolve?: () => void;
};

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  resolve?: (value: boolean) => void;
};

function DialogShell({
  open,
  title,
  message,
  children,
  onBackdropClose,
}: {
  open: boolean;
  title: string;
  message: string;
  children: ReactNode;
  onBackdropClose?: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onBackdropClose) onBackdropClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#070912]/95 p-5 shadow-[0_0_80px_rgba(34,211,238,0.10)]">
        <div className="text-xs uppercase tracking-widest text-cyan-200/70">System dialog</div>
        <h3 className="mt-2 text-lg font-semibold text-zinc-50">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">{children}</div>
      </div>
    </div>
  );
}

function AlertDialog({
  state,
  onClose,
}: {
  state: AlertState;
  onClose: () => void;
}) {
  return (
    <DialogShell open={state.open} title={state.title} message={state.message} onBackdropClose={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-zinc-950 hover:brightness-110"
      >
        Ок
      </button>
    </DialogShell>
  );
}

function ConfirmDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: ConfirmState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogShell open={state.open} title={state.title} message={state.message} onBackdropClose={onCancel}>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10"
      >
        Отмена
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-zinc-950 hover:brightness-110"
      >
        Подтвердить
      </button>
    </DialogShell>
  );
}

export default function DialogProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    title: "Уведомление",
    message: "",
  });
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: "Подтверждение",
    message: "",
  });

  const alert = useCallback((message: string, title = "Уведомление") => {
    return new Promise<void>((resolve) => {
      setAlertState({
        open: true,
        title,
        message,
        resolve,
      });
    });
  }, []);

  const confirm = useCallback((message: string, title = "Подтверждение") => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        open: true,
        title,
        message,
        resolve,
      });
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertState((prev) => {
      prev.resolve?.();
      return { open: false, title: "Уведомление", message: "" };
    });
  }, []);

  const cancelConfirm = useCallback(() => {
    setConfirmState((prev) => {
      prev.resolve?.(false);
      return { open: false, title: "Подтверждение", message: "" };
    });
  }, []);

  const acceptConfirm = useCallback(() => {
    setConfirmState((prev) => {
      prev.resolve?.(true);
      return { open: false, title: "Подтверждение", message: "" };
    });
  }, []);

  const value = useMemo<DialogContextValue>(() => ({ alert, confirm }), [alert, confirm]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      <AlertDialog state={alertState} onClose={closeAlert} />
      <ConfirmDialog state={confirmState} onCancel={cancelConfirm} onConfirm={acceptConfirm} />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within DialogProvider");
  }
  return context;
}

