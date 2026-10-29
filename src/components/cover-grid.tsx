"use client";
// Virtualized cover grid — renders only the visible window of covers.
// Custom windowing (no heavy dep). Scrolls like silk over 9k books.
import { useLayoutEffect, useRef, useState } from "react";
import type { Book } from "@/lib/catalog";
import { coverUrl } from "@/lib/catalog";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";

const GAP = 8;
const MIN_COL = 88; // px; covers shrink-to-fit below this column count

export function CoverGrid({ books }: { books: Book[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setWidth(el.clientWidth);
      setViewportH(el.clientHeight);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const cols = Math.max(1, Math.floor((width - GAP) / (MIN_COL + GAP)));
  const colW = width > 0 ? (width - GAP * (cols + 1)) / cols : MIN_COL;
  const coverH = Math.round(colW * 1.5); // 2:3
  const rowH = coverH + 32 + GAP;

  const totalRows = Math.ceil(books.length / cols);
  const totalH = totalRows * rowH + GAP;

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setScrollTop(el.scrollTop);
  };

  const overscan = 4;
  const startRow = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
  const endRow = Math.min(
    totalRows,
    Math.ceil((scrollTop + viewportH) / rowH) + overscan
  );
  const startIdx = startRow * cols;
  const endIdx = Math.min(books.length, endRow * cols);
  const visible = books.slice(startIdx, endIdx);

  return (
    <div
      ref={scrollRef}
      className="fp-scroll"
      onScroll={onScroll}
      style={{ position: "relative", height: "100%", overflowY: "auto" }}
    >
      <div style={{ position: "relative", height: totalH, minWidth: 0 }}>
        <div
          style={{
            position: "absolute",
            top: startRow * rowH,
            left: 0,
            right: 0,
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: GAP,
            padding: `0 ${GAP}px`,
          }}
        >
          {visible.map((b) => (
            <CoverCell key={b.pid} book={b} coverH={coverH} colW={colW} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CoverCell({
  book,
  coverH,
  colW,
}: {
  book: Book;
  coverH: number;
  colW: number;
}) {
  const selectionMode = useStore((s) => s.selectionMode);
  const selected = useStore((s) => s.selected.has(book.pid));
  const toggleSelect = useStore((s) => s.toggleSelect);
  const startSelection = useStore((s) => s.startSelection);
  const openBook = useUI((s) => s.openBook);
  const [imgOk, setImgOk] = useState(true);
  const cover = coverUrl(book);
  const showImg = cover && imgOk;

  const pressTimer = useRef<number | null>(null);
  const pressMoved = useRef(false);
  const onTouchStart = () => {
    pressMoved.current = false;
    pressTimer.current = window.setTimeout(() => {
      startSelection(book.pid);
      if (navigator.vibrate) navigator.vibrate(15);
    }, 450);
  };
  const onTouchEnd = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  };
  const onTouchMove = () => {
    pressMoved.current = true;
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  };

  const onClick = (e: React.MouseEvent) => {
    if (selectionMode) {
      e.preventDefault();
      toggleSelect(book.pid);
      return;
    }
    openBook(book.pid);
  };

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selected) startSelection(book.pid);
    else toggleSelect(book.pid);
  };

  return (
    <div
      className={`fp-cell${selected ? " fp-cell-sel" : ""}`}
      style={{ width: colW }}
      onClick={onClick}
      onContextMenu={onContext}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      role="button"
      aria-label={book.t}
      tabIndex={0}
    >
      <div className="fp-cover" style={{ height: coverH }}>
        {showImg ? (
          <img
            src={cover!}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className="fp-cover-blank" aria-hidden>
            <span className="fp-cover-blank-title">{book.t}</span>
            <span className="fp-cover-blank-author">{book.a.split(";")[0]}</span>
          </div>
        )}
        {selectionMode && (
          <span className={`fp-check${selected ? " on" : ""}`} aria-hidden>
            {selected ? "✓" : ""}
          </span>
        )}
      </div>
      <div className="fp-title" title={book.t}>
        {book.t}
      </div>
      <div className="fp-author" title={book.a}>
        {book.a.split(";")[0]}
      </div>
    </div>
  );
}
