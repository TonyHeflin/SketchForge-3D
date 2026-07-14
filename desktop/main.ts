import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ProjectRepository } from "./projectRepository";
import { createProjectIpcHandlers } from "./projectIpcHandlers";
import { SettingsRepository } from "./settingsRepository";

const PROJECT_CHANNELS = {
  listProjects: "sketchforge:projects:list",
  loadProject: "sketchforge:projects:load",
  saveProject: "sketchforge:projects:save",
  deleteProject: "sketchforge:projects:delete",
  loadThumbnail: "sketchforge:projects:thumbnail:load",
  saveThumbnail: "sketchforge:projects:thumbnail:save",
  deleteThumbnail: "sketchforge:projects:thumbnail:delete",
} as const;

const SETTINGS_CHANNELS = {
  getProjectDirectory: "sketchforge:settings:get-project-directory",
  chooseProjectDirectory: "sketchforge:settings:choose-project-directory",
} as const;

let mainWindow: BrowserWindow | null = null;
let projectRepository: ProjectRepository;
let projectHandlers: ReturnType<typeof createProjectIpcHandlers>;
let settingsRepository: SettingsRepository;

function defaultProjectDirectory() {
  return path.join(app.getPath("documents"), "SketchForge Projects");
}

async function configureRepositories(projectDirectory?: string) {
  const settingsPath = path.join(app.getPath("userData"), "settings.json");
  settingsRepository = new SettingsRepository(settingsPath, { projectDirectory: defaultProjectDirectory() });
  const settings = projectDirectory ? { projectDirectory } : await settingsRepository.read();
  await settingsRepository.write(settings);
  projectRepository = new ProjectRepository(settings.projectDirectory);
  await projectRepository.ensureLayout();
  projectHandlers = createProjectIpcHandlers(projectRepository);
  return settings.projectDirectory;
}

function registerIpcHandlers() {
  ipcMain.handle(PROJECT_CHANNELS.listProjects, () => projectHandlers.listProjects());
  ipcMain.handle(PROJECT_CHANNELS.loadProject, (_event, id: string) => projectHandlers.loadProject(id));
  ipcMain.handle(PROJECT_CHANNELS.saveProject, (_event, project, options) => projectHandlers.saveProject(project, options));
  ipcMain.handle(PROJECT_CHANNELS.deleteProject, (_event, id: string) => projectHandlers.deleteProject(id));
  ipcMain.handle(PROJECT_CHANNELS.loadThumbnail, (_event, projectId: string) => projectHandlers.loadThumbnail(projectId));
  ipcMain.handle(PROJECT_CHANNELS.saveThumbnail, (_event, projectId: string, dataUrl: string) => projectHandlers.saveThumbnail(projectId, dataUrl));
  ipcMain.handle(PROJECT_CHANNELS.deleteThumbnail, (_event, projectId: string) => projectHandlers.deleteThumbnail(projectId));

  ipcMain.handle(SETTINGS_CHANNELS.getProjectDirectory, async () => ({ ok: true, value: (await settingsRepository.read()).projectDirectory }));
  ipcMain.handle(SETTINGS_CHANNELS.chooseProjectDirectory, async () => {
    const dialogOptions = {
      title: "Choose SketchForge Projects Folder",
      properties: ["openDirectory", "createDirectory"] as Array<"openDirectory" | "createDirectory">,
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || !result.filePaths[0]) {
      return { ok: true, value: null };
    }
    const projectDirectory = await configureRepositories(result.filePaths[0]);
    return { ok: true, value: projectDirectory };
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  const devUrl = process.env.SKETCHFORGE_DESKTOP_DEV_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
    return;
  }

  const appPath = app.getAppPath();
  const indexPath = path.join(appPath, "apps", "web", "out", "index.html");
  await mainWindow.loadURL(pathToFileURL(indexPath).toString());
}

app.whenReady().then(async () => {
  await configureRepositories();
  registerIpcHandlers();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
