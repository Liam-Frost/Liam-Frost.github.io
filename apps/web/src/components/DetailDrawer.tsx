import { useEffect, useRef, type ReactNode } from "react";

import { useI18n } from "../lib/i18n";
import { useScrollLock } from "../lib/useScrollLock";

/**
 * Side panel for one entry or person. Esc, the backdrop and the close button call onClose; Tab stays
 * inside the panel while the page behind is covered and scroll-locked.
 */
export default function DetailDrawer({
  id,
  labelledBy,
  onClose,
  children
}: {
  id: string;
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useScrollLock(true);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusable = [
          ...panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")
        ];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !panelRef.current.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // A link inside the panel opens another entry or person in the same panel: start it at the top.
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [id]);

  return (
    <div
      className="backdrop mediaDrawerBackdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        ref={panelRef}
        className="card mediaDrawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <div className="mediaDrawerTop">
          <button ref={closeRef} className="btn btnGhost btnSmall" type="button" onClick={onClose}>
            {t("collection.close")}
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
