export type StoredProject = {
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

export type ProjectSummary = Pick<StoredProject, "id" | "name" | "createdAt" | "updatedAt" | "revision"> & {
  shapes: number;
};

export type ProjectFileError = {
  fileName: string;
  message: string;
};

export type ProjectListResult = {
  projects: ProjectSummary[];
  errors: ProjectFileError[];
};

export type SaveProjectResult =
  | { ok: true; project: StoredProject }
  | {
      ok: false;
      code: "conflict";
      projectId: string;
      expectedRevision: number;
      actualRevision: number;
      diskProject: StoredProject;
    };

export type SaveProjectOptions = {
  expectedRevision?: number;
};

export type ProjectThumbnailResult = {
  projectId: string;
  dataUrl: string;
  version: number;
};
