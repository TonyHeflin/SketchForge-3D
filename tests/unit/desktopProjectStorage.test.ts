import { afterEach, describe, expect, it } from "vitest";
import { desktopProjectStorage, desktopProjectStorageAvailable, getProjectStorage } from "@/lib/projectStorage";

const originalWindow = globalThis.window;

afterEach(() => {
  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true });
  }
});

describe("desktop project storage selection", () => {
  it("falls back when the desktop preload bridge is unavailable", () => {
    Reflect.deleteProperty(globalThis, "window");

    expect(desktopProjectStorageAvailable()).toBe(false);
    expect(getProjectStorage().capabilities.kind).toBe("browser");
  });

  it("selects desktop storage when the preload bridge is present", () => {
    Object.defineProperty(globalThis, "window", {
      value: { sketchforgeDesktop: { projects: {}, settings: {} } },
      configurable: true,
    });

    expect(desktopProjectStorageAvailable()).toBe(true);
    expect(getProjectStorage().capabilities.kind).toBe("desktop");
  });

  it("maps desktop projects into dashboard projects", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        sketchforgeDesktop: {
          projects: {
            listProjects: async () => ({ ok: true, value: { projects: [{ id: "desktop_1" }], errors: [] } }),
            loadProject: async () => ({
              ok: true,
              value: {
                schemaVersion: 1,
                id: "desktop_1",
                name: "Desktop Project",
                createdAt: 1,
                updatedAt: 2,
                revision: 3,
                workspace: { width: 100, depth: 100 },
                snapGrid: "1.0 mm",
                shapes: [{ id: "shape-1" }],
                history: [],
                historyIndex: 0,
              },
            }),
            saveProject: async () => ({ ok: true, value: { ok: true } }),
            deleteProject: async () => ({ ok: true, value: undefined }),
            loadThumbnail: async () => ({ ok: true, value: null }),
            saveThumbnail: async () => ({ ok: true, value: { dataUrl: "data:image/png;base64,aGVsbG8=", version: 1 } }),
            deleteThumbnail: async () => ({ ok: true, value: undefined }),
          },
          settings: {},
        },
      },
      configurable: true,
    });

    await expect(desktopProjectStorage.readProjects()).resolves.toMatchObject([
      { id: "desktop_1", name: "Desktop Project", revision: 3, shapes: 1 },
    ]);
  });
  it("uses the desktop bridge for thumbnail persistence", async () => {
    const thumbnail = "data:image/png;base64,aGVsbG8=";
    Object.defineProperty(globalThis, "window", {
      value: {
        sketchforgeDesktop: {
          projects: {
            listProjects: async () => ({ ok: true, value: { projects: [], errors: [] } }),
            loadProject: async () => ({ ok: true, value: null }),
            saveProject: async () => ({ ok: true, value: { ok: true } }),
            deleteProject: async () => ({ ok: true, value: undefined }),
            loadThumbnail: async () => ({ ok: true, value: { dataUrl: thumbnail, version: 1 } }),
            saveThumbnail: async () => ({ ok: true, value: { dataUrl: thumbnail, version: 2 } }),
            deleteThumbnail: async () => ({ ok: true, value: undefined }),
          },
          settings: {},
        },
      },
      configurable: true,
    });

    await expect(desktopProjectStorage.loadProjectThumbnail?.("desktop_1")).resolves.toEqual({ dataUrl: thumbnail, version: 1 });
    await expect(desktopProjectStorage.saveProjectThumbnail?.("desktop_1", thumbnail)).resolves.toEqual({ dataUrl: thumbnail, version: 2 });
    await expect(desktopProjectStorage.deleteProjectThumbnail?.("desktop_1")).resolves.toBeUndefined();
  });

  it("uses the desktop bridge for project metadata saves, deletes, and directory settings", async () => {
    const savedProjects: unknown[] = [];
    const saveOptions: unknown[] = [];
    const deletedProjects: string[] = [];
    Object.defineProperty(globalThis, "window", {
      value: {
        sketchforgeDesktop: {
          projects: {
            listProjects: async () => ({ ok: true, value: { projects: [], errors: [] } }),
            loadProject: async () => ({
              ok: true,
              value: {
                schemaVersion: 1,
                id: "metadata_project",
                name: "Old Name",
                createdAt: 1,
                updatedAt: 2,
                revision: 7,
                workspace: { width: 100, depth: 100 },
                snapGrid: "1.0 mm",
                shapes: [{ id: "shape-1" }],
                history: [{ id: "history-1" }],
                historyIndex: 0,
              },
            }),
            saveProject: async (project: unknown, options?: unknown) => {
              savedProjects.push(project);
              saveOptions.push(options);
              return { ok: true, value: { ok: true } };
            },
            deleteProject: async (projectId: string) => {
              deletedProjects.push(projectId);
              return { ok: true, value: undefined };
            },
            loadThumbnail: async () => ({ ok: true, value: null }),
            saveThumbnail: async () => ({ ok: true, value: { dataUrl: "data:image/png;base64,aGVsbG8=", version: 1 } }),
            deleteThumbnail: async () => ({ ok: true, value: undefined }),
          },
          settings: {
            getProjectDirectory: async () => ({ ok: true, value: "/tmp/SketchForge Projects" }),
            chooseProjectDirectory: async () => ({ ok: true, value: "/tmp/Other SketchForge Projects" }),
          },
        },
      },
      configurable: true,
    });

    await expect(desktopProjectStorage.saveProjects([
      {
        id: "metadata_project",
        name: "New Name",
        createdAt: 1,
        updatedAt: 8,
        shapes: 1,
        accent: "green",
        revision: 8,
      },
    ])).resolves.toHaveLength(1);
    await expect(desktopProjectStorage.deleteProjectShapes("metadata_project")).resolves.toBeUndefined();
    await expect(desktopProjectStorage.getProjectDirectory?.()).resolves.toBe("/tmp/SketchForge Projects");
    await expect(desktopProjectStorage.chooseProjectDirectory?.()).resolves.toBe("/tmp/Other SketchForge Projects");

    expect(savedProjects.at(-1)).toMatchObject({
      id: "metadata_project",
      name: "New Name",
      revision: 8,
      shapes: [{ id: "shape-1" }],
      history: [{ id: "history-1" }],
      historyIndex: 0,
    });
    expect(saveOptions.at(-1)).toEqual({ expectedRevision: 7 });
    expect(deletedProjects).toEqual(["metadata_project"]);
  });

  it("saves with the originally loaded revision for desktop conflict detection", async () => {
    const saveOptions: Array<{ expectedRevision?: number }> = [];
    Object.defineProperty(globalThis, "window", {
      value: {
        sketchforgeDesktop: {
          projects: {
            listProjects: async () => ({ ok: true, value: { projects: [{ id: "conflict_project" }], errors: [] } }),
            loadProject: async () => ({
              ok: true,
              value: {
                schemaVersion: 1,
                id: "conflict_project",
                name: "Conflict Project",
                createdAt: 1,
                updatedAt: 2,
                revision: 5,
                workspace: {},
                snapGrid: {},
                shapes: [],
                history: [],
                historyIndex: 0,
              },
            }),
            saveProject: async (_project: unknown, options?: { expectedRevision?: number }) => {
              saveOptions.push(options ?? {});
              return { ok: true, value: { ok: true } };
            },
            deleteProject: async () => ({ ok: true, value: undefined }),
            loadThumbnail: async () => ({ ok: true, value: null }),
            saveThumbnail: async () => ({ ok: true, value: { dataUrl: "data:image/png;base64,aGVsbG8=", version: 1 } }),
            deleteThumbnail: async () => ({ ok: true, value: undefined }),
          },
          settings: {},
        },
      },
      configurable: true,
    });

    await desktopProjectStorage.readProjects();
    await desktopProjectStorage.saveProjectShapes("conflict_project", desktopProjectStorage.projectShapeCacheEntry(6, []));

    expect(saveOptions.at(-1)).toEqual({ expectedRevision: 5 });
  });

});
