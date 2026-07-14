import type { EditorHistoryEntry } from "@/lib/editorHistory";
import type { GridSize, WorkplaneShape, WorkplaneWorkspaceSettings } from "@/types/sketchforge";

export type DashboardProject = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  shapes: number;
  accent: "cyan" | "green" | "gold" | "red";
  thumbnailUrl?: string | null;
  thumbnailVersion?: number;
  revision?: number;
  workspace?: WorkplaneWorkspaceSettings;
  snapGrid?: GridSize;
};

export type StoredDashboardProject = Partial<DashboardProject> & {
  designShapes?: unknown;
};

export type ProjectShapeCacheEntry = {
  revision: number;
  shapes: WorkplaneShape[];
  history: EditorHistoryEntry[];
  historyIndex: number;
};

export type ProjectShapeRecord = {
  id: string;
  revision: number;
  shapes: WorkplaneShape[];
  history?: EditorHistoryEntry[];
  historyIndex?: number;
  updatedAt: number;
};

export type StoredProjectsSnapshot = {
  projects: DashboardProject[];
  legacyShapes: Record<string, ProjectShapeCacheEntry>;
};

export type ProjectStorageCapabilities = {
  kind: "browser" | "desktop";
  supportsProjectDirectory: boolean;
  supportsBackups: boolean;
  supportsNativeFolderPicker: boolean;
  supportsMigrationSource: boolean;
};

export interface ProjectStorage {
  capabilities: ProjectStorageCapabilities;
  projectShapeCacheEntry(
    revision: number,
    shapes: WorkplaneShape[],
    history?: ProjectShapeCacheEntry["history"],
    historyIndex?: number,
  ): ProjectShapeCacheEntry;
  readStoredProjects(): Promise<StoredProjectsSnapshot>;
  readProjects(): Promise<DashboardProject[]>;
  saveProjects(projects: DashboardProject[]): Promise<DashboardProject[]>;
  loadProjectShapes(projectId: string): Promise<ProjectShapeRecord | null>;
  saveProjectShapes(projectId: string, entry: ProjectShapeCacheEntry): Promise<void>;
  deleteProjectShapes(projectId: string): Promise<void>;
  getProjectDirectory?(): Promise<string | null>;
  chooseProjectDirectory?(): Promise<string | null>;
  loadProjectThumbnail?(projectId: string): Promise<{ dataUrl: string; version: number } | null>;
  saveProjectThumbnail?(projectId: string, dataUrl: string): Promise<{ dataUrl: string; version: number }>;
  deleteProjectThumbnail?(projectId: string): Promise<void>;
}
