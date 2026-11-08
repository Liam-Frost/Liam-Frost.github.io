import { useEffect } from "react";
import { tr } from "../lib/messages";
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const click = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey || e.button !== 0) return;
      const link = (e.target as HTMLElement).closest("a[href]");
      if (link?.getAttribute("target") === "_blank") return;
      if (link && !window.confirm(tr("有未保存的修改，确定离开吗？"))) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
}
