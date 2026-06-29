import { cn } from "@/lib/utils";

export function ChipSelect({
  options,
  selected,
  onToggle,
  max,
}: {
  options: { value: string; label: string }[] | readonly { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  max?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        const disabled = !active && max !== undefined && selected.length >= max;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(opt.value)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-transparent bg-gradient-primary text-primary-foreground shadow-soft"
                : "border-border bg-background text-foreground hover:border-primary",
              disabled && "cursor-not-allowed opacity-40",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function InterestChips({
  options,
  selected,
  onToggle,
  max,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  max?: number;
}) {
  return (
    <ChipSelect
      options={options.map((o) => ({ value: o, label: o }))}
      selected={selected}
      onToggle={onToggle}
      max={max}
    />
  );
}
