import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-primary-50 to-white text-primary-600 shadow-soft ring-1 ring-primary-100">
        {icon}
      </div>
      <h3 className="mb-1.5 text-lg font-semibold tracking-tight text-neutral-800">{title}</h3>
      <p className="mb-5 max-w-xs text-sm leading-6 text-neutral-500">{description}</p>
      {action}
    </div>
  );
}
