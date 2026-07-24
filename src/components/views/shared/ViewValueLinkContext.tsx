"use client";

import { createContext, useContext } from "react";

/** Defaults: email linked, phone plain (matches Smartsheet UX expectations). */
export const DEFAULT_VIEW_VALUE_LINK_FLAGS = {
  linkEmailsInView: true,
  linkPhonesInView: false,
} as const;

export type ViewValueLinkFlags = {
  linkEmailsInView: boolean;
  linkPhonesInView: boolean;
};

const ViewValueLinkContext = createContext<ViewValueLinkFlags>(DEFAULT_VIEW_VALUE_LINK_FLAGS);

export function ViewValueLinkProvider({
  value,
  children,
}: {
  value: ViewValueLinkFlags;
  children: React.ReactNode;
}) {
  return <ViewValueLinkContext.Provider value={value}>{children}</ViewValueLinkContext.Provider>;
}

export function useViewValueLinkFlags(): ViewValueLinkFlags {
  return useContext(ViewValueLinkContext);
}
