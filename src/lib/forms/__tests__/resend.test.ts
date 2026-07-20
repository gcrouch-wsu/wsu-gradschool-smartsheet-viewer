import { describe, expect, it } from "vitest";
import {
  findPendingContactEmail,
  findResendColumnForStage,
  isResendColumnTitle,
  resendMatchScore,
  resendTargetLabel,
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
});
