import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  backTo?: string;
  right?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, back = true, backTo, right }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="mb-6 flex items-center gap-3 rounded-3xl border border-white/60 bg-white/72 px-4 py-3 shadow-soft backdrop-blur">
      {back && (
        <button
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-neutral-200/80 bg-white/90 text-neutral-600 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-primary-200 hover:text-primary-700"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold tracking-tight text-neutral-800">{title}</h1>
        {subtitle && <p className="truncate text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
