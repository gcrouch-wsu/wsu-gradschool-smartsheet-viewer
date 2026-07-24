export type WebhookLiveEvent = {
  at: string;
  sheetId: number;
  eventType: string;
  objectId: number;
};

type Listener = (event: WebhookLiveEvent) => void;

const globalKey = "__wsuFormsWebhookLiveListeners";

function listenerSet(): Set<Listener> {
  const g = globalThis as unknown as Record<string, Set<Listener> | undefined>;
  if (!g[globalKey]) g[globalKey] = new Set();
  return g[globalKey]!;
}

/** Subscribe to live Smartsheet webhook notifications (in-process). */
export function subscribeWebhookEvents(listener: Listener): () => void {
  const set = listenerSet();
  set.add(listener);
  return () => set.delete(listener);
}

export function publishWebhookEvent(event: WebhookLiveEvent): void {
  for (const listener of listenerSet()) {
    try {
      listener(event);
    } catch {
      // Ignore broken subscribers.
    }
  }
}
