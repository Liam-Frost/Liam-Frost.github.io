import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

/**
 * One-time instructions in the address from another page, e.g. `?open=add` from 概览: read on
 * arrival, then removed (all in one change, so none comes back) so reloading or going back does not
 * repeat them.
 */
export function useArrivalParams<const N extends string>(...names: N[]) {
  const [params, setParams] = useSearchParams();
  const [values] = useState(
    () =>
      Object.fromEntries(names.map((name) => [name, params.get(name)])) as Record<N, string | null>
  );
  useEffect(() => {
    if (!names.some((name) => params.has(name))) return;
    const next = new URLSearchParams(params);
    for (const name of names) next.delete(name);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on arrival
  }, []);
  return values;
}
