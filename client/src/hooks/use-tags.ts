import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: api.getTags,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTag,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTag,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useAddTagsToBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      bookmarkId,
      tagIds,
    }: {
      bookmarkId: string;
      tagIds: number[];
    }) => api.addTagsToBookmark(bookmarkId, tagIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });
}

export function useRemoveTagFromBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      bookmarkId,
      tagId,
    }: {
      bookmarkId: string;
      tagId: number;
    }) => api.removeTagFromBookmark(bookmarkId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useSuggestCategories() {
  return useMutation({
    mutationFn: api.suggestCategories,
  });
}

export function useAcceptCategorySuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.acceptCategorySuggestion,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["bookmarkStats"] });
    },
  });
}
