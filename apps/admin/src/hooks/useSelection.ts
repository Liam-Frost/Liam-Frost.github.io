import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Selection for bulk actions over a list shown in `order`. Shift-click selects the range from the last
 * clicked item; ids that leave the list (filtered out or deleted) drop out of the selection.
 */
export function useSelection(order: string[]) {
  const [active, setActive] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const anchor = useRef<string | null>(null);

  const visible = useMemo(() => new Set(order), [order]);
  const selected = useMemo(() => [...picked].filter((id) => visible.has(id)), [picked, visible]);

  const toggle = useCallback(
    (id: string, range = false) => {
      // Read the anchor now: React runs the updater later, after the anchor has moved to `id`.
      const from = range && anchor.current ? order.indexOf(anchor.current) : -1;
      const anchorId = anchor.current;
      setPicked((current) => {
        const next = new Set(current);
        const to = order.indexOf(id);
        if (from >= 0 && to >= 0) {
          // A range takes the anchor's state: selecting extends, deselecting clears.
          const select = current.has(anchorId!);
          for (const each of order.slice(Math.min(from, to), Math.max(from, to) + 1)) {
            if (select) next.add(each);
            else next.delete(each);
          }
        } else if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      anchor.current = id;
    },
    [order]
  );

  const start = () => setActive(true);
  const stop = () => {
    setActive(false);
    setPicked(new Set());
    anchor.current = null;
  };
  const selectAll = () => setPicked(new Set(order));
  const clear = () => setPicked(new Set());

  return {
    active,
    selected,
    isSelected: (id: string) => picked.has(id),
    toggle,
    start,
    stop,
    selectAll,
    clear
  };
}

export type Selection = ReturnType<typeof useSelection>;
