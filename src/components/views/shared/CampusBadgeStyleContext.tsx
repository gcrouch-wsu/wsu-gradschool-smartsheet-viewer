"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CampusBadgePresentationStyle } from "@/lib/config/types";

const CampusBadgeStyleContext = createContext<CampusBadgePresentationStyle | undefined>(undefined);

export function CampusBadgeStyleProvider({
  style,
  children,
}: {
  style?: CampusBadgePresentationStyle;
  children: ReactNode;
}) {
  return <CampusBadgeStyleContext.Provider value={style}>{children}</CampusBadgeStyleContext.Provider>;
}

export function useOptionalCampusBadgeStyle(): CampusBadgePresentationStyle | undefined {
  return useContext(CampusBadgeStyleContext);
}
