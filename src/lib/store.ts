// Client state: filter, selection, tracker visibility.
// Zustand keeps the virtualized grid lean — components subscribe to slices.
import { create } from "zustand";

type Sort = "popular" | "title" | "year-desc" | "year-asc" | "random";

type State = {
  query: string;
  category: string | null; // active tag, or null
  lang: string | null;
  sort: Sort;
  showTrackedOnly: boolean;
  selected: Set<string>; // pids in selection mode
  selectionMode: boolean;
  setQuery: (q: string) => void;
  setCategory: (c: string | null) => void;
  setLang: (l: string | null) => void;
  setSort: (s: Sort) => void;
  setShowTrackedOnly: (v: boolean) => void;
  toggleSelect: (pid: string) => void;
  selectMany: (pids: string[]) => void;
  clearSelection: () => void;
  startSelection: (pid: string) => void;
};

export const useStore = create<State>((set) => ({
  query: "",
  category: null,
  lang: null,
  sort: "popular",
  showTrackedOnly: false,
  selected: new Set(),
  selectionMode: false,
  setQuery: (q) => set({ query: q }),
  setCategory: (c) => set({ category: c }),
  setLang: (l) => set({ lang: l }),
  setSort: (s) => set({ sort: s }),
  setShowTrackedOnly: (v) => set({ showTrackedOnly: v }),
  toggleSelect: (pid) =>
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return { selected: next, selectionMode: next.size > 0 };
    }),
  selectMany: (pids) =>
    set((s) => {
      const next = new Set(s.selected);
      for (const p of pids) next.add(p);
      return { selected: next, selectionMode: next.size > 0 };
    }),
  clearSelection: () => set({ selected: new Set(), selectionMode: false }),
  startSelection: (pid) =>
    set((s) => {
      const next = new Set(s.selected);
      next.add(pid);
      return { selected: next, selectionMode: true };
    }),
}));

export type { Sort };
