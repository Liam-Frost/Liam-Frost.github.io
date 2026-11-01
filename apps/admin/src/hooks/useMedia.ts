import type {
  AdminMediaItem,
  AdminMediaListResponse,
  AdminMediaUpdate,
  CollectionSettings
} from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export const mediaKey = ["admin", "media"] as const;
export const mediaItemKey = (id: string) => ["admin", "media", id] as const;
export const collectionSettingsKey = ["admin", "collection-settings"] as const;

export function useMediaList() {
  return useQuery({ queryKey: mediaKey, queryFn: api.media, select: (data) => data.items });
}

export function useMediaItem(id: string) {
  return useQuery({
    queryKey: mediaItemKey(id),
    queryFn: () => api.mediaItem(id),
    select: (data) => data.item
  });
}

/** Writes a changed entry into both the detail and the list cache. */
export function useSetMediaItem() {
  const qc = useQueryClient();
  return (item: AdminMediaItem) => {
    qc.setQueryData(mediaItemKey(item.id), { item });
    if (!qc.getQueryData(mediaKey)) return;
    qc.setQueryData<AdminMediaListResponse>(mediaKey, (data) => {
      if (!data) return data;
      const exists = data.items.some((i) => i.id === item.id);
      return {
        items: exists ? data.items.map((i) => (i.id === item.id ? item : i)) : [item, ...data.items]
      };
    });
  };
}

export function useImportMedia() {
  const setItem = useSetMediaItem();
  return useMutation({ mutationFn: api.importMedia, onSuccess: ({ item }) => setItem(item) });
}

export function useCreateMedia() {
  const setItem = useSetMediaItem();
  return useMutation({ mutationFn: api.createMedia, onSuccess: ({ item }) => setItem(item) });
}

export function useUpdateMedia(id: string) {
  const setItem = useSetMediaItem();
  return useMutation({
    mutationFn: (update: AdminMediaUpdate) => api.updateMedia(id, update),
    onSuccess: ({ item }) => setItem(item)
  });
}

export function useUploadMediaPoster(id: string) {
  const setItem = useSetMediaItem();
  return useMutation({
    mutationFn: (file: File) => api.uploadMediaPoster(id, file),
    onSuccess: ({ item }) => setItem(item)
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMedia(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: mediaItemKey(id) });
      qc.setQueryData<AdminMediaListResponse>(
        mediaKey,
        (data) => data && { items: data.items.filter((i) => i.id !== id) }
      );
    }
  });
}

export function useCollectionSettings() {
  return useQuery({ queryKey: collectionSettingsKey, queryFn: api.collectionSettings });
}

export function useUpdateCollectionSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: CollectionSettings) => api.updateCollectionSettings(settings),
    onSuccess: (data) => qc.setQueryData(collectionSettingsKey, data)
  });
}
