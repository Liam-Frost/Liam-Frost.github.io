import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Tone = "success" | "error" | "info";
type ToastItem = { id: number; tone: Tone; message: string };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

const ICON = { success: CircleCheck, error: CircleAlert, info: Info };
const COLOR = {
  success: "text-status-ok",
  error: "text-status-error",
  info: "text-brand-secondary"
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const push = useCallback((message: string, tone: Tone = "success") => {
    const id = ++seq.current;
    setToasts((list) => [...list.slice(-3), { id, tone, message }]);
    window.setTimeout(
      () => setToasts((list) => list.filter((t) => t.id !== id)),
      tone === "error" ? 7000 : 4000
    );
  }, []);

  return (
    <ToastContext value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100%-32px))] flex-col gap-2"
      >
        {toasts.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex items-start gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3 text-[13px] leading-relaxed text-ink shadow-card-hover"
            >
              <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${COLOR[t.tone]}`} />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}
