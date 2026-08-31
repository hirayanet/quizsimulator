import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react";
import { createPortal } from "react-dom";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type: ToastType, duration?: number) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const config = {
  success: { icon: CheckCircle2, color: "text-success-600", bg: "bg-success-50", border: "border-success-200" },
  error: { icon: XCircle, color: "text-error-600", bg: "bg-error-50", border: "border-error-200" },
  info: { icon: Info, color: "text-primary-600", bg: "bg-primary-50", border: "border-primary-200" },
  warning: { icon: AlertTriangle, color: "text-warning-600", bg: "bg-warning-50", border: "border-warning-200" },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const c = config[toast.type];
  const Icon = c.icon;

  return (
    <div className={`flex items-start gap-3 rounded-2xl border ${c.border} ${c.bg} p-4 shadow-xl animate-fade-in min-w-[280px] max-w-[400px]`}>
      <Icon size={20} className={`shrink-0 ${c.color}`} />
      <p className="text-sm leading-6 text-neutral-700 flex-1">{toast.message}</p>
      <button
        onClick={onClose}
        className="shrink-0 text-neutral-400 hover:text-neutral-600 transition p-1 -mt-1 -mr-1"
        aria-label="Tutup notifikasi"
      >
        <XCircle size={16} />
      </button>
    </div>
  );
}

function ToastContainer() {
  const { toasts, hideToast } = useToast();

  if (toasts.length === 0) return null;

  const toastElements = toasts.map((toast) => (
    <ToastItem key={toast.id} toast={toast} onClose={() => hideToast(toast.id)} />
  ));

  // Mobile: top, Desktop: bottom-right
  return createPortal(
    <div className="fixed left-4 right-4 top-4 lg:top-auto lg:bottom-4 lg:left-auto lg:right-4 lg:w-[360px] flex flex-col gap-2 z-[100] lg:items-end lg:pointer-events-none">
      {toastElements}
    </div>,
    document.body
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType, duration = 4000) => {
    const id = Math.random().toString(36).slice(2, 9);
    const newToast: Toast = { id, message, type, duration };
    
    setToasts((prev) => [...prev, newToast]);
    
    if (duration > 0) {
      setTimeout(() => {
        hideToast(id);
      }, duration);
    }
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

// Convenience hooks
export function useToastHelpers() {
  const { showToast } = useToast();
  
  return {
    toastSuccess: (msg: string, dur?: number) => showToast(msg, "success", dur),
    toastError: (msg: string, dur?: number) => showToast(msg, "error", dur),
    toastInfo: (msg: string, dur?: number) => showToast(msg, "info", dur),
    toastWarning: (msg: string, dur?: number) => showToast(msg, "warning", dur),
  };
}