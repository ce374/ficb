"use client";
// Floating toolbar: search, category drawer, random, sort, tracked filter, backup.
// No app name, no nav, no footer — just the controls the grid needs.
import { useEffect, useRef, useState } from "react";
import { Search, Shuffle, Layers, Download, Upload, X, Check } from "lucide-react";
import { useStore, type Sort } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { loadCatalog } from "@/lib/catalog";
import { trackAll, trackClear, trackBulkAdd, subscribe, type TrackedBook } from "@/lib/tracker";
import { exportTrackerZip, importTrackerZip } from "@/lib/zip";
import { toast } from "sonner";

export function Toolbar() {
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const setSort = useStore((s) => s.setSort);
  const setDrawer = useUI((s) => s.setDrawer);
  const showTrackedOnly = useStore((s) => s.showTrackedOnly);
  const setShowTrackedOnly = useStore((s) => s.setShowTrackedOnly);
  const [, force] = useState(0);
  const [count, setCount] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribe(() => force((n) => n + 1)), []);
  useEffect(() => {
    trackAll().then((t) => setCount(t.length));
  }, [showTrackedOnly]);

  const onRandom = () => {
    setSort("random");
    toast("Shuffled the shelf");
  };

  const onExport = async () => {
    const all = await trackAll();
    if (all.length === 0) {
      toast("Nothing tracked yet");
      return;
    }
    const entries = all.map((t: TrackedBook) => ({
      pid: t.pid,
      title: t.title,
      author: t.author,
      year: t.year,
      formats: t.formats,
      addedAt: t.addedAt,
    }));
    const name = prompt("Name this backup:", "fadedpage-track") || "fadedpage-track";
    await exportTrackerZip(entries, name);
    toast.success(`Backed up ${entries.length} books`);
  };

  const onImport = () => importRef.current?.click();
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const entries = await importTrackerZip(f);
      const items: TrackedBook[] = entries.map((x) => ({
        pid: x.pid,
        title: x.title,
        author: x.author,
        year: x.year,
        addedAt: x.addedAt || Date.now(),
        formats: x.formats || [],
      }));
      const added = await trackBulkAdd(items);
      setCount((await trackAll()).length);
      toast.success(`Imported ${added} books (${items.length} in file)`);
    } catch (err) {
      toast.error("Import failed: " + (err as Error).message);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="fp-toolbar">
      <div className="fp-search-wrap">
        <Search size={15} className="fp-search-icon" />
        <input
          className="fp-search"
          placeholder="search title or author…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search books"
        />
        {query && (
          <button className="fp-clear" onClick={() => setQuery("")} aria-label="Clear">
            <X size={13} />
          </button>
        )}
      </div>
      <button className="fp-btn" onClick={() => setDrawer(true)} title="Categories">
        <Layers size={15} />
        <span>Categories</span>
      </button>
      <button className="fp-btn" onClick={onRandom} title="Shuffle">
        <Shuffle size={15} />
        <span>Random</span>
      </button>
      <button
        className={`fp-btn${showTrackedOnly ? " on" : ""}`}
        onClick={() => setShowTrackedOnly(!showTrackedOnly)}
        title="Show only tracked"
      >
        <Check size={15} />
        <span>Tracked{count > 0 ? ` ${count}` : ""}</span>
      </button>
      <button className="fp-btn" onClick={onExport} title="Backup tracked as zip">
        <Download size={15} />
        <span>Backup</span>
      </button>
      <button className="fp-btn" onClick={onImport} title="Import tracked zip">
        <Upload size={15} />
        <span>Import</span>
      </button>
      <input
        ref={importRef}
        type="file"
        accept=".zip,application/zip"
        onChange={onImportFile}
        style={{ display: "none" }}
      />
    </div>
  );
}

export function CategoryDrawer({
  open,
  onClose,
  categories,
  counts,
}: {
  open: boolean;
  onClose: () => void;
  categories: string[];
  counts: Record<string, number>;
}) {
  const category = useStore((s) => s.category);
  const setCategory = useStore((s) => s.setCategory);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const sort = useStore((s) => s.sort);
  const setSort = useStore((s) => s.setSort);

  return (
    <div className={`fp-drawer${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="fp-drawer-panel">
        <div className="fp-drawer-head">
          <span>Categories</span>
          <button onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="fp-drawer-section">
          <div className="fp-drawer-label">Sort</div>
          <div className="fp-chips">
            {(
              [
                ["popular", "Popular"],
                ["title", "Title A→Z"],
                ["year-desc", "Newest"],
                ["year-asc", "Oldest"],
                ["random", "Random"],
              ] as [Sort, string][]
            ).map(([v, lbl]) => (
              <button
                key={v}
                className={`fp-chip${sort === v ? " on" : ""}`}
                onClick={() => setSort(v)}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <div className="fp-drawer-section">
          <div className="fp-drawer-label">Language</div>
          <div className="fp-chips">
            <button
              className={`fp-chip${!lang ? " on" : ""}`}
              onClick={() => setLang(null)}
            >
              any
            </button>
            {[
              ["en", "English"],
              ["fr", "French"],
              ["de", "German"],
              ["eo", "Esperanto"],
            ].map(([c, n]) => (
              <button
                key={c}
                className={`fp-chip${lang === c ? " on" : ""}`}
                onClick={() => setLang(lang === c ? null : c)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="fp-drawer-section fp-drawer-cats">
          <div className="fp-drawer-label">Tags</div>
          <div className="fp-chips">
            <button
              className={`fp-chip${!category ? " on" : ""}`}
              onClick={() => setCategory(null)}
            >
              all
            </button>
            {categories.map((c) => (
              <button
                key={c}
                className={`fp-chip${category === c ? " on" : ""}`}
                onClick={() => setCategory(category === c ? null : c)}
                title={`${counts[c] || 0} books`}
              >
                {c}
                <span className="fp-chip-n">{counts[c] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {open && <div className="fp-drawer-scrim" onClick={onClose} />}
    </div>
  );
}

export function SelectionBar() {
  const selected = useStore((s) => s.selected);
  const clearSelection = useStore((s) => s.clearSelection);
  const setBusy = useUI((s) => s.setBusy);
  const [ext, setExt] = useState(".epub");
  const [zipName, setZipName] = useState("");
  const [mode, setMode] = useState<"none" | "loose" | "zip">("none");

  useEffect(() => {
    if (selected.size === 0) setMode("none");
  }, [selected.size]);

  if (selected.size === 0) return null;
  const pids = [...selected];

  const runLoose = async () => {
    const { books } = await loadCatalog();
    const jobs = pids
      .map((pid) => books.find((b) => b.pid === pid))
      .filter(Boolean)
      .map((b) => ({ book: b!, ext }));
    setBusy(`Downloading ${jobs.length} files…`);
    setMode("none");
    try {
      const { downloadLoose } = await import("@/lib/zip");
      const res = await downloadLoose(jobs);
      toast.success(`${res.ok} downloaded${res.fail ? `, ${res.fail} failed` : ""}`);
      // auto-track all
      const { trackBulkAdd } = await import("@/lib/tracker");
      await trackBulkAdd(
        jobs.map((j) => ({
          pid: j.book.pid,
          title: j.book.t,
          author: j.book.a,
          year: j.book.y,
          addedAt: Date.now(),
          formats: [j.ext],
        }))
      );
      clearSelection();
    } catch (e) {
      toast.error("Download failed: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const runZip = async () => {
    const name = zipName.trim() || "fadedpage-batch";
    const { books } = await loadCatalog();
    const jobs = pids
      .map((pid) => books.find((b) => b.pid === pid))
      .filter(Boolean)
      .map((b) => ({ book: b!, ext }));
    setBusy(`Zipping ${jobs.length} books…`);
    setMode("none");
    try {
      const { downloadZip } = await import("@/lib/zip");
      const res = await downloadZip(jobs, name);
      toast.success(`${res.ok} books zipped as ${name}.zip`);
      const { trackBulkAdd } = await import("@/lib/tracker");
      await trackBulkAdd(
        jobs.map((j) => ({
          pid: j.book.pid,
          title: j.book.t,
          author: j.book.a,
          year: j.book.y,
          addedAt: Date.now(),
          formats: [j.ext],
        }))
      );
      clearSelection();
    } catch (e) {
      toast.error("Zip failed: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fp-selbar">
      <span className="fp-sel-count">{selected.size} selected</span>
      <div className="fp-sel-formats">
        {[".epub", ".mobi", "-a5.pdf", ".txt", ".html"].map((e) => (
          <button
            key={e}
            className={`fp-chip${ext === e ? " on" : ""}`}
            onClick={() => setExt(e)}
          >
            {e === "-a5.pdf" ? "pdf" : e.replace(/^[-.]/, "")}
          </button>
        ))}
      </div>
      {mode === "zip" ? (
        <>
          <input
            className="fp-zipname"
            autoFocus
            placeholder="zip name…"
            value={zipName}
            onChange={(e) => setZipName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runZip()}
          />
          <button className="fp-btn primary" onClick={runZip}>
            Save zip
          </button>
        </>
      ) : (
        <>
          <button className="fp-btn" onClick={runLoose}>
            Loose files
          </button>
          <button className="fp-btn primary" onClick={() => setMode("zip")}>
            As zip…
          </button>
        </>
      )}
      <button className="fp-btn ghost" onClick={clearSelection} aria-label="Cancel">
        <X size={15} />
      </button>
    </div>
  );
}

export function BusyBar() {
  const busy = useUI((s) => s.busy);
  if (!busy) return null;
  return (
    <div className="fp-busy" role="status">
      <span className="fp-spinner" />
      {busy}
    </div>
  );
}
