import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { navigate } from "../../lib/router";

export function SubHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-5">
      <button onClick={() => navigate("/meer")} className="-ml-1 mb-2 inline-flex items-center gap-0.5 text-sm font-medium text-accent-2 lg:hidden">
        <ChevronLeft className="size-4" /> Meer
      </button>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
