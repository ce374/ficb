"use client";
// Book detail modal: cover, metadata, per-format download buttons, track toggle.
import { useEffect, useState } from "react";
import { useUI } from "@/lib/ui-store";
import { loadCatalog, coverUrl, bookUrl, downloadUrl, FORMATS, type Book } from "@/lib/catalog";
import { trackAdd, trackRemove, trackHas, subscribe } from "@/lib/tracker";
import { toast } from "sonner";

export function BookModal() {
  const openPid = useUI((s) => s.openPid);
  const closeBook = useUI((s) => s.closeBook);
  const [book, setBook] = useState<Book | null>(null);
  const [tracked, setTracked] = useState(false);
  const [, force] = useState(0);

  useEffect(() => subscribe(() => force((n) => n + 1)), []);

  useEffect(() => {
    if (!openPid) {
      setBook(null);
      return;
    }
    let alive = true;
    (async () => {
      const { books } = await loadCatalog();
      const b = books.find((x) => x.pid === openPid) || null;
      if (!alive) return;
      setBook(b);
      if (b) setTracked(await trackHas(b.pid));
    })();
    return () => {
      alive = false;
    };
  }, [openPid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeBook();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeBook]);

  if (!openPid || !book) return null;
  const cover = coverUrl(book);

  const onTrack = async () => {
    if (tracked) {
      await trackRemove(book.pid);
      setTracked(false);
      toast.success("Removed from tracker");
    } else {
      await trackAdd({
        pid: book.pid,
        title: book.t,
        author: book.a,
        year: book.y,
        addedAt: Date.now(),
        formats: [],
      });
      setTracked(true);
      toast.success("Tracked");
    }
  };

  const onDownload = async (ext: string) => {
    const url = downloadUrl(book.pid, ext);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${book.pid}${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      // auto-track on successful download
      if (!(await trackHas(book.pid))) {
        await trackAdd({
          pid: book.pid,
          title: book.t,
          author: book.a,
          year: book.y,
          addedAt: Date.now(),
          formats: [ext],
        });
        setTracked(true);
      }
      toast.success(`Downloaded ${ext.toUpperCase()}`);
    } catch (e) {
      toast.error("Download failed: " + (e as Error).message);
    }
  };

  return (
    <div className="fp-modal-backdrop" onClick={closeBook}>
      <div
        className="fp-modal"
        role="dialog"
        aria-modal="true"
        aria-label={book.t}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="fp-modal-x" onClick={closeBook} aria-label="Close">
          ×
        </button>
        <div className="fp-modal-grid">
          <div className="fp-modal-cover">
            {cover ? (
              <img src={cover} alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="fp-cover-blank fp-modal-blank">
                <span className="fp-cover-blank-title">{book.t}</span>
                <span className="fp-cover-blank-author">{book.a.split(";")[0]}</span>
              </div>
            )}
          </div>
          <div className="fp-modal-body">
            <h2 className="fp-modal-title">{book.t}</h2>
            <div className="fp-modal-author">{book.a || "Unknown"}</div>
            <dl className="fp-meta">
              <div>
                <dt>Year</dt>
                <dd>{book.y || "—"}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>{langName(book.l)}</dd>
              </div>
              <div>
                <dt>Pages</dt>
                <dd>{book.p || "—"}</dd>
              </div>
              <div>
                <dt>Downloads</dt>
                <dd>{book.d.toLocaleString()}</dd>
              </div>
              <div>
                <dt>ID</dt>
                <dd className="fp-mono">{book.pid}</dd>
              </div>
            </dl>
            {book.g.length > 0 && (
              <div className="fp-tags">
                {book.g.map((g) => (
                  <span key={g} className="fp-tag">
                    {g}
                  </span>
                ))}
              </div>
            )}
            <div className="fp-dl-row">
              {FORMATS.map((f) => (
                <button
                  key={f.ext}
                  className="fp-dl-btn"
                  onClick={() => onDownload(f.ext)}
                  title={f.kind}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="fp-modal-actions">
              <button
                className={`fp-track-btn${tracked ? " on" : ""}`}
                onClick={onTrack}
              >
                {tracked ? "✓ Tracked" : "Track"}
              </button>
              <a
                className="fp-source"
                href={bookUrl(book.pid)}
                target="_blank"
                rel="noreferrer"
              >
                source ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function langName(code: string): string {
  const m: Record<string, string> = {
    en: "English",
    fr: "French",
    de: "German",
    eo: "Esperanto",
    es: "Spanish",
    pl: "Polish",
    cy: "Welsh",
    it: "Italian",
    pt: "Portuguese",
    la: "Latin",
    gd: "Scottish Gaelic",
    iw: "Hebrew",
    hu: "Hungarian",
    el: "Greek",
  };
  return m[code] || code || "—";
}
