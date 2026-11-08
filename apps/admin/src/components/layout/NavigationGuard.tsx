import { useBlocker } from "react-router";

import { tr } from "../../lib/messages";
import { navigationGuardSkipped, useHasPageUnsaved } from "../../lib/unsaved";
import { ConfirmDialog } from "../ui/Confirm";

/**
 * Stops leaving a page whose unsaved work would be lost, however the navigation started: a link, a
 * selector, code or the browser's back button. Drafts that survive moving around the admin do not ask.
 */
export function NavigationGuard() {
  const unsaved = useHasPageUnsaved();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      unsaved && !navigationGuardSkipped() && currentLocation.pathname !== nextLocation.pathname
  );
  return (
    <ConfirmDialog
      open={blocker.state === "blocked"}
      options={{
        title: tr("离开此页？"),
        message: tr("这里有未保存的内容，离开后不会保留。"),
        confirmLabel: tr("离开"),
        cancelLabel: tr("继续编辑")
      }}
      onAnswer={(leave) => (leave ? blocker.proceed?.() : blocker.reset?.())}
    />
  );
}
