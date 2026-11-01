import type { AdminPeopleResponse, AdminPerson, AdminPersonUpdate } from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export const peopleKey = ["admin", "people"] as const;
export const personKey = (id: string) => ["admin", "people", id] as const;
/** An entry's or person's links; invalidated together with everything under ["admin", "relations"]. */
export const relationsKey = (subject: { type: "media" | "person"; id: string }) =>
  ["admin", "relations", subject.type, subject.id] as const;

export function usePeople() {
  return useQuery({ queryKey: peopleKey, queryFn: api.people, select: (data) => data.people });
}

export function usePerson(id: string) {
  return useQuery({
    queryKey: personKey(id),
    queryFn: () => api.person(id),
    select: (data) => data.person
  });
}

/** Writes a changed person into both the detail and the list cache. */
export function useSetPerson() {
  const qc = useQueryClient();
  return (person: AdminPerson) => {
    qc.setQueryData(personKey(person.id), { person });
    if (!qc.getQueryData(peopleKey)) return;
    qc.setQueryData<AdminPeopleResponse>(peopleKey, (data) => {
      if (!data) return data;
      const exists = data.people.some((p) => p.id === person.id);
      return {
        people: exists
          ? data.people.map((p) => (p.id === person.id ? person : p))
          : [...data.people, person]
      };
    });
  };
}

export function useUpdatePerson(id: string) {
  const setPerson = useSetPerson();
  return useMutation({
    mutationFn: (update: AdminPersonUpdate) => api.updatePerson(id, update),
    onSuccess: ({ person }) => setPerson(person)
  });
}

export function useUploadPersonPhoto(id: string) {
  const setPerson = useSetPerson();
  return useMutation({
    mutationFn: (file: File) => api.uploadPersonPhoto(id, file),
    onSuccess: ({ person }) => setPerson(person)
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePerson(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: personKey(id) });
      qc.setQueryData<AdminPeopleResponse>(
        peopleKey,
        (data) => data && { people: data.people.filter((p) => p.id !== id) }
      );
      // Entries listed this person among their links.
      void qc.invalidateQueries({ queryKey: ["admin", "relations"] });
    }
  });
}
