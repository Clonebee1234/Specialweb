/**
 * Route handler wrapper.
 *
 * Wraps every API route with:
 *   - request-id assignment (echoes `x-request-id`)
 *   - AsyncLocalStorage context so the logger picks up the request id
 *   - uniform JSON error envelope `{ error: { code, message, details? } }`
 *   - conversion of thrown `HttpError` into the matching HTTP status
 *   - a top-level try/catch that turns unexpected errors into
 *     `500 INTERNAL_ERROR` without leaking the exception message.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { newRequestId, runWithRequestContext } from '@/lib/request-context';
import { logger } from '@/lib/logger';

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = 'HttpError';
  }
}

type HandlerContext<P extends Record<string, string> = Record<string, string>> = {
  params: { [K in keyof P]: string };
};

type Handler<P extends Record<string, string>> = (
  req: NextRequest,
  ctx: HandlerContext<P>,
) => Promise<Response>;

export function apiHandler<P extends Record<string, string> = Record<string, string>>(
  handler: Handler<P>,
): (req: NextRequest, ctx: { params: P }) => Promise<Response> {
  return async (req, ctx) => {
    const requestId = req.headers.get('x-request-id') ?? newRequestId();
    return runWithRequestContext({ requestId }, async () => {
      const start = Date.now();
      try {
        const res = await handler(req, ctx as unknown as HandlerContext<P>);
        // Echo the request id on successful responses.
        res.headers.set('x-request-id', requestId);
        logger.info(
          {
            route: new URL(req.url).pathname,
            method: req.method,
            status: res.status,
            duration_ms: Date.now() - start,
          },
          'request',
        );
        return res;
      } catch (err) {
        const { status, body } = toErrorBody(err);
        logger.error(
          {
            err,
            route: new URL(req.url).pathname,
            method: req.method,
            status,
            duration_ms: Date.now() - start,
          },
          'request_failed',
        );
        return NextResponse.json<ApiErrorBody>(body, {
          status,
          headers: { 'x-request-id': requestId },
        });
      }
    });
  };
}

function toErrorBody(err: unknown): { status: number; body: ApiErrorBody } {
  if (err instanceof HttpError) {
    const body: ApiErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };
    return { status: err.status, body };
  }
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    },
  };
}

/** Convenience helpers so routes don't need to import NextResponse everywhere. */
export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return NextResponse.json(data, init);
}

export function jsonError(status: number, code: string, message: string, details?: unknown): Response {
  return NextResponse.json<ApiErrorBody>(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status },
  );
}
