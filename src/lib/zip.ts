// Parallel multi-book downloader + zip builder (fflate).
// Fetches every requested file in parallel, then either saves them loose
// (one <a download> per file) or bundles them into a single named zip.

import { downloadUrl } from "./catalog";
import type { Book } from "./catalog";
import { zipSync, strToU8 } from "fflate";

type Job = { book: Book; ext: string };

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

function safeName(s: string, fallback: string): string {
  const t = (s || fallback).replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
  return t.slice(0, 80) || fallback;
}

// Download every job as a separate file. Browsers throttle simultaneous
// downloads, so we nudge them with a tiny stagger.
export async function downloadLoose(jobs: Job[]): Promise<{ ok: number; fail: number }> {
  let ok = 0;
  let fail = 0;
  // parallel fetch, then sequential save to dodge the "multiple downloads" blocker
  const results = await Promise.allSettled(
    jobs.map(async (j) => ({ j, bytes: await fetchBytes(downloadUrl(j.book.pid, j.ext)) }))
  );
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      const { j, bytes } = r.value;
      const blob = new Blob([bytes], { type: "application/octet-stream" });
      saveBlob(blob, `${safeName(j.book.t, j.book.pid)}.${extToFile(j.ext)}`);
      ok++;
      await sleep(250); // let the browser register the save
    } else {
      fail++;
    }
  }
  return { ok, fail };
}

// Fetch all jobs in parallel, then pack into one zip named `zipName`.zip.
// Also drops a MANIFEST.txt inside describing the contents.
export async function downloadZip(
  jobs: Job[],
  zipName: string
): Promise<{ ok: number; fail: number }> {
  const results = await Promise.allSettled(
    jobs.map(async (j) => ({
      j,
      bytes: await fetchBytes(downloadUrl(j.book.pid, j.ext)),
    }))
  );

  const files: Record<string, Uint8Array> = {};
  const manifest: string[] = [];
  let ok = 0;
  let fail = 0;
  const used = new Set<string>();

  for (const r of results) {
    if (r.status !== "fulfilled") {
      fail++;
      continue;
    }
    const { j, bytes } = r.value;
    const fname = `${safeName(j.book.t, j.book.pid)}.${extToFile(j.ext)}`;
    let unique = fname;
    let n = 2;
    while (used.has(unique.toLowerCase())) unique = fname.replace(/(\.[^.]+)$/, `_${n++}$1`);
    used.add(unique.toLowerCase());
    files[unique] = bytes;
    manifest.push(`${unique}\t${j.book.pid}\t${j.book.a}`);
    ok++;
  }

  files["MANIFEST.txt"] = strToU8(manifest.join("\n") + "\n");
  const zipped = zipSync(files, { level: 5 });
  saveBlob(new Blob([zipped], { type: "application/zip" }), `${safeName(zipName, "fadedpage")}.zip`);
  return { ok, fail };
}

// --- tracker backup: zip of batched JSON (<=100 book identities per file) ---
export type IdentityEntry = {
  pid: string;
  title: string;
  author: string;
  year: number;
  formats: string[];
  addedAt: number;
};

export async function exportTrackerZip(
  entries: IdentityEntry[],
  zipName: string
): Promise<void> {
  const files: Record<string, Uint8Array> = {};
  const chunks: IdentityEntry[][] = [];
  for (let i = 0; i < entries.length; i += 100) chunks.push(entries.slice(i, i + 100));
  if (chunks.length === 0) chunks.push([]);
  chunks.forEach((chunk, i) => {
    const idx = String(i + 1).padStart(3, "0");
    const payload = {
      source: "fadedpage-tracker",
      batch: i + 1,
      count: chunk.length,
      books: chunk,
    };
    files[`batch_${idx}.json`] = strToU8(JSON.stringify(payload, null, 1));
  });
  files["index.json"] = strToU8(
    JSON.stringify(
      {
        source: "fadedpage-tracker",
        exported_at: new Date().toISOString(),
        total: entries.length,
        batches: chunks.length,
      },
      null,
      1
    ) + "\n"
  );
  const zipped = zipSync(files, { level: 6 });
  saveBlob(new Blob([zipped], { type: "application/zip" }), `${safeName(zipName, "fadedpage-track")}.zip`);
}

// Read a tracker backup zip (uploaded by the user) and return all identities.
export async function importTrackerZip(file: File): Promise<IdentityEntry[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const { unzipSync } = await import("fflate");
  const entries = unzipSync(buf);
  const out: IdentityEntry[] = [];
  for (const [name, data] of Object.entries(entries)) {
    if (!name.endsWith(".json") || name.endsWith("index.json")) continue;
    try {
      const parsed = JSON.parse(new TextDecoder().decode(data));
      const books = parsed.books || parsed;
      if (Array.isArray(books)) {
        for (const b of books) {
          if (b && typeof b.pid === "string") {
            out.push({
              pid: b.pid,
              title: b.title || "",
              author: b.author || "",
              year: b.year || 0,
              formats: b.formats || [],
              addedAt: b.addedAt || Date.now(),
            });
          }
        }
      }
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

// --- helpers ---
function extToFile(ext: string): string {
  // "a5.pdf" -> "pdf", "k.epub" -> "epub", "h.zip" -> "zip"
  if (ext.includes(".")) return ext.split(".").pop()!;
  return ext;
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
