/**
 * Structured logger (pino) with secret redaction + request-id tagging.
 *
 * Keys redacted: anything containing a passcode, reply text, or a secret name.
 * pino's redact option handles nested paths via dot-notation.
 */

import pino from 'pino';
import { env } from '@/lib/env';
import { currentRequestId } from '@/lib/request-context';

const baseLogger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'passcode',
      'new_passcode',
      'plaintext',
      'replyText',
      'expression_reply',
      'body.passcode',
      'body.replyText',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'headers.authorization',
      'headers.cookie',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ADMIN_PASSWORD',
      'ADMIN_PASSWORD_HASH',
      'COOKIE_SIGNING_SECRET',
      'CRON_SECRET',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Attach request_id to every log line when available.
  mixin() {
    const rid = currentRequestId();
    return rid ? { request_id: rid } : {};
  },
});

export const logger = baseLogger;

export function childLogger(bindings: Record<string, unknown>) {
  return baseLogger.child(bindings);
}
