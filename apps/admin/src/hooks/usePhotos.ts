import type { AdminPhoto, AdminPhotosResponse, AdminPhotoUpdate } from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export const photosKey = ["admin", "photos"] as const;

export function usePhotos() {
  return useQuery({ queryKey: photosKey, queryFn: api.photos, select: (data) => data.photos });
}

/** Writes one changed photo into the cached list. */
export function useSetPhoto() {
  const qc = useQueryClient();
  return (photo: AdminPhoto, { prepend = false } = {}) =>
    qc.setQueryData<AdminPhotosResponse>(photosKey, (data) => {
      if (!data) return data;
      const exists = data.photos.some((p) => p.id === photo.id);
      if (exists) return { photos: data.photos.map((p) => (p.id === photo.id ? photo : p)) };
      return { photos: prepend ? [photo, ...data.photos] : [...data.photos, photo] };
    });
}

export function useUpdatePhoto() {
  const setPhoto = useSetPhoto();
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: AdminPhotoUpdate }) => api.updatePhoto(id, update),
    onSuccess: ({ photo }) => setPhoto(photo)
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePhoto(id),
    onSuccess: (_data, id) =>
      qc.setQueryData<AdminPhotosResponse>(photosKey, (data) => data && { photos: data.photos.filter((p) => p.id !== id) })
  });
}

/** Optimistic: the new order shows at once and rolls back if the server rejects it. */
export function useReorderPhotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.reorderPhotos(ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: photosKey });
      const previous = qc.getQueryData<AdminPhotosResponse>(photosKey);
      if (previous) {
        const byId = new Map(previous.photos.map((p) => [p.id, p]));
        qc.setQueryData<AdminPhotosResponse>(photosKey, { photos: ids.map((id) => byId.get(id)).filter((p): p is AdminPhoto => Boolean(p)) });
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) qc.setQueryData(photosKey, context.previous);
    },
    onSuccess: (data) => qc.setQueryData(photosKey, data)
  });
}
