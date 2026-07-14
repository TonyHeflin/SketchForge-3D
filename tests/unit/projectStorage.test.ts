import { afterEach, describe, expect, it } from "vitest";
import { browserProjectStorage, PROJECT_ACCENTS } from "@/lib/projectStorage";
import type { DashboardProject } from "@/lib/projectStorage";
import type { WorkplaneShape } from "@/types/sketchforge";

const originalWindow = globalThis.window;

afterEach(() => {
  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true });
  }
});

function boxShape(id: string): WorkplaneShape {
  return {
    id,
    type: "box",
    name: "Box",
    x: 0,
    y: 0,
    z: 0,
    width: 10,
    depth: 10,
    height: 10,
    color: "#ff0000",
    rotation: 0,
  };
}

describe("browser project storage adapter", () => {
  it("declares browser-only capabilities for adapter selection", () => {
    expect(browserProjectStorage.capabilities).toEqual({
      kind: "browser",
      supportsProjectDirectory: false,
      supportsBackups: false,
      supportsNativeFolderPicker: false,
      supportsMigrationSource: true,
    });
    expect(PROJECT_ACCENTS).toEqual(["cyan", "green", "gold", "red"]);
  });

  it("returns an empty project snapshot when browser storage is unavailable", async () => {
    await expect(browserProjectStorage.readStoredProjects()).resolves.toEqual({ projects: [], legacyShapes: {} });
    await expect(browserProjectStorage.readProjects()).resolves.toEqual([]);
  });

  it("persists dashboard project metadata through browser localStorage without desktop APIs", async () => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        },
      },
      configurable: true,
    });
    const project: DashboardProject = {
      id: "browser_project",
      name: "Browser Project",
      createdAt: 1,
      updatedAt: 2,
      shapes: 0,
      accent: "cyan",
      revision: 2,
    };

    await expect(browserProjectStorage.saveProjects([project])).resolves.toMatchObject([{ id: "browser_project" }]);

    await expect(browserProjectStorage.readProjects()).resolves.toMatchObject([
      { id: "browser_project", name: "Browser Project", revision: 2, shapes: 0 },
    ]);
    expect(browserProjectStorage.getProjectDirectory).toBeUndefined();
    expect(browserProjectStorage.chooseProjectDirectory).toBeUndefined();
  });

  it("hydrates shape history through the storage adapter", () => {
    const shape = boxShape("shape-1");
    const entry = browserProjectStorage.projectShapeCacheEntry(3, [shape]);

    expect(entry.revision).toBe(3);
    expect(entry.shapes).toHaveLength(1);
    expect(entry.shapes[0]).toMatchObject(shape);
    expect(entry.history).toHaveLength(1);
    expect(entry.historyIndex).toBe(0);
  });
});
