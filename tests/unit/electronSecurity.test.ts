import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Electron desktop security configuration", () => {
  it("keeps Node disabled and context isolation enabled in the renderer window", async () => {
    const mainSource = await readFile("desktop/main.ts", "utf8");

    expect(mainSource).toContain("nodeIntegration: false");
    expect(mainSource).toContain("contextIsolation: true");
    expect(mainSource).toContain("sandbox: true");
    expect(mainSource).toContain('preload: path.join(__dirname, "preload.js")');
  });

  it("exposes only the named SketchForge desktop bridge from preload", async () => {
    const preloadSource = await readFile("desktop/preload.ts", "utf8");

    expect(preloadSource).toContain('contextBridge.exposeInMainWorld("sketchforgeDesktop", bridge)');
    expect(preloadSource).not.toContain('exposeInMainWorld("ipcRenderer"');
    expect(preloadSource).not.toContain('exposeInMainWorld("fs"');
    expect(preloadSource).not.toContain("require(");
  });

  it("keeps Electron imports out of browser runtime source", async () => {
    const sourceFiles = await collectSourceFiles("apps/web/src");
    const electronImports: string[] = [];

    for (const filePath of sourceFiles) {
      const source = await readFile(filePath, "utf8");
      if (/from ["']electron["']|require\(["']electron["']\)/.test(source)) {
        electronImports.push(filePath);
      }
    }

    expect(electronImports).toEqual([]);
  });
});

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  }));
  return files.flat();
}
