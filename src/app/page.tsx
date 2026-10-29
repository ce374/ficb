"use client";
// Single-page app: virtualized ink grid of the Faded Page catalogue.
// No name, no nav, no footer — just covers, controls, and the grid.
import { useEffect, useMemo, useState } from "react";
import { loadCatalog, type Book } from "@/lib/catalog";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { CoverGrid } from "@/components/cover-grid";
import { BookModal } from "@/components/book-modal";
import { Toolbar, CategoryDrawer, SelectionBar, BusyBar } from "@/components/toolbar";
import { trackAll, subscribe } from "@/lib/tracker";
import { Toaster } from "sonner";

export default function Page() {
  const [data, setData] = useState<{ books: Book[]; categories: string[] } | null>(null);
  const [trackedPids, setTrackedPids] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  const query = useStore((s) => s.query);
  const category = useStore((s) => s.category);
  const lang = useStore((s) => s.lang);
  const sort = useStore((s) => s.sort);
  const showTrackedOnly = useStore((s) => s.showTrackedOnly);
  const drawerOpen = useUI((s) => s.drawerOpen);

  // initial load
  useEffect(() => {
    let alive = true;
    loadCatalog()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  // refresh tracked-pids set whenever the tracker store changes.
  // setState happens inside async .then / subscription callbacks, never
  // synchronously in the effect body (keeps React happy & cascade-free).
  useEffect(() => {
    let cancelled = false;
    const pull = () =>
      trackAll().then((all) => {
        if (!cancelled) setTrackedPids(new Set(all.map((t) => t.pid)));
      });
    pull();
    return subscribe(pull);
  }, []);

  // category counts for the drawer (over ALL books, not filtered)
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    if (data) for (const b of data.books) for (const g of b.g) m[g] = (m[g] || 0) + 1;
    return m;
  }, [data]);

  // filter + sort (memoized). Runs in ~1-3ms for 9k books — instant.
  const view = useMemo(() => {
    if (!data) return [] as Book[];
    const q = query.trim().toLowerCase();
    const qs = q ? q.split(/\s+/).filter(Boolean) : [];
    let out = data.books.filter((b) => {
      if (category && !b.g.includes(category)) return false;
      if (lang && b.l !== lang) return false;
      if (showTrackedOnly && !trackedPids.has(b.pid)) return false;
      if (qs.length) {
        const hay = (b.t + " " + b.a).toLowerCase();
        for (const w of qs) if (!hay.includes(w)) return false;
      }
      return true;
    });
    out = sortInPlace(out, sort);
    return out;
  }, [data, query, category, lang, sort, showTrackedOnly, trackedPids]);

  if (err) {
    return (
      <div className="fp-error">
        <p>Failed to load the catalogue.</p>
        <code>{err}</code>
      </div>
    );
  }

  return (
    <div className="fp-root">
      <Toolbar />
      <main className="fp-main">
        {data ? (
          view.length ? (
            <CoverGrid books={view} />
          ) : (
            <div className="fp-empty">
              <p>No books match.</p>
              <button
                className="fp-btn"
                onClick={() => {
                  useStore.getState().setQuery("");
                  useStore.getState().setCategory(null);
                  useStore.getState().setLang(null);
                  useStore.getState().setShowTrackedOnly(false);
                }}
              >
                Reset
              </button>
            </div>
          )
        ) : (
          <div className="fp-loading">
            <span className="fp-spinner" />
            loading the shelf…
          </div>
        )}
      </main>
      <CategoryDrawer
        open={drawerOpen}
        onClose={() => useUI.getState().setDrawer(false)}
        categories={data?.categories || []}
        counts={counts}
      />
      <BookModal />
      <SelectionBar />
      <BusyBar />
      <Toaster position="bottom-center" toastOptions={{ className: "fp-toast" }} />
    </div>
  );
}

function sortInPlace(arr: Book[], sort: string): Book[] {
  switch (sort) {
    case "title":
      return arr.sort((a, b) => a.t.localeCompare(b.t));
    case "year-asc":
      return arr.sort((a, b) => (a.y || 9999) - (b.y || 9999));
    case "year-desc":
      return arr.sort((a, b) => (b.y || 0) - (a.y || 0));
    case "random":
      return shuffle(arr);
    case "popular":
    default:
      return arr.sort((a, b) => b.d - a.d);
  }
}

// Fisher–Yates, returns a new array (keeps memo stable)
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
