"use client";

import { ADMIN_PASSWORD_POLICY_MESSAGE } from "@/lib/admin-auth";
import { Alert, Card, inputClass, primaryBtnClass, secondaryBtnClass } from "@/components/forms/admin/AdminCard";
import { DataTable, type DataTableColumn } from "@/components/ui/Table";

interface ApproverSummary {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface ApproversCardProps {
  approvers: ApproverSummary[];
  approverEmail: string;
  onApproverEmailChange: (value: string) => void;
  approverPassword: string;
  onApproverPasswordChange: (value: string) => void;
  approverMsg: { ok: boolean; text: string } | null;
  resetPasswordId: string;
  onResetPasswordIdChange: (value: string) => void;
  resetPassword: string;
  onResetPasswordChange: (value: string) => void;
  onLoadApprovers: () => void;
  onCreateApprover: () => void;
  onDeleteApprover: (id: string) => void;
  onResetPassword: () => void;
}

export function ApproversCard({
  approvers,
  approverEmail,
  onApproverEmailChange,
  approverPassword,
  onApproverPasswordChange,
  approverMsg,
  resetPasswordId,
  onResetPasswordIdChange,
  resetPassword,
  onResetPasswordChange,
  onLoadApprovers,
  onCreateApprover,
  onDeleteApprover,
  onResetPassword,
}: ApproversCardProps) {
  return (
    <Card
      title="Approver accounts"
      description={`Create email/password accounts for approvers who need tracker access without admin credentials. Password requirement: ${ADMIN_PASSWORD_POLICY_MESSAGE.replace("Admin password must be ", "")}`}
    >
      <button type="button" onClick={onLoadApprovers} className={secondaryBtnClass}>
        Refresh list
      </button>
      {approvers.length === 0 ? (
        <p className="text-sm text-[color:var(--wsu-muted)]">No approver accounts yet.</p>
      ) : (
        <DataTable
          columns={
            [
              {
                id: "email",
                header: "Email",
                headerClassName: "px-3 py-2",
                cellClassName: "px-3 py-2 font-medium",
                cell: (a) => a.email,
              },
              {
                id: "created",
                header: "Created",
                headerClassName: "px-3 py-2",
                cellClassName: "px-3 py-2 text-[color:var(--wsu-muted)]",
                cell: (a) => new Date(a.createdAt).toLocaleDateString(),
              },
              {
                id: "actions",
                header: <span className="sr-only">Actions</span>,
                headerClassName: "px-3 py-2",
                cellClassName: "px-3 py-2 text-right",
                cell: (a) => (
                  <button
                    type="button"
                    onClick={() => onDeleteApprover(a.id)}
                    className="text-xs font-medium text-red-700 hover:underline"
                  >
                    Delete
                  </button>
                ),
              },
            ] satisfies DataTableColumn<ApproverSummary>[]
          }
          data={approvers}
          getRowKey={(a) => a.id}
          minWidth={400}
          containerClassName="rounded-lg border border-[color:var(--wsu-border)]"
        />
      )}
      <div>
        <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Create approver</h3>
        <div className="mt-2 space-y-3">
          <div>
            <label htmlFor="approverEmail" className="mb-1 block text-xs text-[color:var(--wsu-muted)]">
              Email
            </label>
            <input
              id="approverEmail"
              type="email"
              value={approverEmail}
              onChange={(e) => onApproverEmailChange(e.target.value)}
              placeholder="approver@wsu.edu"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="approverPassword" className="mb-1 block text-xs text-[color:var(--wsu-muted)]">
              Password
            </label>
            <input
              id="approverPassword"
              type="password"
              value={approverPassword}
              onChange={(e) => onApproverPasswordChange(e.target.value)}
              className={inputClass}
            />
          </div>
          <button type="button" onClick={onCreateApprover} className={primaryBtnClass}>
            Create approver
          </button>
        </div>
      </div>
      <div>
        <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Reset password</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={resetPasswordId}
            onChange={(e) => onResetPasswordIdChange(e.target.value)}
            className={`min-w-[10rem] flex-1 ${inputClass}`}
          >
            <option value="">Select approver…</option>
            {approvers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </select>
          <input
            type="password"
            placeholder="New password"
            value={resetPassword}
            onChange={(e) => onResetPasswordChange(e.target.value)}
            className={`min-w-[10rem] flex-1 ${inputClass}`}
          />
          <button type="button" onClick={onResetPassword} className={secondaryBtnClass}>
            Reset
          </button>
        </div>
      </div>
      {approverMsg ? <Alert ok={approverMsg.ok} text={approverMsg.text} /> : null}
    </Card>
  );
}
