// UI-only store: which book modal is open, and the category drawer open state.
import { create } from "zustand";

type UIState = {
  openPid: string | null;
  drawerOpen: boolean;
  busy: string | null; // global busy message, e.g. "Zipping 8 books…"
  openBook: (pid: string) => void;
  closeBook: () => void;
  setDrawer: (v: boolean) => void;
  setBusy: (msg: string | null) => void;
};

export const useUI = create<UIState>((set) => ({
  openPid: null,
  drawerOpen: false,
  busy: null,
  openBook: (pid) => set({ openPid: pid }),
  closeBook: () => set({ openPid: null }),
  setDrawer: (v) => set({ drawerOpen: v }),
  setBusy: (msg) => set({ busy: msg }),
}));
