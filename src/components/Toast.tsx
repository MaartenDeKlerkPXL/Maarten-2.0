import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ToastItem {
  id: number;
  text: string;
  tone: "info" | "error";
  action?: { label: string; run: () => void };
}

interface ToastApi {
  show: (text: string, tone?: "info" | "error", action?: ToastItem["action"]) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback<ToastApi["show"]>((text, tone = "info", action) => {
    const id = nextId.current++;
    setItems((list) => [...list.slice(-2), { id, text, tone, action }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), action ? 5000 : 3200);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-md animate-scale-in items-center gap-3 rounded-2xl border border-line-strong bg-surface-3/95 px-4 py-3 text-sm shadow-2xl backdrop-blur-xl"
          >
            {t.tone === "error" ? (
              <AlertCircle className="size-4 shrink-0 text-danger" />
            ) : (
              <CheckCircle2 className="size-4 shrink-0 text-accent-2" />
            )}
            <span className="text-text">{t.text}</span>
            {t.action && (
              <button
                className="ml-1 font-semibold text-accent-2"
                onClick={() => {
                  t.action!.run();
                  setItems((list) => list.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
