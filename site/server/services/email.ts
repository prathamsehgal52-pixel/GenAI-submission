import nodemailer from 'nodemailer'
import { config } from '../config'
import { logger } from '../logger'

export type Email = { to: string; subject: string; text: string; html: string }

/** Messages captured by the memory driver (automated tests only). */
export const sentEmails: Email[] = []

const transport = config.EMAIL_DRIVER === 'smtp' ? nodemailer.createTransport(config.SMTP_URL!) : null

export class EmailUnavailableError extends Error {
  code = 'email_unavailable'
}

export async function sendEmail(email: Email) {
  if (config.EMAIL_DRIVER === 'memory') {
    sentEmails.push(email)
    return
  }
  if (!transport) throw new EmailUnavailableError('Email delivery is not configured')
  await transport.sendMail({ from: config.EMAIL_FROM, ...email })
  logger.info({ subject: email.subject }, 'email sent')
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Minimal branded HTML wrapper matching the product's type and palette. */
export function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#e9ebed;font-family:Helvetica,Arial,sans-serif;color:#121212">
<div style="max-width:520px;margin:0 auto;padding:40px 24px">
<p style="font-size:20px;letter-spacing:-0.04em;text-transform:uppercase;margin:0 0 32px">Armoire</p>
<div style="background:#ffffff;border-radius:24px;padding:32px">
<h1 style="font-size:26px;line-height:1;text-transform:uppercase;letter-spacing:-0.03em;margin:0 0 16px">${esc(title)}</h1>
${bodyHtml}
${cta ? `<p style="margin:28px 0 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#121212;color:#fff;text-decoration:none;border-radius:999px;padding:14px 24px;font-size:13px;text-transform:uppercase">${esc(cta.label)}</a></p>` : ''}
</div>
<p style="font-size:11px;color:#8b9096;margin-top:24px">You're receiving this because you have an Armoire account.</p>
</div></body></html>`
}

export { esc }
