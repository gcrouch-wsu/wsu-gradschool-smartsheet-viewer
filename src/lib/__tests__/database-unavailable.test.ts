import { describe, expect, it } from "vitest";
import {
  DATABASE_UNAVAILABLE_MESSAGE,
  DatabaseUnavailableError,
  isDatabaseConnectionFailure,
  isDatabaseUnavailableError,
} from "@/lib/database-unavailable";

describe("database unavailable", () => {
  it("recognizes a connection refusal, including aggregated socket errors", () => {
    const refused = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
      code: "ECONNREFUSED",
    });
    expect(isDatabaseConnectionFailure(refused)).toBe(true);
    expect(isDatabaseConnectionFailure(new AggregateError([refused], "connect"))).toBe(true);
    expect(isDatabaseConnectionFailure(new AggregateError([], "connect"))).toBe(true);
    expect(isDatabaseConnectionFailure(new Error("relation does not exist"))).toBe(false);
  });

  it("recognizes the message shown when the app cannot reach the database", () => {
    const error = new DatabaseUnavailableError();
    expect(error.message).toBe(DATABASE_UNAVAILABLE_MESSAGE);
    expect(isDatabaseUnavailableError(error)).toBe(true);
    expect(isDatabaseUnavailableError(new Error(DATABASE_UNAVAILABLE_MESSAGE))).toBe(true);
  });
});
