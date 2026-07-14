import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProjectFileError, ProjectListResult, ProjectSummary, ProjectThumbnailResult, SaveProjectOptions, SaveProjectResult, StoredProject } from "./types";

const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const PROJECT_EXTENSION = ".sketchforge";
const BACKUP_LIMIT = 10;
const PROJECT_DIRECTORY_SETTINGS = { schemaVersion: 1, kind: "sketchforge-project-directory" } as const;

export class ProjectRepository {
  readonly rootDirectory: string;
  readonly projectsDirectory: string;
  readonly backupsDirectory: string;
  readonly thumbnailsDirectory: string;
  readonly settingsPath: string;

  constructor(rootDirectory: string) {
    this.rootDirectory = rootDirectory;
    this.projectsDirectory = path.join(rootDirectory, "projects");
    this.backupsDirectory = path.join(rootDirectory, "backups");
    this.thumbnailsDirectory = path.join(rootDirectory, "thumbnails");
    this.settingsPath = path.join(rootDirectory, "settings.json");
  }

  async ensureLayout() {
    await mkdir(this.projectsDirectory, { recursive: true });
    await mkdir(this.backupsDirectory, { recursive: true });
    await mkdir(this.thumbnailsDirectory, { recursive: true });
    await this.ensureProjectDirectorySettings();
  }

  async listProjects(): Promise<ProjectListResult> {
    await this.ensureLayout();
    await this.removeStaleTempFiles();

    const projects: ProjectSummary[] = [];
    const errors: ProjectFileError[] = [];
    const entries = await readdir(this.projectsDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(PROJECT_EXTENSION)) {
        continue;
      }

      try {
        const project = await this.readProjectFile(path.join(this.projectsDirectory, entry.name));
        projects.push(projectSummary(project));
      } catch (error) {
        errors.push({ fileName: entry.name, message: errorMessage(error) });
      }
    }

    projects.sort((left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name));
    return { projects, errors };
  }

  async loadProject(id: string): Promise<StoredProject | null> {
    assertValidProjectId(id);
    await this.ensureLayout();
    await this.removeStaleTempFiles(id);

    const filePath = this.projectPath(id);
    try {
      return await this.readProjectFile(filePath);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  async saveProject(project: StoredProject, options: SaveProjectOptions = {}): Promise<SaveProjectResult> {
    validateStoredProject(project);
    await this.ensureLayout();
    await this.removeStaleTempFiles(project.id);

    const serialized = serializeProject(project);
    const destination = this.projectPath(project.id);
    const existing = await this.loadProject(project.id);
    const expectedRevision = options.expectedRevision;

    if (existing && expectedRevision !== undefined && existing.revision > expectedRevision) {
      return {
        ok: false,
        code: "conflict",
        projectId: project.id,
        expectedRevision,
        actualRevision: existing.revision,
        diskProject: existing,
      };
    }

    if (existing) {
      await this.createBackup(project.id, destination);
    }

    const temporaryPath = path.join(this.projectsDirectory, `.${project.id}.${process.pid}.${randomUUID()}.tmp`);
    await writeFile(temporaryPath, serialized, "utf8");
    await rename(temporaryPath, destination);

    return { ok: true, project };
  }


  async loadThumbnail(projectId: string): Promise<ProjectThumbnailResult | null> {
    assertValidProjectId(projectId);
    await this.ensureLayout();
    try {
      const filePath = this.thumbnailPath(projectId);
      const [contents, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
      return {
        projectId,
        dataUrl: `data:image/png;base64,${contents.toString("base64")}`,
        version: Math.trunc(fileStat.mtimeMs),
      };
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }

  async saveThumbnail(projectId: string, dataUrl: string): Promise<ProjectThumbnailResult> {
    assertValidProjectId(projectId);
    await this.ensureLayout();
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    if (base64 === dataUrl || !base64.trim()) {
      throw new Error("Project thumbnail must be a PNG data URL");
    }
    const filePath = this.thumbnailPath(projectId);
    await writeFile(filePath, Buffer.from(base64, "base64"));
    return { projectId, dataUrl, version: Date.now() };
  }

  async deleteThumbnail(projectId: string) {
    assertValidProjectId(projectId);
    await rm(this.thumbnailPath(projectId), { force: true });
  }

  async deleteProject(id: string) {
    assertValidProjectId(id);
    await this.ensureLayout();
    await rm(this.projectPath(id), { force: true });
  }

  projectPath(id: string) {
    assertValidProjectId(id);
    return path.join(this.projectsDirectory, `${id}${PROJECT_EXTENSION}`);
  }

  thumbnailPath(id: string) {
    assertValidProjectId(id);
    return path.join(this.thumbnailsDirectory, `${id}.png`);
  }

  private async readProjectFile(filePath: string) {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    validateStoredProject(parsed);
    return parsed;
  }

  private async ensureProjectDirectorySettings() {
    try {
      await readFile(this.settingsPath, "utf8");
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      await writeFile(this.settingsPath, `${JSON.stringify(PROJECT_DIRECTORY_SETTINGS, null, 2)}\n`, "utf8");
    }
  }

  private async createBackup(projectId: string, sourcePath: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `${projectId}.${timestamp}.${randomUUID()}${PROJECT_EXTENSION}`;
    await copyFile(sourcePath, path.join(this.backupsDirectory, backupName));
    await this.pruneBackups(projectId);
  }

  private async pruneBackups(projectId: string) {
    const entries = await readdir(this.backupsDirectory, { withFileTypes: true });
    const backups = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.startsWith(`${projectId}.`) && entry.name.endsWith(PROJECT_EXTENSION))
        .map(async (entry) => {
          const filePath = path.join(this.backupsDirectory, entry.name);
          return { filePath, mtimeMs: (await stat(filePath)).mtimeMs };
        }),
    );

    backups.sort((left, right) => right.mtimeMs - left.mtimeMs);
    await Promise.all(backups.slice(BACKUP_LIMIT).map((backup) => rm(backup.filePath, { force: true })));
  }

  private async removeStaleTempFiles(projectId?: string) {
    const prefix = projectId ? `.${projectId}.` : ".";
    const entries = await readdir(this.projectsDirectory, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith(".tmp"))
        .map((entry) => rm(path.join(this.projectsDirectory, entry.name), { force: true })),
    );
  }
}

export function validateStoredProject(project: unknown): asserts project is StoredProject {
  if (!project || typeof project !== "object") {
    throw new Error("Project payload must be an object");
  }

  const candidate = project as Partial<StoredProject>;
  if (candidate.schemaVersion !== 1) {
    throw new Error("Unsupported project schema version");
  }
  if (typeof candidate.id !== "string") {
    throw new Error("Project id must be a string");
  }
  assertValidProjectId(candidate.id);
  if (typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
    throw new Error("Project name is required");
  }
  assertFiniteNumber(candidate.createdAt, "Project createdAt must be a finite number");
  assertFiniteNumber(candidate.updatedAt, "Project updatedAt must be a finite number");
  assertFiniteNumber(candidate.revision, "Project revision must be a finite number");
  assertRequiredProperty(candidate, "workspace", "Project workspace is required");
  assertRequiredProperty(candidate, "snapGrid", "Project snapGrid is required");
  if (!Array.isArray(candidate.shapes)) {
    throw new Error("Project shapes must be an array");
  }
  if (!Array.isArray(candidate.history)) {
    throw new Error("Project history must be an array");
  }
  if (typeof candidate.historyIndex !== "number" || !Number.isInteger(candidate.historyIndex) || candidate.historyIndex < 0) {
    throw new Error("Project historyIndex must be a non-negative integer");
  }
}

export function assertValidProjectId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !PROJECT_ID_PATTERN.test(id)) {
    throw new Error("Project id may only contain letters, numbers, underscores, and hyphens");
  }
}

function serializeProject(project: StoredProject) {
  return `${JSON.stringify(project, null, 2)}\n`;
}

function projectSummary(project: StoredProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    revision: project.revision,
    shapes: project.shapes.length,
  };
}

function assertFiniteNumber(value: unknown, message: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(message);
  }
}

function assertRequiredProperty(project: Partial<StoredProject>, property: keyof StoredProject, message: string) {
  if (!Object.prototype.hasOwnProperty.call(project, property)) {
    throw new Error(message);
  }
}

function isNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown project file error";
}
