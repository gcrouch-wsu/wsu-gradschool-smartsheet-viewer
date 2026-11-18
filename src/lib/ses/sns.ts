import { createVerify } from "node:crypto";

export interface SnsEnvelope {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: "1" | "2";
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  Token?: string;
  SubscribeURL?: string;
}

const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/i;

function asHttpsUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "443") return null;
  if (!SNS_HOST.test(url.hostname)) return null;
  if (url.pathname.includes("..")) return null;
  return url;
}

/** Signing certificate URLs published by Amazon SNS. */
export function isAllowedSnsCertUrl(raw: string): boolean {
  const url = asHttpsUrl(raw);
  if (!url || url.search) return false;
  return url.pathname.endsWith(".pem");
}

/** Subscription confirmation URLs published by Amazon SNS. */
export function isAllowedSnsSubscribeUrl(raw: string): boolean {
  const url = asHttpsUrl(raw);
  return Boolean(url && (url.pathname === "/" || url.pathname === ""));
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function readSnsEnvelope(payload: unknown): SnsEnvelope | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Record<string, unknown>;
  const type = requiredString(raw.Type);
  const messageId = requiredString(raw.MessageId);
  const topicArn = requiredString(raw.TopicArn);
  const message = typeof raw.Message === "string" ? raw.Message : null;
  const timestamp = requiredString(raw.Timestamp);
  const signature = requiredString(raw.Signature);
  const certUrl = requiredString(raw.SigningCertURL);
  const version = raw.SignatureVersion === "1" || raw.SignatureVersion === "2" ? raw.SignatureVersion : null;
  if (!type || !messageId || !topicArn || message === null || !timestamp || !signature || !certUrl || !version) {
    return null;
  }
  return {
    Type: type,
    MessageId: messageId,
    TopicArn: topicArn,
    Message: message,
    Timestamp: timestamp,
    SignatureVersion: version,
    Signature: signature,
    SigningCertURL: certUrl,
    Subject: typeof raw.Subject === "string" ? raw.Subject : undefined,
    Token: typeof raw.Token === "string" ? raw.Token : undefined,
    SubscribeURL: typeof raw.SubscribeURL === "string" ? raw.SubscribeURL : undefined,
  };
}

/** Canonical string SNS signs. Field order follows the SNS signature spec. */
export function snsStringToSign(message: SnsEnvelope): string | null {
  const fields: Array<[string, string | undefined]> =
    message.Type === "Notification"
      ? [
          ["Message", message.Message],
          ["MessageId", message.MessageId],
          ...(message.Subject !== undefined ? [["Subject", message.Subject] as [string, string]] : []),
          ["Timestamp", message.Timestamp],
          ["TopicArn", message.TopicArn],
          ["Type", message.Type],
        ]
      : message.Type === "SubscriptionConfirmation" || message.Type === "UnsubscribeConfirmation"
        ? [
            ["Message", message.Message],
            ["MessageId", message.MessageId],
            ["SubscribeURL", message.SubscribeURL],
            ["Timestamp", message.Timestamp],
            ["Token", message.Token],
            ["TopicArn", message.TopicArn],
            ["Type", message.Type],
          ]
        : [];
  if (!fields.length || fields.some(([, value]) => value === undefined)) return null;
  return fields.map(([name, value]) => `${name}\n${value}\n`).join("");
}

export function verifySnsSignature(message: SnsEnvelope, certificatePem: string): boolean {
  const signed = snsStringToSign(message);
  const hasKey = certificatePem.includes("BEGIN CERTIFICATE") || certificatePem.includes("BEGIN PUBLIC KEY");
  if (!signed || !hasKey) return false;
  try {
    const verifier = createVerify(message.SignatureVersion === "2" ? "sha256" : "sha1");
    verifier.update(signed, "utf8");
    return verifier.verify(certificatePem, message.Signature, "base64");
  } catch {
    return false;
  }
}

const certCache = new Map<string, string>();

export async function fetchSnsCertificate(certUrl: string): Promise<string | null> {
  if (!isAllowedSnsCertUrl(certUrl)) return null;
  const cached = certCache.get(certUrl);
  if (cached) return cached;
  const response = await fetch(certUrl, { redirect: "error", signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;
  const pem = await response.text();
  if (pem.length > 64_000 || !pem.includes("BEGIN CERTIFICATE")) return null;
  certCache.set(certUrl, pem);
  return pem;
}

export async function confirmSnsSubscription(subscribeUrl: string): Promise<boolean> {
  if (!isAllowedSnsSubscribeUrl(subscribeUrl)) return false;
  const response = await fetch(subscribeUrl, { redirect: "error", signal: AbortSignal.timeout(5000) });
  return response.ok;
}
