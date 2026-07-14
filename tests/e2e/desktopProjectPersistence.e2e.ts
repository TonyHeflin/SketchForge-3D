import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectRepository } from "../../desktop/projectRepository";
import type { StoredProject } from "../../desktop/types";

let tempRoot = "";

function project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    schemaVersion: 1,
    id: "desktop_e2e_project",
    name: "Desktop E2E Project",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    revision: 1,
    workspace: { width: 240, depth: 180, height: 120 },
    snapGrid: "1.0 mm",
    shapes: [
      { id: "box-1", kind: "box", name: "Body", width: 20, depth: 20, height: 10 },
      { id: "hole-1", kind: "cylinder", name: "Hole", hole: true, width: 6, depth: 6, height: 14 },
    ],
    history: [
      { id: "history-1", shapes: [{ id: "box-1" }], selectedIds: ["box-1"] },
      { id: "history-2", shapes: [{ id: "box-1" }, { id: "hole-1" }], selectedIds: ["hole-1"] },
    ],
    historyIndex: 1,
    ...overrides,
  };
}

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "sketchforge-desktop-e2e-"));
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("desktop project persistence smoke", () => {
  it("survives repository restart, keeps ID-based filenames on rename, and leaves backups after delete", async () => {
    const firstSession = new ProjectRepository(tempRoot);
    const initialProject = project();

    await expect(firstSession.saveProject(initialProject)).resolves.toEqual({ ok: true, project: initialProject });
    await expect(readdir(firstSession.projectsDirectory)).resolves.toEqual(["desktop_e2e_project.sketchforge"]);

    const restartedSession = new ProjectRepository(tempRoot);
    await expect(restartedSession.loadProject("desktop_e2e_project")).resolves.toEqual(initialProject);

    const renamedProject = project({ name: "Renamed Desktop Project", revision: 2, updatedAt: 1_700_000_000_100 });
    await expect(restartedSession.saveProject(renamedProject, { expectedRevision: 1 })).resolves.toEqual({ ok: true, project: renamedProject });
    await expect(readdir(restartedSession.projectsDirectory)).resolves.toEqual(["desktop_e2e_project.sketchforge"]);
    await expect(restartedSession.loadProject("desktop_e2e_project")).resolves.toMatchObject({
      id: "desktop_e2e_project",
      name: "Renamed Desktop Project",
      historyIndex: 1,
      shapes: [{ id: "box-1" }, { id: "hole-1" }],
    });

    await restartedSession.deleteProject("desktop_e2e_project");
    await expect(restartedSession.loadProject("desktop_e2e_project")).resolves.toBeNull();
    expect(await readdir(restartedSession.backupsDirectory)).toHaveLength(1);
  });
});
