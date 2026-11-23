import type { SourceConfig, ViewConfig } from "@/lib/config/types";
import * as configDb from "@/lib/config/config-db";

export const saveSourceConfig = (config: SourceConfig) => configDb.saveSourceConfig(config);
export const saveViewConfig = (config: ViewConfig) => configDb.saveViewConfig(config);
export const deleteSourceConfig = (sourceId: string) => configDb.deleteSourceConfig(sourceId);
export const deleteViewConfig = (viewId: string) => configDb.deleteViewConfig(viewId);
export const updateViewPublication = (viewId: string, isPublic: boolean) =>
  configDb.updateViewPublication(viewId, isPublic);
