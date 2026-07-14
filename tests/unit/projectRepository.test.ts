import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectRepository } from "../../desktop/projectRepository";
import type { StoredProject } from "../../desktop/types";

let tempRoot = "";
let repository: ProjectRepository;

function project(overrides: Partial<StoredProject> = {}): StoredProject {
  const now = 1_700_000_000_000;
  return {
    schemaVersion: 1,
    id: "project_1",
    name: "Test Project",
    createdAt: now,
    updatedAt: now,
    revision: 1,
    workspace: { width: 200, depth: 200 },
    snapGrid: "1.0 mm",
    shapes: [{ id: "shape-1", cadMetadata: { source: "imported.stl" } }],
    history: [{ id: "history-1", shapes: [{ id: "shape-1" }], selectedIds: [] }],
    historyIndex: 0,
    ...overrides,
  };
}

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "sketchforge-projects-"));
  repository = new ProjectRepository(tempRoot);
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("ProjectRepository", () => {
  it("creates the expected desktop project directory layout", async () => {
    await repository.ensureLayout();

    await expect(readdir(tempRoot).then((entries) => entries.sort())).resolves.toEqual(["backups", "projects", "settings.json", "thumbnails"]);
    await expect(readFile(repository.settingsPath, "utf8")).resolves.toContain("sketchforge-project-directory");
  });

  it("saves, lists, reloads, and deletes project files without deriving names from project titles", async () => {
    const saved = project({ name: "Name / With Unsafe Characters" });

    await expect(repository.saveProject(saved)).resolves.toEqual({ ok: true, project: saved });
    await expect(readdir(repository.projectsDirectory)).resolves.toEqual(["project_1.sketchforge"]);

    await expect(repository.loadProject(saved.id)).resolves.toEqual(saved);
    await expect(repository.listProjects()).resolves.toEqual({
      projects: [{ id: saved.id, name: saved.name, createdAt: saved.createdAt, updatedAt: saved.updatedAt, revision: saved.revision, shapes: 1 }],
      errors: [],
    });

    await repository.deleteProject(saved.id);
    await expect(repository.loadProject(saved.id)).resolves.toBeNull();
  });

  it("rejects invalid project IDs and malformed payloads", async () => {
    await expect(repository.loadProject("../escape")).rejects.toThrow(/letters, numbers/);
    await expect(repository.saveProject(project({ id: "bad/path" }))).rejects.toThrow(/letters, numbers/);
    await expect(repository.saveProject({ ...project(), shapes: undefined } as unknown as StoredProject)).rejects.toThrow(/shapes/);
    const missingWorkspace = project();
    delete (missingWorkspace as Partial<StoredProject>).workspace;
    await expect(repository.saveProject(missingWorkspace)).rejects.toThrow(/workspace/);
    const missingSnapGrid = project();
    delete (missingSnapGrid as Partial<StoredProject>).snapGrid;
    await expect(repository.saveProject(missingSnapGrid)).rejects.toThrow(/snapGrid/);
  });

  it("creates backups before overwrites and retains only the newest 10 per project", async () => {
    await repository.saveProject(project({ revision: 1 }));

    for (let revision = 2; revision <= 13; revision += 1) {
      await repository.saveProject(project({ revision, updatedAt: 1_700_000_000_000 + revision }), { expectedRevision: revision - 1 });
    }

    const backups = await readdir(repository.backupsDirectory);
    expect(backups).toHaveLength(10);
    expect(backups.every((backup) => backup.startsWith("project_1.") && backup.endsWith(".sketchforge"))).toBe(true);
    await expect(repository.loadProject("project_1")).resolves.toMatchObject({ revision: 13 });
  });

  it("returns a conflict result instead of overwriting a newer on-disk revision", async () => {
    await repository.saveProject(project({ revision: 5 }));

    const result = await repository.saveProject(project({ revision: 6, name: "Stale save" }), { expectedRevision: 4 });

    expect(result).toMatchObject({ ok: false, code: "conflict", projectId: "project_1", expectedRevision: 4, actualRevision: 5 });
    await expect(repository.loadProject("project_1")).resolves.toMatchObject({ revision: 5, name: "Test Project" });
  });

  it("removes stale temporary files and reports corrupt projects without hiding valid projects", async () => {
    await repository.ensureLayout();
    await writeFile(path.join(repository.projectsDirectory, ".project_1.123.tmp"), "partial", "utf8");
    await writeFile(path.join(repository.projectsDirectory, "corrupt.sketchforge"), "not json", "utf8");
    await repository.saveProject(project({ id: "valid", name: "Valid" }));

    const result = await repository.listProjects();

    expect(result.projects).toEqual([{ id: "valid", name: "Valid", createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, revision: 1, shapes: 1 }]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.fileName).toBe("corrupt.sketchforge");
    await expect(readdir(repository.projectsDirectory)).resolves.not.toContain(".project_1.123.tmp");
  });

  it("saves, loads, and deletes project thumbnails", async () => {
    const thumbnail = "data:image/png;base64,aGVsbG8=";

    await expect(repository.saveThumbnail("project_1", thumbnail)).resolves.toMatchObject({ projectId: "project_1", dataUrl: thumbnail });
    await expect(repository.loadThumbnail("project_1")).resolves.toMatchObject({ projectId: "project_1", dataUrl: thumbnail });

    await repository.deleteThumbnail("project_1");
    await expect(repository.loadThumbnail("project_1")).resolves.toBeNull();
  });

  it("rejects invalid thumbnail payloads", async () => {
    await expect(repository.saveThumbnail("project_1", "data:text/plain;base64,aGVsbG8=")).rejects.toThrow(/PNG data URL/);
  });

  it("leaves the prior valid file unchanged when serialization fails", async () => {
    await repository.saveProject(project({ revision: 1 }));
    const cyclic = project({ revision: 2 });
    (cyclic.workspace as { self?: unknown }).self = cyclic.workspace;

    await expect(repository.saveProject(cyclic, { expectedRevision: 1 })).rejects.toThrow(/circular/i);

    const persisted = JSON.parse(await readFile(repository.projectPath("project_1"), "utf8")) as StoredProject;
    expect(persisted.revision).toBe(1);
  });

  it("returns a useful error when the backup directory is unavailable without corrupting the prior project", async () => {
    await repository.saveProject(project({ revision: 1 }));
    await rm(repository.backupsDirectory, { recursive: true, force: true });
    await writeFile(repository.backupsDirectory, "not a directory", "utf8");

    await expect(repository.saveProject(project({ revision: 2 }), { expectedRevision: 1 })).rejects.toThrow(/EEXIST|ENOTDIR|file already exists/i);

    const persisted = JSON.parse(await readFile(repository.projectPath("project_1"), "utf8")) as StoredProject;
    expect(persisted.revision).toBe(1);
  });
});
