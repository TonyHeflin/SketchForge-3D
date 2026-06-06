import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

function safeFileName(filename: string) {
  const base = path.basename(filename).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
  return base || "download.txt";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { content?: unknown; filename?: unknown; folder?: unknown };
    if (typeof body.content !== "string" || typeof body.filename !== "string" || typeof body.folder !== "string") {
      return NextResponse.json({ error: "Invalid download request" }, { status: 400 });
    }

    const trimmedFolder = body.folder.trim();
    if (!trimmedFolder) {
      return NextResponse.json({ error: "Choose a folder first" }, { status: 400 });
    }

    const targetDirectory = path.isAbsolute(trimmedFolder) ? trimmedFolder : path.join(process.cwd(), trimmedFolder);
    await fs.mkdir(targetDirectory, { recursive: true });
    const targetPath = path.join(targetDirectory, safeFileName(body.filename));
    await fs.writeFile(targetPath, body.content, "utf8");

    return NextResponse.json({ path: targetPath });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save file" }, { status: 500 });
  }
}
