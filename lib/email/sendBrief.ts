// Stage 7: deliver. Sends the brief through Resend. A failed email never loses the brief:
// the brief is saved before this runs, and the outcome is recorded in briefs.email_status.
import { Resend } from "resend";
import type { BriefContent } from "../brief";
import { renderBriefEmail } from "./template";

export function appUrl(): string | null {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : null;
}

export interface EmailOutcome {
  status: string; // 'sent' | 'skipped: ...' | 'failed: ...'
  sent: boolean;
}

export async function sendBriefEmail(brief: BriefContent, recipientFromSettings: string): Promise<EmailOutcome> {
  const to = recipientFromSettings.trim() || process.env.BRIEF_RECIPIENT_EMAIL?.trim() || "";
  if (!to) return { status: "skipped: no recipient set in Settings or BRIEF_RECIPIENT_EMAIL", sent: false };
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { status: "skipped: RESEND_API_KEY is not set", sent: false };

  const from = process.env.RESEND_FROM?.trim() || "SignalForge <onboarding@resend.dev>";
  const { subject, html } = renderBriefEmail(brief, appUrl());

  try {
    const { error } = await new Resend(apiKey).emails.send({ from, to, subject, html });
    if (error) return { status: `failed: ${error.message}`.slice(0, 300), sent: false };
    return { status: "sent", sent: true };
  } catch (err) {
    return { status: `failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300), sent: false };
  }
}
