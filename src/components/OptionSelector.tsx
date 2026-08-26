interface OptionSelectorProps {
  options: { value: string | number; label: string }[];
  value: string | number;
  onChange: (value: string | number) => void;
  layout?: "grid" | "row";
}

export default function OptionSelector({
  options,
  value,
  onChange,
  layout = "grid",
}: OptionSelectorProps) {
  return (
    <div className={layout === "grid" ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "flex flex-wrap gap-2"}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`rounded-xl border px-4 py-3 text-sm font-semibold transition active:scale-[0.97] ${
            value === opt.value
              ? "border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-200"
              : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
