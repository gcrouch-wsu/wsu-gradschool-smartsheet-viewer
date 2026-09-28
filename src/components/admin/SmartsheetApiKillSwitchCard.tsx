"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Card } from "@/components/admin/WorkspacePrimitives";

type SettingState = {
  enabled: boolean;
  databaseConfigured: boolean;
  canToggle: boolean;
};

export function SmartsheetApiKillSwitchCard() {
  const [state, setState] = useState<SettingState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/settings/smartsheet-api", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as SettingState & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? "Unable to load Smartsheet API setting.");
          return;
        }
        if (!cancelled) {
          setState({
            enabled: Boolean(data.enabled),
            databaseConfigured: Boolean(data.databaseConfigured),
            canToggle: Boolean(data.canToggle),
          });
          setError("");
        }
      } catch {
        if (!cancelled) setError("Unable to load Smartsheet API setting.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle() {
    if (!state?.canToggle || pending) return;
    const next = !state.enabled;
    setNotice("");
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/settings/smartsheet-api", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: next }),
        });
        const data = (await res.json().catch(() => ({}))) as SettingState & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Unable to update Smartsheet API setting.");
          return;
        }
        setState({
          enabled: Boolean(data.enabled),
          databaseConfigured: Boolean(data.databaseConfigured),
          canToggle: Boolean(data.canToggle),
        });
        setNotice(
          data.enabled
            ? "Smartsheet API is on. Outbound calls are allowed."
            : "Smartsheet API is off. Outbound calls are blocked.",
        );
      } catch {
        setError("Unable to update Smartsheet API setting.");
      }
    });
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink">Smartsheet API</p>
          <p className="text-[12.5px] leading-5 text-sub">
            Turn off outbound Smartsheet calls across views and forms. Requires database config.
          </p>
          {state ? (
            <p className="text-xs text-mist">
              Status:{" "}
              <span className={state.enabled ? "text-ink" : "text-crimson"}>
                {state.enabled ? "On" : "Off"}
              </span>
              {!state.canToggle ? " · Toggle unavailable without DATABASE_URL" : null}
            </p>
          ) : (
            <p className="text-xs text-mist">Loading…</p>
          )}
          {notice ? <p className="text-xs text-ink">{notice}</p> : null}
          {error ? <p className="text-xs text-crimson">{error}</p> : null}
        </div>
        <Button
          variant={state && !state.enabled ? "primary" : "outline"}
          disabled={!state?.canToggle || pending}
          onClick={toggle}
        >
          {pending ? "Saving…" : state?.enabled === false ? "Turn on" : "Turn off"}
        </Button>
      </div>
    </Card>
  );
}
