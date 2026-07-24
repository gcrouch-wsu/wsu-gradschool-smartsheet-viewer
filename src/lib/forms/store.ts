/**
 * Forms config store facade — mirrors Viewer `src/lib/config/store.ts`.
 * Domain modules keep DB/file branching; this is the single import surface for callers.
 */
export { resolveConfigBackendKind } from "@/lib/config-repository";
export { isFormsDatabaseEnabled } from "@/lib/forms/db";

export {
  loadFormFields,
  saveFormFields,
  normalizeFormFieldConfig,
  type FormFieldConfig,
  type FormFieldDefinition,
  type FormFieldKindHint,
} from "@/lib/forms/store/field-config";

export { loadWorkflow, saveWorkflow } from "@/lib/forms/store/workflow-config";
export {
  loadConditionalRules,
  saveConditionalRules,
} from "@/lib/forms/store/conditional-rules";
