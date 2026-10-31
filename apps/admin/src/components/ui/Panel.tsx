import type { ReactNode } from "react";

/** A titled card section of a form. */
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card space-y-3.5 p-4" aria-label={title}>
      <h2 className="text-[11px] font-bold tracking-[1px] text-brand-secondary">{title}</h2>
      {children}
    </section>
  );
}
