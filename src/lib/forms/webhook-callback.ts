import { getPublicOrigin } from "@/lib/request-ip";
import { config } from "@/lib/forms/config";

export const WEBHOOK_CALLBACK_PATH = "/api/forms/webhooks/smartsheet";

export function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
}

export function maskCallbackUrl(url: string): string {
  return url.replace(/([?&]secret=)[^&]*/i, "$1********");
}

export function withSecretQuery(callbackUrl: string, secret: string): string {
  const parsed = new URL(callbackUrl);
  if (!parsed.searchParams.get("secret")) {
    parsed.searchParams.set("secret", secret);
  }
  return parsed.toString();
}

export function resolvePublicOrigin(request: Request): string | null {
  const fromHeaders = getPublicOrigin(request.headers);
  if (fromHeaders) return fromHeaders;
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

export function buildCallbackUrl(
  request: Request,
  secret: string,
  configuredOverride = config.webhookCallbackUrl.trim(),
): { url: string } | { error: string } {
  if (configuredOverride) {
    try {
      return { url: withSecretQuery(configuredOverride, secret) };
    } catch {
      return { error: "WEBHOOK_CALLBACK_URL is not a valid URL." };
    }
  }

  const origin = resolvePublicOrigin(request);
  if (!origin) {
    return {
      error:
        "Could not determine a public callback URL. Set SMARTSHEETS_VIEW_PUBLIC_BASE_URL or WEBHOOK_CALLBACK_URL.",
    };
  }

  try {
    const parsed = new URL(origin);
    if (isLocalHost(parsed.hostname)) {
      return {
        error:
          "Smartsheet cannot reach a localhost callback. Use a public HTTPS URL (tunnel or deploy), or set WEBHOOK_CALLBACK_URL / SMARTSHEETS_VIEW_PUBLIC_BASE_URL.",
      };
    }
    return { url: withSecretQuery(new URL(WEBHOOK_CALLBACK_PATH, origin).toString(), secret) };
  } catch {
    return { error: "Could not build webhook callback URL." };
  }
}
