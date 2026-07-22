import { describe, expect, it } from "vitest";
import {
  canTriggerResendForColumn,
  findPendingContactEmail,
  findResendColumnForStage,
  isResendColumnTitle,
  isStandaloneResendColumn,
  resendMatchScore,
  resendTargetLabel,
  resolveResendPulseValues,
} from "@/lib/forms/resend";

describe("resend helpers", () => {
  it("detects RESEND columns", () => {
    expect(isResendColumnTitle("RESEND Student Approval")).toBe(true);
    expect(isResendColumnTitle("Resend Chair Approval")).toBe(true);
    expect(isResendColumnTitle("Student Approval")).toBe(false);
  });

  it("strips RESEND prefix", () => {
    expect(resendTargetLabel("RESEND Student Approval")).toBe("Student Approval");
  });

  it("treats Final PDF as a standalone resend helper", () => {
    expect(isStandaloneResendColumn("RESEND Final PDF")).toBe(true);
    expect(isStandaloneResendColumn("RESEND Chair Approval")).toBe(false);
    expect(canTriggerResendForColumn("RESEND Final PDF", { state: "complete" })).toBe(true);
    expect(canTriggerResendForColumn("RESEND Final PDF", null)).toBe(true);
  });

  it("only shows stage-linked resend when waiting at that stage", () => {
    expect(
      canTriggerResendForColumn("RESEND Chair Approval", { state: "current", stage: "CHR Approval" }),
    ).toBe(true);
    expect(
      canTriggerResendForColumn("RESEND Chair Approval", { state: "complete", stage: "CHR Approval" }),
    ).toBe(false);
  });

  it("matches RESEND Student Approval to Student Approval stage", () => {
    expect(resendMatchScore("RESEND Student Approval", "Student Approval")).toBeGreaterThanOrEqual(3);
    const hit = findResendColumnForStage(
      [
        { id: 1, title: "RESEND Student Approval" },
        { id: 2, title: "RESEND Final PDF" },
      ],
      "Student Approval",
    );
    expect(hit?.id).toBe(1);
  });

  it("matches RESEND Chair Approval to CHR Approval via synonym", () => {
    const hit = findResendColumnForStage(
      [
        { id: 1, title: "RESEND Chair Approval" },
        { id: 2, title: "RESEND Student Approval" },
      ],
      "CHR Approval",
    );
    expect(hit?.id).toBe(1);
  });

  it("does not match unrelated RESEND Final PDF to an approval stage", () => {
    const hit = findResendColumnForStage([{ id: 1, title: "RESEND Final PDF" }], "CHR Approval");
    expect(hit).toBeNull();
  });

  it("resolves pending contact email for a stage", () => {
    const email = findPendingContactEmail(
      [
        { id: 10, title: "Student Email", type: "TEXT_NUMBER" },
        { id: 11, title: "CHR Email", type: "TEXT_NUMBER" },
        { id: 12, title: "CHR Approval", type: "PICKLIST" },
      ],
      [
        { columnId: 10, value: "student@wsu.edu" },
        { columnId: 11, value: "chair@wsu.edu" },
      ],
      "CHR Approval",
    );
    expect(email).toBe("chair@wsu.edu");
  });

  it("pulses CHECKBOX with booleans", () => {
    const pulse = resolveResendPulseValues({ id: 1, title: "RESEND Student Approval", type: "CHECKBOX" });
    expect(pulse).toEqual(expect.objectContaining({ clear: false, set: true }));
    expect(pulse?.isArmed(true)).toBe(true);
    expect(pulse?.isArmed(false)).toBe(false);
  });

  it("pulses PICKLIST with listed Yes/No options (not booleans)", () => {
    const pulse = resolveResendPulseValues({
      id: 791433464549252,
      title: "RESEND Chair Approval",
      type: "PICKLIST",
      options: ["No", "Yes"],
    });
    expect(pulse?.clear).toBe("No");
    expect(pulse?.set).toBe("Yes");
    expect(pulse?.isArmed("Yes")).toBe(true);
    expect(pulse?.isArmed("No")).toBe(false);
  });

  it("returns null for PICKLIST with no options", () => {
    expect(
      resolveResendPulseValues({
        id: 1,
        title: "RESEND Chair Approval",
        type: "PICKLIST",
        options: [],
      }),
    ).toBeNull();
  });
});
