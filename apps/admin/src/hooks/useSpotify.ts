import type { AdminSpotifyResponse, SpotifySettings } from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export const spotifyKey = ["admin", "spotify"] as const;

export function useSpotify() {
  return useQuery({ queryKey: spotifyKey, queryFn: api.spotify });
}

export function useUpdateSpotify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: SpotifySettings) => api.updateSpotify(settings),
    onSuccess: (data) => qc.setQueryData<AdminSpotifyResponse>(spotifyKey, data)
  });
}

export function useSyncSpotify() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.syncSpotify, onSuccess: (data) => qc.setQueryData<AdminSpotifyResponse>(spotifyKey, data) });
}
