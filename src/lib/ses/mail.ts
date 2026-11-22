import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";

export const WORKFLOW_MESSAGE_HEADER = "X-Workflow-Message-Id";

export interface MailerConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  configurationSet: string | null;
}

export interface WorkflowEmailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  headers?: Record<string, string>;
}

export interface SentWorkflowEmail {
  messageId: string | null;
  response: string | null;
}

export interface MailTransport {
  send(message: WorkflowEmailMessage): Promise<SentWorkflowEmail>;
}

export interface AcceptedWorkflowEmail {
  email: string;
  messageIds: string[];
}

export interface WorkflowEmailResult {
  configured: boolean;
  /** SMTP accepted these addresses. SES has not confirmed delivery yet. */
  accepted: AcceptedWorkflowEmail[];
  failed: Array<{ email: string; error: string }>;
}

export function normalizeMessageId(value: string): string {
  return value.trim().replace(/^<|>$/g, "");
}

/** SES puts its message id at the end of a successful SMTP reply. */
export function sesIdFromSmtpResponse(response: string | null): string | null {
  if (!response) return null;
  const last = response.trim().split(/\s+/).pop();
  if (!last || last.length < 8 || /^(ok|queued)$/i.test(last)) return null;
  return normalizeMessageId(last);
}

export function messageIdsForAcceptedMail(token: string, sent: SentWorkflowEmail): string[] {
  const ids = new Set<string>([token]);
  if (sent.messageId) ids.add(normalizeMessageId(sent.messageId));
  const smtpId = sesIdFromSmtpResponse(sent.response);
  if (smtpId) ids.add(smtpId);
  return [...ids];
}

function required(env: Record<string, string | undefined>, key: string): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

/** SMTP settings for Amazon SES. Missing host, credentials, port, or from-address means mail is off. */
export function readMailerConfig(env: Record<string, string | undefined> = process.env): MailerConfig | null {
  const host = required(env, "SMTP_HOST");
  const user = required(env, "SMTP_USER");
  const password = required(env, "SMTP_PASSWORD");
  const from = required(env, "MAIL_FROM");
  const portRaw = required(env, "SMTP_PORT");
  const port = portRaw ? Number(portRaw) : Number.NaN;
  if (!host || !user || !password || !from || !Number.isInteger(port) || port <= 0) return null;
  return {
    host,
    port,
    user,
    password,
    from,
    configurationSet: required(env, "SES_CONFIGURATION_SET"),
  };
}

export function createSmtpTransport(config: MailerConfig): MailTransport {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port === 587,
    auth: { user: config.user, pass: config.password },
  });
  return {
    async send(message) {
      const info = await transporter.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        headers: message.headers,
      });
      return {
        messageId: typeof info.messageId === "string" ? info.messageId : null,
        response: typeof info.response === "string" ? info.response : null,
      };
    },
  };
}

function failureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Email could not be sent.";
  return message.slice(0, 300);
}

/** Send one SES message per recipient. A rejected address does not stop the others. */
export async function sendWorkflowEmail(
  input: { emails: string[]; subject: string; text: string },
  options?: { env?: Record<string, string | undefined>; transport?: MailTransport },
): Promise<WorkflowEmailResult> {
  const emails = [...new Set(input.emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  const config = readMailerConfig(options?.env ?? process.env);
  if (!config) {
    return {
      configured: false,
      accepted: [],
      failed: emails.map((email) => ({ email, error: "Email is not configured." })),
    };
  }

  const transport = options?.transport ?? createSmtpTransport(config);
  const accepted: AcceptedWorkflowEmail[] = [];
  const failed: Array<{ email: string; error: string }> = [];
  for (const email of emails) {
    const token = randomUUID();
    const headers: Record<string, string> = { [WORKFLOW_MESSAGE_HEADER]: token };
    if (config.configurationSet) headers["X-SES-CONFIGURATION-SET"] = config.configurationSet;
    try {
      const sent = await transport.send({
        from: config.from,
        to: email,
        subject: input.subject,
        text: input.text,
        headers,
      });
      accepted.push({ email, messageIds: messageIdsForAcceptedMail(token, sent) });
    } catch (error) {
      failed.push({ email, error: failureMessage(error) });
    }
  }
  return { configured: true, accepted, failed };
}
