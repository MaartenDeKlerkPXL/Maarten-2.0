import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { DOW_SHORT } from "../lib/dates";
import type { Category } from "../lib/types";

export function Ring({
  value, size = 56, stroke = 6, color = "var(--color-accent)", track = "rgb(148 163 184 / 0.12)", children,
}: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.32,0.72,0,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function CheckCircle({
  checked, color = "#3B82F6", onClick, size = "md", label,
}: { checked: boolean; color?: string; onClick?: () => void; size?: "sm" | "md" | "lg"; label?: string }) {
  const dim = size === "lg" ? "size-11" : size === "sm" ? "size-5" : "size-6";
  const icon = size === "lg" ? "size-5" : size === "sm" ? "size-3" : "size-3.5";
  return (
    <button
      type="button"
      aria-label={label ?? (checked ? "Afvinken ongedaan maken" : "Afvinken")}
      aria-pressed={checked}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`${dim} grid shrink-0 place-items-center rounded-full border-2 transition-all duration-200 active:scale-90 ${checked ? "animate-pop" : ""}`}
      style={{
        borderColor: checked ? color : `${color}80`,
        background: checked ? color : "transparent",
        boxShadow: checked ? `0 0 16px -2px ${color}90` : "none",
      }}
    >
      <Check className={`${icon} text-white transition-opacity ${checked ? "opacity-100" : "opacity-0"}`} strokeWidth={3.5} />
    </button>
  );
}

export function CategoryDot({ color, className = "" }: { color: string; className?: string }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${className}`} style={{ background: color, boxShadow: `0 0 8px ${color}80` }} />;
}

export function CategoryPicker({
  categories, value, onChange,
}: { categories: Category[]; value: string | null; onChange: (id: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(active ? null : c.id)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95"
            style={{
              borderColor: active ? c.color : "var(--color-line)",
              background: active ? `${c.color}22` : "var(--color-surface-2)",
              color: active ? "var(--color-text)" : "var(--color-muted)",
            }}
          >
            <CategoryDot color={c.color} />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

export function WeekdayPicker({
  value, onChange, color = "#3B82F6", single,
}: { value: number[]; onChange: (v: number[]) => void; color?: string; single?: boolean }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {DOW_SHORT.map((d, i) => {
        const day = i + 1;
        const active = value.includes(day);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(single ? [day] : active ? value.filter((x) => x !== day) : [...value, day].sort())}
            className="rounded-xl border py-2 text-xs font-semibold uppercase transition active:scale-95"
            style={{
              borderColor: active ? color : "var(--color-line)",
              background: active ? `${color}26` : "var(--color-surface-2)",
              color: active ? "var(--color-text)" : "var(--color-faint)",
            }}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${value === o.value ? "bg-accent/20 text-text shadow ring-1 ring-accent/40" : "text-muted hover:text-text"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-accent" : "bg-surface-3"}`}
    >
      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export function SectionHeader({ title, action, icon }: { title: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="section-title flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function Empty({ icon, title, text }: { icon: ReactNode; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</div>
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-xs text-sm text-muted">{text}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
