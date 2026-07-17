"use client";

import { Card, inputClass, secondaryBtnClass } from "@/components/forms/admin/AdminCard";

interface Workspace {
  id: number;
  name: string;
}

interface FolderChild {
  id: number;
  name: string;
  type: string;
}

interface OrgSharingCardProps {
  workspaces: Workspace[];
  folderChildren: FolderChild[];
  shareSheetEmail: string;
  onShareSheetEmailChange: (value: string) => void;
  onShare: () => void;
  shareMsg: string;
}

export function OrgSharingCard({
  workspaces,
  folderChildren,
  shareSheetEmail,
  onShareSheetEmailChange,
  onShare,
  shareMsg,
}: OrgSharingCardProps) {
  return (
    <Card title="Organization & sharing" description="Workspaces and folder placement for cloned forms.">
      <div>
        <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Workspaces</h3>
        <ul className="mt-2 space-y-1 text-sm text-[color:var(--wsu-ink)]">
          {workspaces.map((w) => (
            <li key={w.id}>
              {w.name} (ID {w.id})
            </li>
          ))}
        </ul>
      </div>
      {folderChildren.length ? (
        <div>
          <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Folder contents</h3>
          <ul className="mt-2 space-y-1 text-sm text-[color:var(--wsu-ink)]">
            {folderChildren.map((c) => (
              <li key={c.id}>
                {c.name} — {c.type} (ID {c.id})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Share active sheet</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="email"
            placeholder="user@wsu.edu"
            value={shareSheetEmail}
            onChange={(e) => onShareSheetEmailChange(e.target.value)}
            className={`min-w-0 flex-1 ${inputClass}`}
          />
          <button type="button" onClick={onShare} className={secondaryBtnClass}>
            Share
          </button>
        </div>
        {shareMsg ? <p className="mt-2 text-xs text-[color:var(--wsu-muted)]">{shareMsg}</p> : null}
      </div>
    </Card>
  );
}
