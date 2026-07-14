import { assertValidProjectId, ProjectRepository, validateStoredProject } from "./projectRepository";
import type { DesktopIpcError, DesktopIpcResult, DesktopProjectApi } from "./ipcContract";
import type { SaveProjectOptions, StoredProject } from "./types";

export function createProjectIpcHandlers(repository: ProjectRepository): DesktopProjectApi {
  return {
    listProjects: () => toIpcResult(() => repository.listProjects()),
    loadProject: (id: string) => toIpcResult(() => {
      assertValidProjectId(id);
      return repository.loadProject(id);
    }),
    saveProject: (project: StoredProject, options?: SaveProjectOptions) => toIpcResult(() => {
      validateStoredProject(project);
      validateSaveOptions(options);
      return repository.saveProject(project, options);
    }),
    deleteProject: (id: string) => toIpcResult(() => {
      assertValidProjectId(id);
      return repository.deleteProject(id);
    }),
    loadThumbnail: (projectId: string) => toIpcResult(() => {
      assertValidProjectId(projectId);
      return repository.loadThumbnail(projectId);
    }),
    saveThumbnail: (projectId: string, dataUrl: string) => toIpcResult(() => {
      assertValidProjectId(projectId);
      if (typeof dataUrl !== "string") throw new Error("Project thumbnail must be a PNG data URL");
      return repository.saveThumbnail(projectId, dataUrl);
    }),
    deleteThumbnail: (projectId: string) => toIpcResult(() => {
      assertValidProjectId(projectId);
      return repository.deleteThumbnail(projectId);
    }),
  };
}

async function toIpcResult<T>(operation: () => Promise<T> | T): Promise<DesktopIpcResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return { ok: false, error: ipcError(error) };
  }
}

function validateSaveOptions(options: SaveProjectOptions | undefined) {
  if (options === undefined) {
    return;
  }
  if (!options || typeof options !== "object") {
    throw new Error("Save options must be an object");
  }
  if (options.expectedRevision !== undefined && (typeof options.expectedRevision !== "number" || !Number.isFinite(options.expectedRevision))) {
    throw new Error("Save expectedRevision must be a finite number");
  }
}

function ipcError(error: unknown): DesktopIpcError {
  const message = error instanceof Error ? error.message : "Unknown desktop storage error";
  return {
    code: classifyError(error, message),
    message,
  };
}

function classifyError(error: unknown, message: string): DesktopIpcError["code"] {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "ENOENT") return "not_found";
    if (typeof error.code === "string" && error.code.startsWith("E")) return "io";
  }
  if (/project|payload|revision|schema|shapes|history|letters, numbers|options|thumbnail/i.test(message)) {
    return "validation";
  }
  return "unknown";
}
