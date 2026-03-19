"use client";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export default function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
}: CheckboxProps) {
  return (
    <label
      className={[
        "inline-flex select-none items-center gap-2",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={[
          "flex h-5 w-5 items-center justify-center rounded-md border transition",
          checked
            ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-100"
            : "border-white/20 bg-white/5 text-transparent hover:bg-white/10",
        ].join(" ")}
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.4 7.467a1 1 0 0 1-1.419.004l-4-4a1 1 0 1 1 1.414-1.414l3.288 3.288 6.694-6.757a1 1 0 0 1 1.417-.002Z" />
        </svg>
      </button>
      {label ? <span className="text-sm text-zinc-200">{label}</span> : null}
    </label>
  );
}

