import { hydrateEditorHistoryState } from "@/lib/editorHistory";
import { normalizeSnapGrid, normalizeWorkspaceSettings } from "@/lib/workplaneSettings";
import type { WorkplaneShape } from "@/types/sketchforge";
import type { DashboardProject, ProjectShapeCacheEntry, ProjectShapeRecord, ProjectStorage, StoredDashboardProject, StoredProjectsSnapshot } from "./types";

export const PROJECTS_STORAGE_KEY = "sketchForge.projects";
export const PROJECT_SHAPES_DB_NAME = "sketchForge.projectShapes";
export const PROJECT_SHAPES_STORE_NAME = "projectShapes";
export const PROJECT_ACCENTS: DashboardProject["accent"][] = ["cyan", "green", "gold", "red"];

export function projectShapeCacheEntry(
  revision: number,
  shapes: WorkplaneShape[],
  history?: ProjectShapeCacheEntry["history"],
  historyIndex?: number,
): ProjectShapeCacheEntry {
  const hydrated = hydrateEditorHistoryState(shapes, history, historyIndex);
  return {
    revision,
    shapes: hydrated.entries[hydrated.index]?.shapes ?? shapes,
    history: hydrated.entries,
    historyIndex: hydrated.index,
  };
}

function openProjectShapesDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("Project shape storage is unavailable"));
      return;
    }

    const request = window.indexedDB.open(PROJECT_SHAPES_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_SHAPES_STORE_NAME)) {
        database.createObjectStore(PROJECT_SHAPES_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open project shape storage"));
    request.onsuccess = () => resolve(request.result);
  });
}

export async function loadProjectShapes(projectId: string) {
  const database = await openProjectShapesDb();
  return new Promise<ProjectShapeRecord | null>((resolve, reject) => {
    const transaction = database.transaction(PROJECT_SHAPES_STORE_NAME, "readonly");
    const request = transaction.objectStore(PROJECT_SHAPES_STORE_NAME).get(projectId);
    request.onerror = () => reject(request.error ?? new Error("Could not load project shapes"));
    request.onsuccess = () => resolve((request.result as ProjectShapeRecord | undefined) ?? null);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not load project shapes"));
    };
  });
}

export async function saveProjectShapes(projectId: string, entry: ProjectShapeCacheEntry) {
  const database = await openProjectShapesDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PROJECT_SHAPES_STORE_NAME, "readwrite");
    const store = transaction.objectStore(PROJECT_SHAPES_STORE_NAME);
    const existingRequest = store.get(projectId);
    existingRequest.onerror = () => {
      transaction.abort();
    };
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result as ProjectShapeRecord | undefined;
      if (existing && existing.revision > entry.revision) {
        return;
      }
      store.put({ id: projectId, ...entry, updatedAt: Date.now() } satisfies ProjectShapeRecord);
    };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save project shapes"));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save project shapes"));
    };
  });
}

export async function deleteProjectShapes(projectId: string) {
  const database = await openProjectShapesDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PROJECT_SHAPES_STORE_NAME, "readwrite");
    transaction.objectStore(PROJECT_SHAPES_STORE_NAME).delete(projectId);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not delete project shapes"));
    };
  });
}

function readStoredProjectsSync(): StoredProjectsSnapshot {
  const legacyShapes: Record<string, ProjectShapeCacheEntry> = {};
  if (typeof window === "undefined") return { projects: [] as DashboardProject[], legacyShapes };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROJECTS_STORAGE_KEY) ?? "[]") as StoredDashboardProject[];
    const projects = parsed
      .filter((project) => typeof project.id === "string" && typeof project.name === "string")
      .map((project, index) => {
        const id = project.id as string;
        const updatedAt = typeof project.updatedAt === "number" ? project.updatedAt : Date.now();
        const revision = typeof project.revision === "number" ? project.revision : updatedAt;
        const designShapes = Array.isArray(project.designShapes) ? (project.designShapes as WorkplaneShape[]) : null;
        if (designShapes) {
          legacyShapes[id] = projectShapeCacheEntry(revision, designShapes);
        }
        return {
          id,
          name: project.name as string,
          createdAt: typeof project.createdAt === "number" ? project.createdAt : Date.now(),
          updatedAt,
          shapes: typeof project.shapes === "number" ? project.shapes : (designShapes?.length ?? 0),
          accent: PROJECT_ACCENTS.includes(project.accent as DashboardProject["accent"]) ? (project.accent as DashboardProject["accent"]) : PROJECT_ACCENTS[index % PROJECT_ACCENTS.length],
          thumbnailUrl: typeof project.thumbnailUrl === "string" ? project.thumbnailUrl : null,
          thumbnailVersion: typeof project.thumbnailVersion === "number" ? project.thumbnailVersion : undefined,
          revision,
          workspace: normalizeWorkspaceSettings(project.workspace),
          snapGrid: normalizeSnapGrid(project.snapGrid),
        };
      });
    return { projects, legacyShapes };
  } catch {
    return { projects: [], legacyShapes };
  }
}

function readProjectsSync() {
  return readStoredProjectsSync().projects;
}

export async function readStoredProjects(): Promise<StoredProjectsSnapshot> {
  return readStoredProjectsSync();
}

export async function readProjects() {
  return readProjectsSync();
}

function mergeProjectForStorage(project: DashboardProject, storedProject?: DashboardProject) {
  if (!storedProject) {
    return project;
  }
  const projectRevision = project.revision ?? 0;
  const storedRevision = storedProject.revision ?? 0;
  if (storedRevision <= projectRevision) {
    return project;
  }
  return {
    ...project,
    revision: storedProject.revision,
    shapes: storedProject.shapes || project.shapes,
    thumbnailUrl: project.thumbnailUrl ?? storedProject.thumbnailUrl,
    thumbnailVersion: project.thumbnailVersion ?? storedProject.thumbnailVersion,
    updatedAt: Math.max(project.updatedAt, storedProject.updatedAt),
    workspace: project.workspace ?? storedProject.workspace,
    snapGrid: project.snapGrid ?? storedProject.snapGrid,
  };
}

function projectForStorage(project: DashboardProject): DashboardProject {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    shapes: project.shapes,
    accent: project.accent,
    thumbnailUrl: project.thumbnailUrl ?? null,
    thumbnailVersion: project.thumbnailVersion,
    revision: project.revision,
    workspace: normalizeWorkspaceSettings(project.workspace),
    snapGrid: normalizeSnapGrid(project.snapGrid),
  };
}

function mergeProjectsForStorage(projects: DashboardProject[]) {
  const storedProjects = readProjectsSync();
  const storedById = new Map(storedProjects.map((project) => [project.id, project]));
  return projects.map((project) => projectForStorage(mergeProjectForStorage(project, storedById.get(project.id))));
}

export async function saveProjects(projects: DashboardProject[]) {
  const storageProjects = mergeProjectsForStorage(projects);
  const serialized = JSON.stringify(storageProjects);
  if (typeof window === "undefined") {
    return storageProjects;
  }
  try {
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, serialized);
  } catch (error) {
    window.localStorage.removeItem(PROJECTS_STORAGE_KEY);
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, serialized);
  }
  return storageProjects;
}


export const browserProjectStorage = {
  capabilities: {
    kind: "browser",
    supportsProjectDirectory: false,
    supportsBackups: false,
    supportsNativeFolderPicker: false,
    supportsMigrationSource: true,
  },
  projectShapeCacheEntry,
  readStoredProjects,
  readProjects,
  saveProjects,
  loadProjectShapes,
  saveProjectShapes,
  deleteProjectShapes,
} satisfies ProjectStorage;
