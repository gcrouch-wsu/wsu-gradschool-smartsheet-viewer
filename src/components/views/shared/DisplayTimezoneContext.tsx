"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { VIEW_DISPLAY_TIMEZONE_DEFAULT, isValidIanaTimeZone } from "@/lib/display-datetime";

type DisplayTimezoneContextValue = {
  timeZone: string;
  setTimeZone: (tz: string) => void;
};

const DisplayTimezoneContext = createContext<DisplayTimezoneContextValue | null>(null);

export function DisplayTimezoneProvider({
  children,
  timeZone,
}: {
  children: ReactNode;
  /** IANA zone from published view config (authoritative on public pages). */
  timeZone: string | undefined;
}) {
  const safe =
    typeof timeZone === "string" && timeZone.trim() && isValidIanaTimeZone(timeZone)
      ? timeZone.trim()
      : VIEW_DISPLAY_TIMEZONE_DEFAULT;
  const value = useMemo(
    () => ({
      timeZone: safe,
      setTimeZone: () => {},
    }),
    [safe],
  );

  return <DisplayTimezoneContext.Provider value={value}>{children}</DisplayTimezoneContext.Provider>;
}

export function useDisplayTimezone(): DisplayTimezoneContextValue {
  const ctx = useContext(DisplayTimezoneContext);
  if (!ctx) {
    return {
      timeZone: VIEW_DISPLAY_TIMEZONE_DEFAULT,
      setTimeZone: () => {},
    };
  }
  return ctx;
}
