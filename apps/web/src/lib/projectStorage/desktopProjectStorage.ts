import { DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE, normalizeSnapGrid, normalizeWorkspaceSettings } from "@/lib/workplaneSettings";
import type { GridSize, WorkplaneShape, WorkplaneWorkspaceSettings } from "@/types/sketchforge";
import type { DashboardProject, ProjectShapeCacheEntry, ProjectStorage, StoredProjectsSnapshot } from "./types";
import { PROJECT_ACCENTS, projectShapeCacheEntry } from "./browserProjectStorage";

type DesktopStoredProject = {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  revision: number;
  workspace: unknown;
  snapGrid: unknown;
  shapes: unknown[];
  history: unknown[];
  historyIndex: number;
};

type DesktopIpcResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };

type DesktopBridge = {
  projects: {
    listProjects(): Promise<DesktopIpcResult<{ projects: Array<{ id: string }>; errors: Array<{ fileName: string; message: string }> }>>;
    loadProject(id: string): Promise<DesktopIpcResult<DesktopStoredProject | null>>;
    saveProject(project: DesktopStoredProject, options?: { expectedRevision?: number }): Promise<DesktopIpcResult<{ ok: true; project: DesktopStoredProject } | { ok: false; code: "conflict"; actualRevision: number }>>;
    deleteProject(id: string): Promise<DesktopIpcResult<void>>;
    loadThumbnail(projectId: string): Promise<DesktopIpcResult<{ dataUrl: string; version: number } | null>>;
    saveThumbnail(projectId: string, dataUrl: string): Promise<DesktopIpcResult<{ dataUrl: string; version: number }>>;
    deleteThumbnail(projectId: string): Promise<DesktopIpcResult<void>>;
  };
  settings: {
    getProjectDirectory(): Promise<DesktopIpcResult<string>>;
    chooseProjectDirectory(): Promise<DesktopIpcResult<string | null>>;
  };
};

declare global {
  interface Window {
    sketchforgeDesktop?: DesktopBridge;
  }
}

export function desktopProjectStorageAvailable() {
  return typeof window !== "undefined" && Boolean(window.sketchforgeDesktop);
}

const loadedProjectRevisions = new Map<string, number>();

export const desktopProjectStorage = {
  capabilities: {
    kind: "desktop",
    supportsProjectDirectory: true,
    supportsBackups: true,
    supportsNativeFolderPicker: true,
    supportsMigrationSource: false,
  },
  projectShapeCacheEntry,
  async readStoredProjects(): Promise<StoredProjectsSnapshot> {
    const api = desktopApi();
    const listed = unwrap(await api.projects.listProjects());
    const loaded = await Promise.all(listed.projects.map((project) => api.projects.loadProject(project.id)));
    const projects = await Promise.all(loaded.flatMap((result, index) => {
      const project = unwrap(result);
      if (project) loadedProjectRevisions.set(project.id, project.revision);
      return project ? [dashboardProjectFromDesktop(project, index)] : [];
    }));
    return { projects, legacyShapes: {} };
  },
  async readProjects() {
    return (await this.readStoredProjects()).projects;
  },
  async saveProjects(projects: DashboardProject[]) {
    await Promise.all(projects.map((project) => saveDashboardProject(project)));
    return projects;
  },
  async loadProjectShapes(projectId: string) {
    const project = unwrap(await desktopApi().projects.loadProject(projectId));
    if (!project) return null;
    loadedProjectRevisions.set(project.id, project.revision);
    return {
      id: project.id,
      revision: project.revision,
      shapes: project.shapes as WorkplaneShape[],
      history: project.history as ProjectShapeCacheEntry["history"],
      historyIndex: project.historyIndex,
      updatedAt: project.updatedAt,
    };
  },
  async saveProjectShapes(projectId: string, entry: ProjectShapeCacheEntry) {
    const existing = unwrap(await desktopApi().projects.loadProject(projectId));
    const now = Date.now();
    const project: DesktopStoredProject = {
      schemaVersion: 1,
      id: projectId,
      name: existing?.name ?? "SketchForge design",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      revision: entry.revision,
      workspace: existing?.workspace ?? DEFAULT_WORKPLANE_WORKSPACE,
      snapGrid: existing?.snapGrid ?? DEFAULT_SNAP_GRID,
      shapes: entry.shapes,
      history: entry.history,
      historyIndex: entry.historyIndex,
    };
    const expectedRevision = loadedProjectRevisions.get(projectId) ?? existing?.revision;
    const result = unwrap(await desktopApi().projects.saveProject(project, { expectedRevision }));
    if (!result.ok) {
      throw new Error(`Project conflict: disk revision ${result.actualRevision} is newer`);
    }
    loadedProjectRevisions.set(projectId, project.revision);
  },
  async deleteProjectShapes(projectId: string) {
    unwrap(await desktopApi().projects.deleteProject(projectId));
    loadedProjectRevisions.delete(projectId);
  },
  async getProjectDirectory() {
    return unwrap(await desktopApi().settings.getProjectDirectory());
  },
  async chooseProjectDirectory() {
    return unwrap(await desktopApi().settings.chooseProjectDirectory());
  },
  async loadProjectThumbnail(projectId: string) {
    return unwrap(await desktopApi().projects.loadThumbnail(projectId));
  },
  async saveProjectThumbnail(projectId: string, dataUrl: string) {
    return unwrap(await desktopApi().projects.saveThumbnail(projectId, dataUrl));
  },
  async deleteProjectThumbnail(projectId: string) {
    unwrap(await desktopApi().projects.deleteThumbnail(projectId));
  },
} satisfies ProjectStorage;

async function saveDashboardProject(project: DashboardProject) {
  const api = desktopApi();
  const existing = unwrap(await api.projects.loadProject(project.id));
  const stored: DesktopStoredProject = {
    schemaVersion: 1,
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    revision: project.revision ?? project.updatedAt,
    workspace: normalizeWorkspaceSettings(project.workspace),
    snapGrid: normalizeSnapGrid(project.snapGrid),
    shapes: existing?.shapes ?? [],
    history: existing?.history ?? [],
    historyIndex: existing?.historyIndex ?? 0,
  };
  const expectedRevision = loadedProjectRevisions.get(project.id) ?? existing?.revision;
  const result = unwrap(await api.projects.saveProject(stored, { expectedRevision }));
  if (!result.ok) {
    throw new Error(`Project conflict: disk revision ${result.actualRevision} is newer`);
  }
  loadedProjectRevisions.set(project.id, stored.revision);
}

async function dashboardProjectFromDesktop(project: DesktopStoredProject, index: number): Promise<DashboardProject> {
  const thumbnail = unwrap(await desktopApi().projects.loadThumbnail(project.id));
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    shapes: project.shapes.length,
    accent: PROJECT_ACCENTS[index % PROJECT_ACCENTS.length],
    thumbnailUrl: thumbnail?.dataUrl ?? null,
    thumbnailVersion: thumbnail?.version,
    revision: project.revision,
    workspace: normalizeWorkspaceSettings(project.workspace) as WorkplaneWorkspaceSettings,
    snapGrid: normalizeSnapGrid(project.snapGrid) as GridSize,
  };
}

function desktopApi() {
  const api = window.sketchforgeDesktop;
  if (!api) {
    throw new Error("SketchForge desktop APIs are unavailable");
  }
  return api;
}

function unwrap<T>(result: DesktopIpcResult<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}
