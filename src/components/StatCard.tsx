import type { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  color?: string;
}

export default function StatCard({ icon, label, value, color = "primary" }: StatCardProps) {
  const colorMap: Record<string, string> = {
    primary: "from-primary-500/18 to-primary-50 text-primary-700 ring-primary-100",
    accent: "from-accent-500/18 to-accent-50 text-accent-700 ring-accent-100",
    success: "from-success-500/18 to-success-50 text-success-700 ring-success-100",
    warning: "from-warning-500/18 to-warning-50 text-warning-700 ring-warning-100",
    error: "from-error-500/18 to-error-50 text-error-700 ring-error-100",
  };

  return (
    <div className="card card-hover relative overflow-hidden p-4">
      <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-primary-100/40 blur-2xl" />
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-3xl font-bold tracking-tight text-neutral-800">{value}</p>
      <p className="mt-1 text-xs font-medium text-neutral-500">{label}</p>
    </div>
  );
}
