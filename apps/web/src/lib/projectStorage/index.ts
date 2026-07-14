export * from "./browserProjectStorage";
export * from "./desktopProjectStorage";
export * from "./types";

import { browserProjectStorage } from "./browserProjectStorage";
import { desktopProjectStorage, desktopProjectStorageAvailable } from "./desktopProjectStorage";
import type { ProjectStorage } from "./types";

export function getProjectStorage(): ProjectStorage {
  return desktopProjectStorageAvailable() ? desktopProjectStorage : browserProjectStorage;
}
