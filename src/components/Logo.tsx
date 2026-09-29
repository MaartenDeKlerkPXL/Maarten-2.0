import logoMark from "../assets/logo-mark.svg";

export function LogoMark({ className = "size-9" }: { className?: string }) {
  return <img src={logoMark} alt="" className={className} draggable={false} />;
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-10 place-items-center rounded-2xl border border-line bg-gradient-to-br from-[#16244A] to-[#05070D] shadow-[0_0_24px_-6px_rgb(59_130_246/0.6)]">
        <LogoMark className="size-9" />
      </div>
      <div className="leading-tight">
        <div className="font-display text-[15px] font-bold tracking-tight">Maarten</div>
        <div className="bg-gradient-to-r from-accent-3 to-accent bg-clip-text text-xs font-bold tracking-[0.2em] text-transparent">2.0</div>
      </div>
    </div>
  );
}
