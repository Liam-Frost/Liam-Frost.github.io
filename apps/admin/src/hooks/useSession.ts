import type { AdminLoginSecondFactor } from "@liam-frost/shared";
import { hashKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { clearIntegrationDrafts } from "../components/integrations/drafts";
import { clearSettingsDrafts } from "../components/settings/drafts";
import { api } from "../lib/api";

export const sessionKey = ["admin", "session"] as const;

export function useSession() {
  return useQuery({ queryKey: sessionKey, queryFn: api.session, staleTime: 60_000 });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      username,
      password,
      second
    }: {
      username: string;
      password: string;
      second?: AdminLoginSecondFactor;
    }) => api.login(username, password, second),
    onSuccess: (session) => {
      clearIntegrationDrafts();
      clearSettingsDrafts();
      qc.setQueryData(sessionKey, session);
    }
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
      clearIntegrationDrafts();
      clearSettingsDrafts();
      qc.setQueryData(sessionKey, { authenticated: false, configured: true, user: null });
    }
  });
}
