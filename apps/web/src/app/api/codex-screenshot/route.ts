import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function sanitizeFileName(value: unknown) {
  const fallback = `codex-screenshot-${Date.now()}.png`;
  if (typeof value !== "string") {
    return fallback;
  }
  const cleaned = value.replace(/[^a-z0-9_.-]+/gi, "_").replace(/^_+|_+$/g, "");
  return cleaned.endsWith(".png") ? cleaned : `${cleaned || fallback}.png`;
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Codex screenshot capture is only available in local development." }, { status: 404 });
  }

  const host = request.headers.get("host")?.split(":")[0] ?? "";
  if (!localHosts.has(host)) {
    return NextResponse.json({ error: "Codex screenshot capture only accepts local requests." }, { status: 403 });
  }

  const body = (await request.json()) as { dataUrl?: unknown; name?: unknown };
  if (typeof body.dataUrl !== "string" || !body.dataUrl.startsWith("data:image/png;base64,")) {
    return NextResponse.json({ error: "Expected a PNG data URL." }, { status: 400 });
  }

  const bytes = Buffer.from(body.dataUrl.slice("data:image/png;base64,".length), "base64");
  const directory = path.join(process.cwd(), ".codex", "screenshots");
  await mkdir(directory, { recursive: true });

  const filePath = path.join(directory, sanitizeFileName(body.name));
  await writeFile(filePath, bytes);
  return NextResponse.json({ path: filePath, bytes: bytes.length });
}
