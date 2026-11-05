import type { AdminStackCategory, AdminStackOrder, AdminStackResponse } from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export const stackKey = ["admin", "stack"] as const;

export function useStack() {
  return useQuery({ queryKey: stackKey, queryFn: api.stack, select: (data) => data.categories });
}

/**
 * Any stack write. The server answers with the whole stack, which replaces the cached one, so the
 * page always shows what was saved.
 */
export function useStackMutation<T>(mutationFn: (input: T) => Promise<AdminStackResponse>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => qc.setQueryData(stackKey, data)
  });
}

/** The layout of a stack, as the order route takes it. */
export const layoutOf = (categories: AdminStackCategory[]): AdminStackOrder => ({
  categories: categories.map((c) => ({ id: c.id, technologies: c.technologies.map((t) => t.id) }))
});

/** Optimistic: the new order shows at once and rolls back if the server rejects it. */
export function useReorderStack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categories: AdminStackCategory[]) => api.reorderStack(layoutOf(categories)),
    onMutate: async (categories) => {
      await qc.cancelQueries({ queryKey: stackKey });
      const previous = qc.getQueryData<AdminStackResponse>(stackKey);
      qc.setQueryData<AdminStackResponse>(stackKey, { categories });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) qc.setQueryData(stackKey, context.previous);
    },
    onSuccess: (data) => qc.setQueryData(stackKey, data)
  });
}
