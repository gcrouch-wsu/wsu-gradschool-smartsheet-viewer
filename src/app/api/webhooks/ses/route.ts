import { NextResponse } from "next/server";
import { parseSesEvents, sesCorrelationIds, workflowStatusForSesEvent } from "@/lib/ses/parse";
import { confirmSnsSubscription, fetchSnsCertificate, readSnsEnvelope, verifySnsSignature } from "@/lib/ses/sns";
import { insertSesEvents } from "@/lib/ses/store";
import { applySesOutcomeToDeliveries } from "@/lib/workflows/store";

export const dynamic = "force-dynamic";

const MAX_BODY = 1_000_000;

function denied(status: number) {
  return NextResponse.json({ error: "Not accepted." }, { status });
}

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return denied(413);

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return denied(400);
  }

  const envelope = readSnsEnvelope(payload);
  if (!envelope) return denied(400);

  const expectedTopic = process.env.SES_EVENTS_TOPIC_ARN?.trim();
  if (expectedTopic && envelope.TopicArn !== expectedTopic) return denied(403);

  let certificate: string | null = null;
  try {
    certificate = await fetchSnsCertificate(envelope.SigningCertURL);
  } catch {
    return denied(502);
  }
  if (!certificate || !verifySnsSignature(envelope, certificate)) return denied(403);

  if (envelope.Type === "SubscriptionConfirmation" || envelope.Type === "UnsubscribeConfirmation") {
    if (!envelope.SubscribeURL) return denied(400);
    try {
      const confirmed = await confirmSnsSubscription(envelope.SubscribeURL);
      if (!confirmed) return denied(502);
    } catch {
      return denied(502);
    }
    return NextResponse.json({ ok: true });
  }

  if (envelope.Type !== "Notification") return denied(400);

  let message: unknown;
  try {
    message = JSON.parse(envelope.Message);
  } catch {
    return NextResponse.json({ received: 0 });
  }

  const events = parseSesEvents(message);
  const received = await insertSesEvents(events);
  for (const event of events) {
    const status = workflowStatusForSesEvent(event);
    if (!status) continue;
    await applySesOutcomeToDeliveries({
      recipientEmail: event.recipientEmail,
      messageIds: sesCorrelationIds(event.payload),
      status,
      error: event.outcome,
    });
  }
  return NextResponse.json({ received });
}
