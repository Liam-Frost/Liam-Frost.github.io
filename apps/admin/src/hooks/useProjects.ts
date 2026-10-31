import type { AdminProject, AdminProjectsResponse, AdminProjectUpdate } from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export const projectsKey = ["admin", "projects"] as const;
export const projectKey = (id: string) => ["admin", "projects", id] as const;

export function useProjects() {
  return useQuery({ queryKey: projectsKey, queryFn: api.projects, select: (data) => data.projects });
}

export function useProject(id: string) {
  return useQuery({ queryKey: projectKey(id), queryFn: () => api.project(id), select: (data) => data.project });
}

/** Writes a changed project into both the detail and the list cache. */
export function useSetProject() {
  const qc = useQueryClient();
  return (project: AdminProject) => {
    qc.setQueryData(projectKey(project.id), { project });
    if (!qc.getQueryData(projectsKey)) return;
    qc.setQueryData<AdminProjectsResponse>(projectsKey, (data) => {
      if (!data) return data;
      const exists = data.projects.some((p) => p.id === project.id);
      return { projects: exists ? data.projects.map((p) => (p.id === project.id ? project : p)) : [project, ...data.projects] };
    });
  };
}

export function useCreateProject() {
  const setProject = useSetProject();
  return useMutation({ mutationFn: api.createProject, onSuccess: ({ project }) => setProject(project) });
}

export function useUpdateProject(id: string) {
  const setProject = useSetProject();
  return useMutation({
    mutationFn: (update: AdminProjectUpdate) => api.updateProject(id, update),
    onSuccess: ({ project }) => setProject(project)
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: projectKey(id) });
      qc.setQueryData<AdminProjectsResponse>(projectsKey, (data) => data && { projects: data.projects.filter((p) => p.id !== id) });
    }
  });
}

/** Optimistic: the new order shows at once and rolls back if the server rejects it. */
export function useReorderProjects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.reorderProjects(ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: projectsKey });
      const previous = qc.getQueryData<AdminProjectsResponse>(projectsKey);
      if (previous) {
        const byId = new Map(previous.projects.map((p) => [p.id, p]));
        qc.setQueryData<AdminProjectsResponse>(projectsKey, { projects: ids.map((id) => byId.get(id)).filter((p): p is AdminProject => Boolean(p)) });
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) qc.setQueryData(projectsKey, context.previous);
    },
    onSuccess: (data) => qc.setQueryData(projectsKey, data)
  });
}

export function useProjectImages(id: string) {
  const setProject = useSetProject();
  const upload = useMutation({
    mutationFn: ({ slot, file }: { slot: "cover" | "gallery"; file: File }) => api.uploadProjectImage(id, slot, file),
    onSuccess: ({ project }) => setProject(project)
  });
  const remove = useMutation({
    mutationFn: (imageId: string) => api.deleteProjectImage(id, imageId),
    onSuccess: ({ project }) => setProject(project)
  });
  return { upload, remove };
}
