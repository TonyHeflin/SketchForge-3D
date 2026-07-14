import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "./ipcContract";

const CHANNELS = {
  projects: {
    listProjects: "sketchforge:projects:list",
    loadProject: "sketchforge:projects:load",
    saveProject: "sketchforge:projects:save",
    deleteProject: "sketchforge:projects:delete",
    loadThumbnail: "sketchforge:projects:thumbnail:load",
    saveThumbnail: "sketchforge:projects:thumbnail:save",
    deleteThumbnail: "sketchforge:projects:thumbnail:delete",
  },
  settings: {
    getProjectDirectory: "sketchforge:settings:get-project-directory",
    chooseProjectDirectory: "sketchforge:settings:choose-project-directory",
  },
} as const;

const bridge: DesktopBridge = {
  projects: {
    listProjects: () => ipcRenderer.invoke(CHANNELS.projects.listProjects),
    loadProject: (id) => ipcRenderer.invoke(CHANNELS.projects.loadProject, id),
    saveProject: (project, options) => ipcRenderer.invoke(CHANNELS.projects.saveProject, project, options),
    deleteProject: (id) => ipcRenderer.invoke(CHANNELS.projects.deleteProject, id),
    loadThumbnail: (projectId) => ipcRenderer.invoke(CHANNELS.projects.loadThumbnail, projectId),
    saveThumbnail: (projectId, dataUrl) => ipcRenderer.invoke(CHANNELS.projects.saveThumbnail, projectId, dataUrl),
    deleteThumbnail: (projectId) => ipcRenderer.invoke(CHANNELS.projects.deleteThumbnail, projectId),
  },
  settings: {
    getProjectDirectory: () => ipcRenderer.invoke(CHANNELS.settings.getProjectDirectory),
    chooseProjectDirectory: () => ipcRenderer.invoke(CHANNELS.settings.chooseProjectDirectory),
  },
};

contextBridge.exposeInMainWorld("sketchforgeDesktop", bridge);
