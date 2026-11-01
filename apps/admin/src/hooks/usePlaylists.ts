import type { AdminPlaylist, AdminPlaylistsResponse } from "@liam-frost/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export const playlistsKey = ["admin", "playlists"] as const;

export function usePlaylists() {
  return useQuery({ queryKey: playlistsKey, queryFn: api.playlists, select: (data) => data.playlists });
}

/** Writes a changed playlist into the list cache (or drops a deleted one). */
export function useSetPlaylist() {
  const qc = useQueryClient();
  return (playlist: AdminPlaylist | { id: string; deleted: true }) =>
    qc.setQueryData<AdminPlaylistsResponse>(playlistsKey, (data) => {
      if (!data) return data;
      if ("deleted" in playlist) return { playlists: data.playlists.filter((p) => p.id !== playlist.id) };
      const exists = data.playlists.some((p) => p.id === playlist.id);
      return { playlists: exists ? data.playlists.map((p) => (p.id === playlist.id ? playlist : p)) : [playlist, ...data.playlists] };
    });
}
