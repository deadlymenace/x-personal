import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";

export function useBookmarks(params: Record<string, string>) {
  return useQuery({
    queryKey: ["bookmarks", params],
    queryFn: () => api.getBookmarks(params),
  });
}

export function useBookmarkStats() {
  return useQuery({
    queryKey: ["bookmarkStats"],
    queryFn: api.getBookmarkStats,
  });
}

export function useSyncBookmarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.syncBookmarks,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["bookmarkStats"] });
    },
  });
}

export function useUpdateBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.Bookmark> }) =>
      api.updateBookmark(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
}

export function useDeleteBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteBookmark,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["bookmarkStats"] });
    },
  });
}

export function useImportBookmarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.importBookmarks,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["bookmarkStats"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useBulkDeleteBookmarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.bulkDeleteBookmarks,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["bookmarkStats"] });
    },
  });
}

export function useBulkTagBookmarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, tagIds }: { ids: string[]; tagIds: number[] }) =>
      api.bulkTagBookmarks(ids, tagIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
}
