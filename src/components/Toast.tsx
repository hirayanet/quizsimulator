import type { ReactNode } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info" | "warning";
}

export function Toast({ message, type = "info" }: ToastProps) {
  const config = {
    success: { icon: CheckCircle2, color: "text-success-600", bg: "bg-success-50", border: "border-success-200" },
    error: { icon: XCircle, color: "text-error-600", bg: "bg-error-50", border: "border-error-200" },
    info: { icon: Info, color: "text-primary-600", bg: "bg-primary-50", border: "border-primary-200" },
    warning: { icon: AlertTriangle, color: "text-warning-600", bg: "bg-warning-50", border: "border-warning-200" },
  };
  const c = config[type];
  const Icon = c.icon;

  return (
    <div className={`flex items-start gap-3 rounded-2xl border ${c.border} ${c.bg} p-4 shadow-soft animate-fade-in`}>
      <Icon size={20} className={`shrink-0 ${c.color}`} />
      <p className="text-sm leading-6 text-neutral-700">{message}</p>
    </div>
  );
}

interface BannerProps {
  children: ReactNode;
  type?: "success" | "error" | "info" | "warning";
}

export function Banner({ children, type = "info" }: BannerProps) {
  const config = {
    success: { bg: "bg-success-50", border: "border-success-200", color: "text-success-700" },
    error: { bg: "bg-error-50", border: "border-error-200", color: "text-error-700" },
    info: { bg: "bg-primary-50", border: "border-primary-200", color: "text-primary-700" },
    warning: { bg: "bg-warning-50", border: "border-warning-200", color: "text-warning-700" },
  };
  const c = config[type];
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} px-4 py-3 text-sm font-medium shadow-soft ${c.color}`}>
      {children}
    </div>
  );
}
