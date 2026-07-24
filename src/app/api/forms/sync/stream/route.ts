import { ensureBootstrapped } from "@/lib/forms/init";
import { requireFormsAccess, formsAuthErrorResponse } from "@/lib/forms/forms-api";
import { subscribeWebhookEvents, type WebhookLiveEvent } from "@/lib/forms/webhook-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream. Pushes only when Smartsheet webhooks report sheet changes.
 * One long-lived connection — no polling.
 */
export async function GET(request: Request) {
  const access = await requireFormsAccess(request);
  if ("response" in access) return access.response;

  try {
    await ensureBootstrapped();
  } catch (e) {
    return formsAuthErrorResponse(e);
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: "connected", at: new Date().toISOString() });

      unsubscribe = subscribeWebhookEvents((event: WebhookLiveEvent) => {
        send({ type: "sheet_changed", ...event });
      });

      heartbeat = setInterval(() => {
        if (closed) return;
        // Comment frames keep the connection alive without a "sync" network entry burst.
        controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
      }, 25000);

      const onAbort = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", onAbort);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
