"use client";

import { useState } from "react";
import { Button, TableShell } from "@/components/admin/WorkspacePrimitives";
import { useToast } from "@/components/ui/Toast";
import type { PrincipalCapability } from "@/lib/identity/principal";
import type { RolePermissionMatrix } from "@/lib/platform-user-types";
import { OWNER_LOCKED_CAPABILITIES } from "@/lib/platform-user-types";

interface RolesMatrixManagerProps {
  initialMatrix: RolePermissionMatrix;
}

const CAPABILITY_LABELS: Record<PrincipalCapability, string> = {
  "admin.manage": "Admin workspace",
  "admin.owner": "Owner",
  "forms.admin": "Forms admin",
  "forms.approver": "Form approver",
  "forms.coordinator": "Coordinator",
  "forms.student": "Student portal",
  "contributor.edit": "Contributor edit",
  viewer: "Viewer",
};

export function RolesMatrixManager({ initialMatrix }: RolesMatrixManagerProps) {
  const { addToast } = useToast();
  const [matrix, setMatrix] = useState(initialMatrix);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  function toggle(roleId: string, capability: PrincipalCapability) {
    if (roleId === "owner" && (OWNER_LOCKED_CAPABILITIES as readonly string[]).includes(capability)) {
      addToast("Owner always keeps admin.owner and admin.manage.", "error");
      return;
    }
    setMatrix((prev) => ({
      ...prev,
      matrix: {
        ...prev.matrix,
        [roleId]: {
          ...prev.matrix[roleId],
          [capability]: !prev.matrix[roleId]?.[capability],
        },
      },
    }));
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    try {
      const updates: Record<string, string[]> = {};
      for (const role of matrix.roles) {
        updates[role.id] = matrix.capabilities.filter((c) => matrix.matrix[role.id]?.[c]);
      }
      const res = await fetch("/api/admin/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const body = (await res.json().catch(() => null)) as RolePermissionMatrix & { message?: string };
      if (!res.ok) {
        addToast(body?.message ?? "Unable to save roles.", "error");
        return;
      }
      setMatrix(body);
      setDirty(false);
      addToast("Role permissions saved.", "success");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-mist">
          Turn capabilities on or off per role. Changes apply on the next request for signed-in users.
        </p>
        <Button type="button" onClick={save} disabled={busy || !dirty}>
          Save changes
        </Button>
      </div>

      <TableShell>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-[#faf7f8] text-xs uppercase tracking-wide text-mist">
              <tr>
                <th className="sticky left-0 bg-[#faf7f8] px-4 py-3 font-medium">Role</th>
                {matrix.capabilities.map((cap) => (
                  <th key={cap} className="px-3 py-3 font-medium">
                    {CAPABILITY_LABELS[cap] ?? cap}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.roles.map((role) => (
                <tr key={role.id} className="border-b border-line last:border-0">
                  <td className="sticky left-0 bg-white px-4 py-3">
                    <div className="font-medium text-ink">{role.label}</div>
                    {role.description ? <div className="text-xs text-mist">{role.description}</div> : null}
                  </td>
                  {matrix.capabilities.map((cap) => {
                    const locked =
                      role.id === "owner" &&
                      (OWNER_LOCKED_CAPABILITIES as readonly string[]).includes(cap);
                    const checked = Boolean(matrix.matrix[role.id]?.[cap]);
                    return (
                      <td key={cap} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={locked || busy}
                          onChange={() => toggle(role.id, cap)}
                          aria-label={`${role.label} ${cap}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableShell>
    </div>
  );
}
