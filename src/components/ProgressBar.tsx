interface ProgressBarProps {
  value: number;
  max: number;
  color?: "primary" | "success" | "warning";
}

export default function ProgressBar({ value, max, color = "primary" }: ProgressBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const colorMap = {
    primary: "from-primary-500 via-primary-400 to-accent-400",
    success: "from-success-500 to-success-400",
    warning: "from-warning-500 to-warning-400",
  };

  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200/80">
      <div
        className={`progress-fill h-full rounded-full bg-gradient-to-r ${colorMap[color]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
