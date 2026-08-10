import { describe, expect, it } from "vitest";
import {
  classifyContributorAccountKind,
  labelForContributorAccountKind,
} from "@/lib/contributor-account-kinds";

describe("classifyContributorAccountKind", () => {
  const students = new Set(["student@wsu.edu"]);
  const contributors = new Set(["contributor@wsu.edu", "both@wsu.edu"]);
  students.add("both@wsu.edu");

  it("labels student-only emails", () => {
    expect(classifyContributorAccountKind("student@wsu.edu", students, contributors)).toBe("student");
  });

  it("labels contributor-only emails", () => {
    expect(classifyContributorAccountKind("contributor@wsu.edu", students, contributors)).toBe(
      "contributor",
    );
  });

  it("labels emails present as both", () => {
    expect(classifyContributorAccountKind("Both@wsu.edu", students, contributors)).toBe("both");
  });

  it("labels emails missing from sheets", () => {
    expect(classifyContributorAccountKind("gone@wsu.edu", students, contributors)).toBe("none");
  });
});

describe("labelForContributorAccountKind", () => {
  it("returns admin-facing labels", () => {
    expect(labelForContributorAccountKind("student")).toBe("Student");
    expect(labelForContributorAccountKind("contributor")).toBe("Contributor");
    expect(labelForContributorAccountKind("both")).toBe("Student & contributor");
    expect(labelForContributorAccountKind("none")).toBe("Not on sheet");
  });
});
