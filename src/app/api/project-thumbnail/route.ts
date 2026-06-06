import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const THUMBNAIL_DIR = path.join(process.cwd(), ".codex", "project-thumbnails");

function safeProjectId(projectId: string) {
  const clean = projectId.replace(/[^a-zA-Z0-9_-]/g, "");
  return clean || null;
}

function thumbnailPath(projectId: string) {
  const safeId = safeProjectId(projectId);
  if (!safeId) {
    return null;
  }
  return path.join(THUMBNAIL_DIR, `${safeId}.png`);
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
  const filePath = thumbnailPath(projectId);
  if (!filePath) {
    return new NextResponse("Invalid project id", { status: 400 });
  }

  try {
    const image = await fs.readFile(filePath);
    return new NextResponse(image, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "image/png",
      },
    });
  } catch {
    return new NextResponse("Thumbnail not found", { status: 404 });
  }
}

export async function POST(request: Request) {
  let body: { dataUrl?: unknown; projectId?: unknown };
  try {
    body = (await request.json()) as { dataUrl?: unknown; projectId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid thumbnail request" }, { status: 400 });
  }

  try {
    if (typeof body.projectId !== "string" || typeof body.dataUrl !== "string") {
      return NextResponse.json({ error: "Invalid thumbnail request" }, { status: 400 });
    }

    const filePath = thumbnailPath(body.projectId);
    const match = body.dataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!filePath || !match) {
      return NextResponse.json({ error: "Invalid thumbnail image" }, { status: 400 });
    }

    await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
    await fs.rm(filePath, { force: true });
    await fs.writeFile(filePath, Buffer.from(match[1], "base64"));

    return NextResponse.json({ version: Date.now() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save thumbnail" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
  const filePath = thumbnailPath(projectId);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  await fs.rm(filePath, { force: true });
  return NextResponse.json({ deleted: true });
}
