import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type DesktopSettings = {
  projectDirectory: string;
};

export class SettingsRepository {
  constructor(
    private readonly settingsPath: string,
    private readonly defaults: DesktopSettings,
  ) {}

  async read(): Promise<DesktopSettings> {
    try {
      const parsed = JSON.parse(await readFile(this.settingsPath, "utf8")) as Partial<DesktopSettings>;
      if (typeof parsed.projectDirectory === "string" && parsed.projectDirectory.trim()) {
        return { projectDirectory: parsed.projectDirectory };
      }
    } catch {
      // Fall back to defaults when settings are missing or malformed.
    }
    return this.defaults;
  }

  async write(settings: DesktopSettings) {
    await mkdir(path.dirname(this.settingsPath), { recursive: true });
    await writeFile(this.settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  }
}
