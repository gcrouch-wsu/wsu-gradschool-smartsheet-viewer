export const DATABASE_UNAVAILABLE_MESSAGE = "App not connected to database";

const CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

/** node-postgres pool errors often have no `code`; the message is the signal. */
const CONNECTION_MESSAGE_FRAGMENTS = [
  "connection terminated",
  "timeout exceeded when trying to connect",
];

export class DatabaseUnavailableError extends Error {
  constructor() {
    super(DATABASE_UNAVAILABLE_MESSAGE);
    this.name = "DatabaseUnavailableError";
  }
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  return (
    error instanceof DatabaseUnavailableError ||
    (error instanceof Error && error.message === DATABASE_UNAVAILABLE_MESSAGE)
  );
}

/** True when a driver error means Postgres could not be reached. */
export function isDatabaseConnectionFailure(error: unknown): boolean {
  if (isDatabaseUnavailableError(error)) return true;
  if (!error || typeof error !== "object") return false;

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  if (CONNECTION_CODES.has(code)) return true;

  const message = "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";
  if (CONNECTION_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment))) return true;

  if (error instanceof AggregateError) {
    const nested = Array.isArray(error.errors) ? error.errors : [];
    if (nested.length === 0) return true;
    return nested.some((item) => isDatabaseConnectionFailure(item));
  }

  if ("cause" in error && error.cause) return isDatabaseConnectionFailure(error.cause);

  return false;
}

let announced = false;

export function createDatabaseUnavailableError(): DatabaseUnavailableError {
  if (!announced) {
    announced = true;
    console.error(DATABASE_UNAVAILABLE_MESSAGE);
  }
  return new DatabaseUnavailableError();
}
