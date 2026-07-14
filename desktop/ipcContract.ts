import type { ProjectListResult, ProjectThumbnailResult, SaveProjectOptions, SaveProjectResult, StoredProject } from "./types";

export type DesktopIpcErrorCode = "validation" | "not_found" | "io" | "unknown";

export type DesktopIpcError = {
  code: DesktopIpcErrorCode;
  message: string;
};

export type DesktopIpcResult<T> = { ok: true; value: T } | { ok: false; error: DesktopIpcError };

export type DesktopProjectApi = {
  listProjects(): Promise<DesktopIpcResult<ProjectListResult>>;
  loadProject(id: string): Promise<DesktopIpcResult<StoredProject | null>>;
  saveProject(project: StoredProject, options?: SaveProjectOptions): Promise<DesktopIpcResult<SaveProjectResult>>;
  deleteProject(id: string): Promise<DesktopIpcResult<void>>;
  loadThumbnail(projectId: string): Promise<DesktopIpcResult<ProjectThumbnailResult | null>>;
  saveThumbnail(projectId: string, dataUrl: string): Promise<DesktopIpcResult<ProjectThumbnailResult>>;
  deleteThumbnail(projectId: string): Promise<DesktopIpcResult<void>>;
};

export type DesktopSettingsApi = {
  getProjectDirectory(): Promise<DesktopIpcResult<string>>;
  chooseProjectDirectory(): Promise<DesktopIpcResult<string | null>>;
};

export type DesktopBridge = {
  projects: DesktopProjectApi;
  settings: DesktopSettingsApi;
};

export const DESKTOP_PROJECT_API_METHODS = ["listProjects", "loadProject", "saveProject", "deleteProject", "loadThumbnail", "saveThumbnail", "deleteThumbnail"] as const satisfies readonly (keyof DesktopProjectApi)[];
