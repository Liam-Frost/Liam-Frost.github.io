import { useContext } from "react";

import { QualityContext } from "./QualityProvider";

export function useQuality() {
  const ctx = useContext(QualityContext);
  if (!ctx) throw new Error("useQuality must be used within <QualityProvider>");
  return ctx;
}
