/**
 * Shared config persistence pattern used by Viewer sources/views and Forms registry/field configs.
 * Domains stay separate; only the list/get/save contract is shared.
 */

export interface ConfigRepository<T> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  save(item: T): Promise<T>;
  delete?(id: string): Promise<void>;
}

export type ConfigBackendKind = "file" | "database";

export function resolveConfigBackendKind(databaseEnabled: boolean): ConfigBackendKind {
  return databaseEnabled ? "database" : "file";
}
