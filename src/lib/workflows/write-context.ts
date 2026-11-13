import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<boolean>();

/** Sheet writes made by a workflow must not start that same workflow again. */
export function isWorkflowWrite(): boolean {
  return storage.getStore() === true;
}

export function runAsWorkflowWrite<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run(true, fn);
}
