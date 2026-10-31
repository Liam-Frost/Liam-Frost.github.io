import { hashKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export const sessionKey = ["admin", "session"] as const;

export function useSession() {
  return useQuery({ queryKey: sessionKey, queryFn: api.session, staleTime: 60_000 });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) => api.login(username, password),
    onSuccess: (session) => qc.setQueryData(sessionKey, session)
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      // Drop every other cached admin query so nothing from the session survives in memory. The session
      // query itself is updated in place: clear() would detach the mounted observer and the UI would not
      // notice the logout.
      qc.removeQueries({ predicate: (query) => query.queryHash !== hashKey(sessionKey) });
      qc.setQueryData(sessionKey, { authenticated: false, configured: true, user: null });
    }
  });
}
