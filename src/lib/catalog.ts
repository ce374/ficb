// Catalog types and loader.
// The full Faded Page catalogue lives at /public/books.json as a compact array.
// We load it once and keep an in-memory index for instant filtering.

export type Book = {
  pid: string;
  t: string; // title
  a: string; // author (semicolon-joined, may include pseudonym)
  y: number; // first_publication year (0 = unknown)
  l: string; // language code
  p: number; // page count
  d: number; // download count
  c: string; // cover path relative to fadedpage root, "" if none
  g: string[]; // tags / categories
};

export const FADED_ROOT = "https://www.fadedpage.com";

// Download formats offered for every book on Faded Page.
// `ext` is the FULL suffix appended to the pid to form the filename.
// Faded Page uses hyphens for compound formats (pid-k.epub, pid-a5.pdf, pid-h.zip),
// dots for simple ones (pid.txt, pid.html, pid.epub, pid.mobi).
export type Format = {
  ext: string; // full suffix appended to pid, e.g. ".txt" or "-a5.pdf"
  label: string; // short label for the button
  kind: string; // human description
};

export const FORMATS: Format[] = [
  { ext: ".txt", label: "TXT", kind: "UTF-8 plain text" },
  { ext: ".html", label: "HTML", kind: "Single-page HTML" },
  { ext: ".epub", label: "EPUB", kind: "Standard ePub" },
  { ext: "-k.epub", label: "EPUB-K", kind: "ePub tuned for Kindle" },
  { ext: ".mobi", label: "MOBI", kind: "Mobi / Kindle" },
  { ext: "-a5.pdf", label: "PDF", kind: "PDF (A5 tablet)" },
  { ext: "-h.zip", label: "ZIP", kind: "HTML chapter zip" },
];

export function coverUrl(b: Book): string | null {
  return b.c ? `${FADED_ROOT}/${b.c}` : null;
}

export function bookUrl(pid: string): string {
  return `${FADED_ROOT}/showbook.php?pid=${pid}`;
}

// Downloads go through our own proxy at /api/download — Faded Page gates files
// behind a PHPSESSID session that only the server can obtain.
// `ext` is the full suffix appended to the pid (e.g. ".txt", "-a5.pdf").
export function downloadUrl(pid: string, ext: string): string {
  return `/api/download?pid=${pid}&ext=${encodeURIComponent(ext)}`;
}

// One-time fetch + parse. Returns the array and a small search index.
let _cache: Promise<{ books: Book[]; categories: string[] }> | null = null;

export function loadCatalog(): Promise<{ books: Book[]; categories: string[] }> {
  if (_cache) return _cache;
  _cache = (async () => {
    const res = await fetch("/books.json", { cache: "force-cache" });
    const books = (await res.json()) as Book[];
    // Derive the category list (tags) sorted by frequency for the drawer.
    const counts = new Map<string, number>();
    for (const b of books) for (const g of b.g) counts.set(g, (counts.get(g) || 0) + 1);
    const categories = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g);
    return { books, categories };
  })();
  return _cache;
}
