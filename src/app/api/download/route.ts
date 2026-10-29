// Download proxy for Faded Page.
// Faded Page gates file downloads behind a PHPSESSID session that must first
// "visit" the book's showbook.php page. Browsers can't do this cross-origin,
// so we proxy server-side: prime the session for the pid, then stream the file.
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = "https://www.fadedpage.com";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

// One process-wide session cookie. Refreshed whenever showbook sets a new one.
let sessionCookie: string | null = null;

function cookieHeader(): Record<string, string> {
  return sessionCookie ? { Cookie: sessionCookie } : {};
}

async function primeSession(pid: string): Promise<void> {
  // Visit the book page so the session records this pid as "seen".
  const res = await fetch(`${ROOT}/showbook.php?pid=${encodeURIComponent(pid)}`, {
    headers: { "User-Agent": UA, ...cookieHeader() },
    redirect: "follow",
  });
  // capture Set-Cookie
  const sc = res.headers.get("set-cookie");
  if (sc) {
    const m = sc.match(/PHPSESSID=([^;]+)/);
    if (m) sessionCookie = `PHPSESSID=${m[1]}`;
  }
  // drain
  await res.arrayBuffer();
}

export async function GET(req: NextRequest) {
  const pid = req.nextUrl.searchParams.get("pid");
  const ext = req.nextUrl.searchParams.get("ext");
  // pid is a numeric code; ext is the full suffix appended to it to form the
  // filename — e.g. ".txt", "-a5.pdf", "-k.epub". No slashes allowed.
  if (!pid || !ext || !/^\w{6,12}$/.test(pid) || !/^[-.\w]+$/.test(ext)) {
    return new Response("bad params", { status: 400 });
  }
  const file = `${pid}${ext}`;

  try {
    await primeSession(pid);
    const upstream = await fetch(`${ROOT}/link.php?file=${encodeURIComponent(file)}`, {
      headers: {
        "User-Agent": UA,
        Referer: `${ROOT}/showbook.php?pid=${pid}`,
        ...cookieHeader(),
      },
      redirect: "follow",
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(`upstream ${upstream.status}`, { status: 502 });
    }

    // Pass through the attachment headers so the browser downloads (not navigates).
    const headers = new Headers();
    headers.set(
      "Content-Disposition",
      upstream.headers.get("content-disposition") || `attachment; filename="${file}"`
    );
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") || "application/octet-stream"
    );
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);

    return new Response(upstream.body, { status: 200, headers });
  } catch (e) {
    return new Response("proxy error: " + (e as Error).message, { status: 502 });
  }
}
