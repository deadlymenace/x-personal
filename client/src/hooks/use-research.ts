import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";

export function useResearchSearch() {
  return useMutation({
    mutationFn: api.researchSearch,
  });
}

export function useResearchThread() {
  return useMutation({
    mutationFn: api.researchThread,
  });
}

export function useResearchProfile() {
  return useMutation({
    mutationFn: api.researchProfile,
  });
}

export function useBookmarkFromResearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.bookmarkFromResearch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["bookmarkStats"] });
    },
  });
}

export function useWatchlist() {
  return useQuery({
    queryKey: ["watchlist"],
    queryFn: api.getWatchlist,
  });
}

export function useAddToWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.addToWatchlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.removeFromWatchlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

export function useCheckWatchlist() {
  return useMutation({
    mutationFn: api.checkWatchlist,
  });
}
