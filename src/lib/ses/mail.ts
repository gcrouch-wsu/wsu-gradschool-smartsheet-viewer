import nodemailer from "nodemailer";

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

export interface MailTransport {
  send(message: WorkflowEmailMessage): Promise<void>;
}

export interface WorkflowEmailResult {
  configured: boolean;
  sent: string[];
  failed: Array<{ email: string; error: string }>;
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
      await transporter.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        headers: message.headers,
      });
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
      sent: [],
      failed: emails.map((email) => ({ email, error: "Email is not configured." })),
    };
  }

  const transport = options?.transport ?? createSmtpTransport(config);
  const headers = config.configurationSet
    ? { "X-SES-CONFIGURATION-SET": config.configurationSet }
    : undefined;
  const sent: string[] = [];
  const failed: Array<{ email: string; error: string }> = [];
  for (const email of emails) {
    try {
      await transport.send({
        from: config.from,
        to: email,
        subject: input.subject,
        text: input.text,
        headers,
      });
      sent.push(email);
    } catch (error) {
      failed.push({ email, error: failureMessage(error) });
    }
  }
  return { configured: true, sent, failed };
}
