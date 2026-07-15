import { CampusBadgeStrip } from "@/components/views/shared/CampusBadgeStrip";
import { FieldBlock } from "@/components/views/layouts/FieldBlock";
import { FieldValue } from "@/components/views/layouts/FieldValue";
import {
  ContributorGroupFieldControl,
  ContributorReadOnlyField,
  ContributorSingleFieldControl,
} from "@/components/views/contributor/ContributorFieldControl";
import type { CardLayoutCell } from "@/components/views/layouts/layout-utils";
import { fieldLabelClassName } from "@/lib/field-typography";
import type { ContributorEditableFieldDefinition, MultiPersonEntry, MultiPersonFieldErrors } from "@/lib/contributor-utils";
import type { EditableFieldGroup } from "@/lib/config/types";

const staticLabelClass = "view-field-label text-[color:var(--wsu-muted)]";

export type CardLayoutCellMode = "full" | "header" | "value" | "edit";

export function CardLayoutCellRenderer({
  cell,
  flexClass,
  mode = "full",
  editProps,
}: {
  cell: CardLayoutCell;
  flexClass?: string;
  mode?: CardLayoutCellMode;
  editProps?: {
    editableDef?: ContributorEditableFieldDefinition;
    group?: EditableFieldGroup;
    value?: string;
    persons?: MultiPersonEntry[];
    errors?: Record<number, MultiPersonFieldErrors>;
    onChangeValue?: (val: string) => void;
    onChangePersons?: (persons: MultiPersonEntry[]) => void;
    /** When the grid already rendered `field.label` in the header row (aligned card edit), hide the control's title to avoid duplicate labels. */
    suppressDuplicateTitle?: boolean;
  };
}) {
  const baseClass = flexClass ?? "min-w-0 flex-1";

  if (cell.type === "placeholder") {
    return <div key="placeholder" className={baseClass} aria-hidden />;
  }

  if (cell.type === "text") {
    if (mode === "value" || mode === "edit") return <div key={`text-val-${cell.label}`} className={baseClass} aria-hidden />;
    return (
      <div key={`text-${cell.label}`} className={`${baseClass} space-y-0.5`}>
        <p className={`${staticLabelClass} leading-tight`}>{cell.label}</p>
      </div>
    );
  }

  if (cell.type === "campus_badges") {
    if (mode === "header") {
      // No campuses → keep the grid slot empty so column positions stay aligned.
      if (cell.campuses.length === 0) {
        return <div key="campus-badges-h" className={baseClass} aria-hidden />;
      }
      return (
        <div key="campus-badges-h" className={baseClass}>
          <p className={`${staticLabelClass} leading-tight`}>Campuses</p>
        </div>
      );
    }
    if (mode === "value" || mode === "edit") {
      return (
        <div key="campus-badges-v" className={baseClass}>
          <CampusBadgeStrip campuses={cell.campuses} badgeStyle={cell.style} className="mt-0" />
        </div>
      );
    }
    return (
      <div key="campus-badges" className={baseClass}>
        <CampusBadgeStrip campuses={cell.campuses} badgeStyle={cell.style} className="mt-0" />
      </div>
    );
  }

  if (mode === "header") {
    return (
      <div key={`${cell.field.key}-h`} className={baseClass}>
        {!cell.field.hideLabel && (
          <p className={fieldLabelClassName(cell.field, "leading-tight")}>{cell.field.label}</p>
        )}
      </div>
    );
  }

  if (mode === "value") {
    return (
      <div key={`${cell.field.key}-v`} className={baseClass}>
        <FieldValue field={cell.field} stacked />
      </div>
    );
  }

  if (mode === "edit" && editProps) {
    const suppressDup = editProps.suppressDuplicateTitle === true;
    return (
      <div key={`${cell.field.key}-edit`} className={baseClass}>
        {editProps.group ? (
          <ContributorGroupFieldControl
            group={editProps.group}
            persons={editProps.persons ?? []}
            onChange={editProps.onChangePersons ?? (() => {})}
            errors={editProps.errors}
            suppressDuplicateGroupTitle={suppressDup}
          />
        ) : editProps.editableDef ? (
          <ContributorSingleFieldControl
            field={cell.field}
            editableDef={editProps.editableDef}
            value={editProps.value ?? ""}
            onChange={editProps.onChangeValue ?? (() => {})}
            suppressDuplicateTitle={suppressDup}
          />
        ) : (
          <ContributorReadOnlyField field={cell.field} suppressTitle={suppressDup} />
        )}
      </div>
    );
  }

  return (
    <div key={cell.field.key} className={baseClass}>
      <FieldBlock field={cell.field} compact />
    </div>
  );
}
