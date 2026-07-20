/** Shared validation for optional public header logo (PNG/JPEG data URLs or http(s) image URLs). */

/** Max length for header brand subline / title (plain text next to logo). */
export const HEADER_BRAND_TEXT_MAX_LENGTH = 150;

export const HEADER_LOGO_MAX_DECODED_BYTES = 256 * 1024;
export const HEADER_LOGO_ALT_MAX_LENGTH = 200;
/** Upper bound on full data URL string length (base64 + prefix). */
export const HEADER_LOGO_MAX_DATA_URL_LENGTH = 450_000;
export const HEADER_LOGO_MAX_REMOTE_URL_LENGTH = 2048;

export function validateHeaderLogoDataUrlOnly(dataUrl: string): string | null {
  if (dataUrl.length > HEADER_LOGO_MAX_DATA_URL_LENGTH) {
    return "Logo file is too large after encoding. Use a PNG or JPEG under 256KB.";
  }
  const m = dataUrl.trim().match(/^data:image\/(png|jpeg);base64,(.+)$/i);
  if (!m?.[2]) {
    return "Logo must be a PNG or JPEG image (data URL).";
  }
  const b64 = m[2].replace(/\s/g, "");
  try {
    const binary = atob(b64);
    if (binary.length > HEADER_LOGO_MAX_DECODED_BYTES) {
      return "Decoded logo exceeds 256KB.";
    }
  } catch {
    return "Logo image data is not valid base64.";
  }
  return null;
}

/** Accept either an uploaded data URL or a remote http(s) image URL. */
export function validateHeaderLogoSrcOnly(src: string): string | null {
  const trimmed = src.trim();
  if (!trimmed) return "Logo source is empty.";
  if (/^data:/i.test(trimmed)) {
    return validateHeaderLogoDataUrlOnly(trimmed);
  }
  if (trimmed.length > HEADER_LOGO_MAX_REMOTE_URL_LENGTH) {
    return "Logo URL is too long.";
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return "Logo URL must start with http:// or https://.";
    }
  } catch {
    return "Enter a valid image URL (https://…) or upload a PNG/JPEG.";
  }
  return null;
}

export function validateHeaderLogoPair(
  dataUrl: string | undefined,
  alt: string | undefined,
): { ok: true; dataUrl?: string; alt?: string } | { ok: false; errors: string[] } {
  const trimmedAlt = alt?.trim() ?? "";
  const hasUrl = Boolean(dataUrl?.trim());
  const hasAlt = Boolean(trimmedAlt);

  if (!hasUrl && !hasAlt) {
    return { ok: true, dataUrl: undefined, alt: undefined };
  }

  const errors: string[] = [];

  if (!hasUrl && hasAlt) {
    errors.push("presentation.headerLogoAlt cannot be set without presentation.headerLogoDataUrl.");
    return { ok: false, errors };
  }

  if (hasUrl && !dataUrl!.trim()) {
    errors.push("presentation.headerLogoDataUrl is empty.");
    return { ok: false, errors };
  }

  if (hasUrl && !hasAlt) {
    errors.push(
      "presentation.headerLogoAlt is required when a logo is set (describe the logo for screen readers).",
    );
    return { ok: false, errors };
  }

  const urlErr = validateHeaderLogoSrcOnly(dataUrl!);
  if (urlErr) {
    errors.push(urlErr);
    return { ok: false, errors };
  }

  if (trimmedAlt.length > HEADER_LOGO_ALT_MAX_LENGTH) {
    errors.push(`presentation.headerLogoAlt must be at most ${HEADER_LOGO_ALT_MAX_LENGTH} characters.`);
    return { ok: false, errors };
  }

  return { ok: true, dataUrl: dataUrl!.trim(), alt: trimmedAlt };
}

export async function readLogoFileAsDataUrl(file: File): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  const type = file.type.toLowerCase();
  if (type !== "image/png" && type !== "image/jpeg") {
    return { ok: false, error: "Choose a PNG or JPEG image." };
  }
  if (file.size > HEADER_LOGO_MAX_DECODED_BYTES) {
    return { ok: false, error: `Image must be ${HEADER_LOGO_MAX_DECODED_BYTES / 1024}KB or smaller.` };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve({ ok: false, error: "Could not read the file." });
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        resolve({ ok: false, error: "Could not read the file." });
        return;
      }
      const err = validateHeaderLogoDataUrlOnly(dataUrl);
      if (err) {
        resolve({ ok: false, error: err });
        return;
      }
      resolve({ ok: true, dataUrl });
    };
    reader.readAsDataURL(file);
  });
}
