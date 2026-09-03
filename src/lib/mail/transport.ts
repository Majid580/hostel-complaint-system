import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { env } from "@/lib/config/env";

/**
 * Mail transport adapter.
 *
 * Three providers, all free:
 *   console — development: prints the message to the server log
 *   smtp    — Gmail app password (500/day) or Brevo (300/day)
 *   resend  — Resend free tier (HTTP API, needs a verified domain)
 *
 * The rest of the app only ever calls `sendMailNow`, so swapping providers is a
 * single environment-variable change.
 */

export type MailMessage = {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type MailResult = { ok: true; id?: string } | { ok: false; error: string };

const globalForMail = globalThis as unknown as { __hcmsTransporter?: Transporter };

function getTransporter(): Transporter {
  if (globalForMail.__hcmsTransporter) return globalForMail.__hcmsTransporter;

  const { host, port, secure, user, pass } = env.smtp;
  if (!host || !user || !pass) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS, or use MAIL_PROVIDER=console.",
    );
  }

  const options: SMTPTransport.Options = {
    host,
    port,
    secure: secure || port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  };

  const transporter = nodemailer.createTransport(options);

  globalForMail.__hcmsTransporter = transporter;
  return transporter;
}

async function sendViaResend(message: MailMessage): Promise<MailResult> {
  const apiKey = env.resendApiKey;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not set." };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.mailFrom,
        to: message.to,
        cc: message.cc?.length ? message.cc : undefined,
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `Resend responded ${response.status}: ${await response.text()}` };
    }
    const json = (await response.json()) as { id?: string };
    return { ok: true, id: json.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Attempts delivery immediately. Callers decide what to do with a failure. */
export async function sendMailNow(message: MailMessage): Promise<MailResult> {
  const recipients = message.to.filter(Boolean);
  if (recipients.length === 0) return { ok: false, error: "No recipients." };

  switch (env.mailProvider) {
    case "console": {
      console.info(
        [
          "",
          "──────────────── EMAIL (console provider) ────────────────",
          `To:      ${recipients.join(", ")}`,
          message.cc?.length ? `Cc:      ${message.cc.join(", ")}` : null,
          `From:    ${env.mailFrom}`,
          `Subject: ${message.subject}`,
          "----------------------------------------------------------",
          message.text,
          "──────────────────────────────────────────────────────────",
          "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return { ok: true, id: "console" };
    }

    case "resend":
      return sendViaResend(message);

    case "smtp":
    default:
      try {
        const info = await getTransporter().sendMail({
          from: env.mailFrom,
          to: recipients,
          cc: message.cc?.length ? message.cc : undefined,
          subject: message.subject,
          html: message.html,
          text: message.text,
          replyTo: message.replyTo,
        });
        return { ok: true, id: info.messageId };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
  }
}

export function mailConfigured(): boolean {
  if (env.mailProvider === "console") return true;
  if (env.mailProvider === "resend") return Boolean(env.resendApiKey);
  const { host, user, pass } = env.smtp;
  return Boolean(host && user && pass);
}
