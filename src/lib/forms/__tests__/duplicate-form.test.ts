import { beforeEach, describe, expect, it, vi } from "vitest";

const getFormById = vi.fn();
const registerForm = vi.fn();
const copySheetToFolder = vi.fn();
const loadFormFields = vi.fn();
const saveFormFields = vi.fn();
const loadConditionalRules = vi.fn();
const saveConditionalRules = vi.fn();
const loadWorkflow = vi.fn();
const saveWorkflow = vi.fn();
const loadPdfMapping = vi.fn();
const loadPdfTemplateBytes = vi.fn();
const savePdfMappingFull = vi.fn();

vi.mock("@/lib/forms/registry", () => ({
  getFormById: (...args: unknown[]) => getFormById(...args),
  registerForm: (...args: unknown[]) => registerForm(...args),
}));

vi.mock("@/lib/forms/smartsheet-api", () => ({
  copySheetToFolder: (...args: unknown[]) => copySheetToFolder(...args),
}));

vi.mock("@/lib/forms/store/field-config", () => ({
  loadFormFields: (...args: unknown[]) => loadFormFields(...args),
  saveFormFields: (...args: unknown[]) => saveFormFields(...args),
}));

vi.mock("@/lib/forms/store/conditional-rules", () => ({
  loadConditionalRules: (...args: unknown[]) => loadConditionalRules(...args),
  saveConditionalRules: (...args: unknown[]) => saveConditionalRules(...args),
}));

vi.mock("@/lib/forms/store/workflow-config", () => ({
  loadWorkflow: (...args: unknown[]) => loadWorkflow(...args),
  saveWorkflow: (...args: unknown[]) => saveWorkflow(...args),
}));

vi.mock("@/lib/forms/store/pdf-mapping", () => ({
  loadPdfMapping: (...args: unknown[]) => loadPdfMapping(...args),
  loadPdfTemplateBytes: (...args: unknown[]) => loadPdfTemplateBytes(...args),
  savePdfMappingFull: (...args: unknown[]) => savePdfMappingFull(...args),
}));

describe("duplicateForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getFormById.mockImplementation(async (id: string) => {
      if (id === "111") {
        return {
          id: "111",
          name: "Leave Request",
          createdAt: "2026-01-01T00:00:00.000Z",
          source: "template",
          public: true,
          slug: "leave-request",
        };
      }
      if (id === "222") {
        return {
          id: "222",
          name: "Leave Request (copy)",
          createdAt: "2026-07-22T00:00:00.000Z",
          source: "template",
          public: false,
          slug: "leave-request-222",
        };
      }
      return null;
    });
    copySheetToFolder.mockResolvedValue({ result: { id: 222, name: "Leave Request (copy)" } });
    registerForm.mockResolvedValue(undefined);
    loadFormFields.mockResolvedValue({
      columns: ["Full Name"],
      formTitle: "Leave Request",
      fields: [{ columnTitle: "Full Name", order: 0 }],
    });
    loadConditionalRules.mockResolvedValue([{ whenColumn: "Type", equals: ["A"], showColumns: ["Notes"] }]);
    loadWorkflow.mockResolvedValue({
      approvalStages: ["Director Status"],
      overallColumn: "Overall Stage",
      approvedValues: ["Approved"],
      declinedValues: ["Declined"],
      excludeFromForm: [],
    });
    loadPdfMapping.mockResolvedValue({
      config: {
        enabled: true,
        outputFileName: "Leave.pdf",
        includeColumns: ["Full Name"],
      },
      templateName: null,
      hasTemplate: false,
    });
    loadPdfTemplateBytes.mockResolvedValue(null);
    saveFormFields.mockResolvedValue(undefined);
    saveConditionalRules.mockResolvedValue(undefined);
    saveWorkflow.mockResolvedValue(undefined);
    savePdfMappingFull.mockResolvedValue(undefined);
  });

  it("clones sheet and copies builder configs into an unpublished form", async () => {
    const { duplicateForm } = await import("@/lib/forms/duplicate-form");
    const result = await duplicateForm("111");

    expect(copySheetToFolder).toHaveBeenCalledWith(
      "111",
      "Leave Request (copy)",
      ["forms", "rules", "ruleRecipients", "filters"],
      undefined,
    );
    expect(registerForm).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "222",
        name: "Leave Request (copy)",
        source: "template",
        public: false,
      }),
      true,
    );
    expect(saveFormFields).toHaveBeenCalledWith(
      "222",
      expect.objectContaining({ formTitle: "Leave Request (copy)" }),
    );
    expect(saveConditionalRules).toHaveBeenCalledWith(
      [{ whenColumn: "Type", equals: ["A"], showColumns: ["Notes"] }],
      "222",
    );
    expect(saveWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ overallColumn: "Overall Stage" }),
      "222",
    );
    expect(savePdfMappingFull).toHaveBeenCalledWith(
      "222",
      expect.objectContaining({ enabled: true, outputFileName: "Leave.pdf" }),
      null,
      null,
    );
    expect(result.form.public).toBe(false);
    expect(result.copied).toEqual({
      fields: true,
      conditionalRules: true,
      workflow: true,
      pdfMapping: true,
    });
  });

  it("returns 404-style error when source form is missing", async () => {
    const { duplicateForm } = await import("@/lib/forms/duplicate-form");
    await expect(duplicateForm("missing")).rejects.toMatchObject({ status: 404 });
  });
});
