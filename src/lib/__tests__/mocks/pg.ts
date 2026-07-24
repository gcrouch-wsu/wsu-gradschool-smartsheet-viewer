/**
 * Vitest alias target for `pg`. vmForks does not reliably apply vi.mock to the
 * CJS `pg` package, so tests configure a query handler on globalThis instead.
 */
export type PgMockQuery = (
  text: string,
  params?: unknown[],
) => Promise<{ rows: unknown[]; rowCount: number }>;

type PgMockGlobal = typeof globalThis & {
  __smartsheetsViewPgMockQuery?: PgMockQuery;
};

function runMockQuery(text: string, params?: unknown[]) {
  const handler = (globalThis as PgMockGlobal).__smartsheetsViewPgMockQuery;
  if (!handler) {
    throw new Error("pg mock query handler is not configured for this test.");
  }
  return handler(text, params);
}

export class Pool {
  async query(text: string, params?: unknown[]) {
    return runMockQuery(text, params);
  }

  async connect() {
    return {
      query: (text: string, params?: unknown[]) => runMockQuery(text, params),
      release() {},
    };
  }

  async end() {}
}

const pgMock = { Pool };
export default pgMock;
