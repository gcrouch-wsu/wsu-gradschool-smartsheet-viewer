import * as configDb from "@/lib/config/config-db";

export const listSourceConfigs = () => configDb.listSourceConfigs();
export const listViewConfigs = () => configDb.listViewConfigs();
export const getSourceConfigById = (id: string) => configDb.getSourceConfigById(id);
export const getViewConfigById = (id: string) => configDb.getViewConfigById(id);
export const getPublicViewsBySlug = (slug: string, options?: { includePrivate?: boolean }) =>
  configDb.getPublicViewsBySlug(slug, options);
export const listPublicPageSummaries = () => configDb.listPublicPageSummaries();
