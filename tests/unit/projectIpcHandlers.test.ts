import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DESKTOP_PROJECT_API_METHODS } from "../../desktop/ipcContract";
import { createProjectIpcHandlers } from "../../desktop/projectIpcHandlers";
import { ProjectRepository } from "../../desktop/projectRepository";
import type { DesktopProjectApi } from "../../desktop/ipcContract";
import type { StoredProject } from "../../desktop/types";

let tempRoot = "";
let api: DesktopProjectApi;

function project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    schemaVersion: 1,
    id: "ipc_project",
    name: "IPC Project",
    createdAt: 1,
    updatedAt: 1,
    revision: 1,
    workspace: {},
    snapGrid: {},
    shapes: [],
    history: [],
    historyIndex: 0,
    ...overrides,
  };
}

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "sketchforge-ipc-"));
  api = createProjectIpcHandlers(new ProjectRepository(tempRoot));
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("desktop project IPC handlers", () => {
  it("exposes only the defined project API methods", () => {
    expect(Object.keys(api).sort()).toEqual([...DESKTOP_PROJECT_API_METHODS].sort());
  });

  it("wraps repository operations in structured success results", async () => {
    await expect(api.saveProject(project())).resolves.toMatchObject({ ok: true, value: { ok: true } });
    await expect(api.loadProject("ipc_project")).resolves.toMatchObject({ ok: true, value: { id: "ipc_project" } });
    await expect(api.listProjects()).resolves.toMatchObject({ ok: true, value: { projects: [{ id: "ipc_project" }], errors: [] } });
    await expect(api.deleteProject("ipc_project")).resolves.toEqual({ ok: true, value: undefined });
  });

  it("rejects path traversal and non-string IDs before they reach filesystem paths", async () => {
    await expect(api.loadProject("../escape")).resolves.toEqual({
      ok: false,
      error: {
        code: "validation",
        message: "Project id may only contain letters, numbers, underscores, and hyphens",
      },
    });
    await expect(api.loadProject(123 as unknown as string)).resolves.toEqual({
      ok: false,
      error: {
        code: "validation",
        message: "Project id may only contain letters, numbers, underscores, and hyphens",
      },
    });
  });

  it("returns structured validation errors for malformed save payloads and options", async () => {
    await expect(api.saveProject({ ...project(), id: "bad/path" })).resolves.toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    await expect(api.saveProject(project(), { expectedRevision: Number.NaN })).resolves.toEqual({
      ok: false,
      error: { code: "validation", message: "Save expectedRevision must be a finite number" },
    });
  });

  it("wraps thumbnail operations in structured results", async () => {
    const thumbnail = "data:image/png;base64,aGVsbG8=";

    await expect(api.saveThumbnail("ipc_project", thumbnail)).resolves.toMatchObject({ ok: true, value: { dataUrl: thumbnail } });
    await expect(api.loadThumbnail("ipc_project")).resolves.toMatchObject({ ok: true, value: { dataUrl: thumbnail } });
    await expect(api.deleteThumbnail("ipc_project")).resolves.toEqual({ ok: true, value: undefined });
  });

  it("returns structured validation errors for invalid thumbnails", async () => {
    await expect(api.saveThumbnail("ipc_project", "not-a-thumbnail")).resolves.toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
  });

  it("returns save conflicts as data instead of IPC transport errors", async () => {
    await api.saveProject(project({ revision: 5 }));

    await expect(api.saveProject(project({ revision: 6 }), { expectedRevision: 4 })).resolves.toMatchObject({
      ok: true,
      value: { ok: false, code: "conflict", projectId: "ipc_project", actualRevision: 5 },
    });
  });
});
