import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { LogoMark } from "../components/Logo";

function translate(msg: string) {
  if (/invalid login/i.test(msg)) return "Onjuist e-mailadres of wachtwoord.";
  if (/database error|registratie is gesloten/i.test(msg)) return "Registratie is gesloten: er bestaat al een account.";
  if (/password should be/i.test(msg)) return "Wachtwoord moet minstens 6 tekens hebben.";
  if (/rate limit/i.test(msg)) return "Te veel pogingen, probeer het zo opnieuw.";
  return msg;
}

export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      setError(translate((err as Error).message));
    }
    setBusy(false);
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 pt-safe pb-safe">
      <div className="pointer-events-none absolute left-1/2 top-1/4 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-[120px]" />
      <div className="relative w-full max-w-sm animate-scale-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 grid size-24 place-items-center rounded-[28px] border border-line bg-gradient-to-br from-[#16244A] to-[#05070D] shadow-[0_0_60px_-10px_rgb(59_130_246/0.7)]">
            <LogoMark className="size-20" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Maarten 2.0</h1>
          <p className="mt-2 text-sm text-muted">Elke dag een beetje beter.</p>
        </div>
        <form onSubmit={submit} className="card space-y-3 p-5">
          <input className="input" type="email" autoComplete="email" placeholder="E-mailadres" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input
            className="input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="Wachtwoord" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
          />
          {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <button className="btn btn-primary w-full py-3 text-[15px]" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "login" ? "Inloggen" : "Account aanmaken"}
          </button>
        </form>
        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }} className="mt-4 w-full text-center text-sm text-muted hover:text-text">
          {mode === "login" ? "Eerste keer? Maak je account aan" : "Heb je al een account? Inloggen"}
        </button>
      </div>
    </div>
  );
}
