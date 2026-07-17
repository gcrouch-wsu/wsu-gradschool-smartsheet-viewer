"use client";

import { Card, inputClass, secondaryBtnClass } from "@/components/forms/admin/AdminCard";

interface Report {
  id: number;
  name: string;
  permalink?: string;
}

interface Dashboard {
  id: number;
  name: string;
  permalink?: string;
}

interface NativeForm {
  id: number;
  name: string;
  url?: string;
}

interface PlatformAssetsCardProps {
  reports: Report[];
  dashboards: Dashboard[];
  nativeForms: NativeForm[];
  rowToolRowId: string;
  onRowToolRowIdChange: (value: string) => void;
  rowToolSheetId: string;
  onRowToolSheetIdChange: (value: string) => void;
  rowToolMsg: string;
  onLoadPlatform: () => void;
  onCopyRow: () => void;
}

export function PlatformAssetsCard({
  reports,
  dashboards,
  nativeForms,
  rowToolRowId,
  onRowToolRowIdChange,
  rowToolSheetId,
  onRowToolSheetIdChange,
  rowToolMsg,
  onLoadPlatform,
  onCopyRow,
}: PlatformAssetsCardProps) {
  return (
    <Card title="Reports, dashboards & native forms">
      <button type="button" onClick={onLoadPlatform} className={secondaryBtnClass}>
        Load platform assets
      </button>
      <div>
        <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Reports</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {reports.map((r) => (
            <li key={r.id}>
              <a href={r.permalink || "#"} target="_blank" rel="noreferrer" className="text-wsu-crimson hover:underline">
                {r.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Dashboards</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {dashboards.map((d) => (
            <li key={d.id}>
              <a href={d.permalink || "#"} target="_blank" rel="noreferrer" className="text-wsu-crimson hover:underline">
                {d.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Native Smartsheet forms</h3>
        <ul className="mt-2 space-y-1 text-sm text-[color:var(--wsu-ink)]">
          {nativeForms.map((f) => (
            <li key={f.id}>
              {f.name}{" "}
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer" className="text-wsu-crimson hover:underline">
                  Open
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Row tools</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Row ID"
            value={rowToolRowId}
            onChange={(e) => onRowToolRowIdChange(e.target.value)}
            className={`min-w-[8rem] flex-1 ${inputClass}`}
          />
          <input
            type="text"
            placeholder="Target sheet ID"
            value={rowToolSheetId}
            onChange={(e) => onRowToolSheetIdChange(e.target.value)}
            className={`min-w-[8rem] flex-1 ${inputClass}`}
          />
          <button type="button" onClick={onCopyRow} className={secondaryBtnClass}>
            Copy row
          </button>
        </div>
        {rowToolMsg ? <p className="text-xs text-[color:var(--wsu-muted)]">{rowToolMsg}</p> : null}
      </div>
    </Card>
  );
}
