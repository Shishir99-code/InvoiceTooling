import nodemailer from 'nodemailer';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

export type MailerError = {
  ok: false;
  error: string;
};

export type MailerSuccess = {
  ok: true;
};

export type SendResult = MailerSuccess | MailerError;

function getEncryptionKey(): Buffer {
  const keyString = process.env.ENCRYPTION_KEY;
  if (!keyString) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  // Derive a 32-byte key from the ENCRYPTION_KEY using scrypt
  return scryptSync(keyString, 'salt', 32);
}

export function encryptAppPassword(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptAppPassword(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, encrypted] = ciphertext.split(':');

  if (!ivHex || !encrypted) {
    throw new Error('Invalid ciphertext format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function createGmailTransporter(appPassword: string, gmailUserEmail: string): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // TLS, not SSL
    auth: {
      user: gmailUserEmail,
      pass: appPassword,
    },
  });
}

export type InvoiceRow = {
  id: number;
  parentEmail: string;
  renderedSubject: string;
  renderedBody: string;
};

export async function sendInvoiceViaGmail(opts: {
  invoice: InvoiceRow;
  gmailAppPassword: string;
  gmailUserEmail: string;
}): Promise<SendResult> {
  try {
    const decryptedPassword = decryptAppPassword(opts.gmailAppPassword);
    const transporter = createGmailTransporter(decryptedPassword, opts.gmailUserEmail);

    await transporter.sendMail({
      from: opts.gmailUserEmail,
      to: opts.invoice.parentEmail,
      subject: opts.invoice.renderedSubject,
      text: opts.invoice.renderedBody,
    });

    return { ok: true };
  } catch (error) {
    let errorMessage = 'Failed to send email';

    if (error instanceof Error) {
      const code = (error as any).code;
      const message = error.message || '';

      if (code === 'EAUTH' || message.includes('Invalid credentials')) {
        errorMessage = 'Gmail credential invalid or expired — update in Settings';
      } else if (code === 'ETIMEDOUT' || message.includes('timeout')) {
        errorMessage = 'Network timeout — check connection and retry';
      } else if (code === 'ENOTFOUND') {
        errorMessage = 'Unable to reach Gmail servers — try again later';
      } else if (message.includes('454') || message.includes('Rate limit')) {
        errorMessage = 'Gmail rate limited — you can send ~100 emails/day. Try again tomorrow.';
      } else if (message.includes('Invalid recipient') || message.includes('550')) {
        errorMessage = 'Parent email invalid or blocked by Gmail';
      } else {
        errorMessage = `Failed to send: ${message.substring(0, 100)}`;
      }
    }

    return { ok: false, error: errorMessage };
  }
}
